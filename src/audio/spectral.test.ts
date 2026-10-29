import { describe, expect, it, vi } from 'vitest';
import { sineWave } from './fixtures';
import { periodicHann } from './windowing';
import { aggregateBandPower, SOUNDSCAPE_BANDS } from './bands';
import { analyzeSpectrum, createSpectrumAnalyzer, SUPPORTED_FFT_SIZES } from './spectrum';
import type { SpectrumOptions, SpectrumSettings } from './spectrum';
import type { PcmAudio } from './pcm';
import * as pcm from './pcm';

// Float32 fixture quantization is ~1e-7 relative at unit amplitude. Analytic power
// comparisons allow 1e-7 absolute error; same-input Number/FFT identities use 1e-12.
const FIXTURE_POWER_TOLERANCE = 1e-7;
const FFT_TOLERANCE = 1e-12;
const WINDOW_TOLERANCE = 2e-14;
const sampleRate = 48000;
const fftSize = 4096;
const options: SpectrumOptions = { frameOffset: 0, fftSize };

function close(actual: number, expected: number, tolerance = FFT_TOLERANCE): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

function peakBin(power: Float64Array): number {
  let index = 0;
  for (let k = 1; k < power.length; k++) if (power[k]! > power[index]!) index = k;
  return index;
}

function tone(frequencyHz: number, length = fftSize, rate = sampleRate, amplitude = 1): Float32Array {
  return sineWave({ sampleRate: rate, frameCount: length, frequencyHz, amplitude });
}

function mono(samples: Float32Array, rate = sampleRate): PcmAudio {
  return { sampleRate: rate, channels: [samples] };
}

// Independent finite-sum DFT reference, not the FFT library or production window helper.
function referenceBin(samples: ArrayLike<number>, size: number, bin: number): number {
  let re = 0;
  let im = 0;
  let sumW2 = 0;
  for (let n = 0; n < samples.length; n++) {
    const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * n / samples.length);
    const angle = 2 * Math.PI * bin * n / size;
    re += samples[n]! * w * Math.cos(angle);
    im -= samples[n]! * w * Math.sin(angle);
    sumW2 += w * w;
  }
  return (bin === 0 || bin === size / 2 ? 1 : 2) * (re * re + im * im) / (size * sumW2);
}

function referenceTotal(samples: ArrayLike<number>): number {
  let weightedSquare = 0;
  let sumW2 = 0;
  for (let n = 0; n < samples.length; n++) {
    const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * n / samples.length);
    weightedSquare += (samples[n]! * w) ** 2;
    sumW2 += w * w;
  }
  return weightedSquare / sumW2;
}

describe('periodic Hann', () => {
  it.each([4, 5, 997])('supports a short or irregular observation of length %s', length => {
    const samples = Float32Array.from({ length }, (_, n) => 0.3 + Math.sin(n));
    const channel = analyzeSpectrum(mono(samples), { frameOffset: 0, fftSize: 1024, frameLength: length }).channels[0]!;
    close(channel.totalPower, referenceTotal(samples));
    for (const k of [0, 1, 100, 512]) close(channel.power[k]!, referenceBin(samples, 1024, k));
  });
  it('uses N rather than N-1, with circular rather than endpoint symmetry', () => {
    const { coefficients: w, coherentGain, meanSquareGain } = periodicHann(4);
    [0, 0.5, 1, 0.5].forEach((value, n) => close(w[n]!, value, WINDOW_TOLERANCE));
    close(coherentGain, 0.5, WINDOW_TOLERANCE);
    close(meanSquareGain, 3 / 8, WINDOW_TOLERANCE);
    expect(w[3]).not.toBe(0); // Symmetric Hann would have zero at both endpoints.
    const large = periodicHann(1024).coefficients;
    for (let n = 1; n < large.length; n++) close(large[n]!, large[large.length - n]!, WINDOW_TOLERANCE);
  });

  it.each(SUPPORTED_FFT_SIZES)('has gains 1/2 and 3/8 at length %s', length => {
    const window = periodicHann(length);
    close(window.coherentGain, 0.5, WINDOW_TOLERANCE);
    close(window.meanSquareGain, 3 / 8, WINDOW_TOLERANCE);
    close(window.sumSquaredCoefficients / length, 3 / 8, WINDOW_TOLERANCE);
  });

  it.each([0, -1, 1, 2, 3, 4.5, NaN, Infinity, 65537])('rejects length %s', length => {
    expect(() => periodicHann(length)).toThrow(RangeError);
  });
  it('rejects incorrect length types', () => {
    expect(() => periodicHann('1024' as unknown as number)).toThrow(TypeError);
  });
});

describe('one-sided spectral power', () => {
  it('keeps both active stereo channels and successive result buffers independent', () => {
    const left = tone(187.5, fftSize, sampleRate, 0.5);
    const right = tone(1500, fftSize, sampleRate, 0.25);
    const input: PcmAudio = { sampleRate, channels: [left, right] };
    const before = input.channels.map(channel => channel.slice());
    const first = analyzeSpectrum(input, options);
    expect(peakBin(first.channels[0]!.power)).toBe(16);
    expect(peakBin(first.channels[1]!.power)).toBe(128);
    close(first.channels[0]!.totalPower, 0.125, FIXTURE_POWER_TOLERANCE);
    close(first.channels[1]!.totalPower, 0.03125, FIXTURE_POWER_TOLERANCE);
    const next = analyzeSpectrum(input, options);
    first.channels[0]!.power.fill(99);
    first.frequencyHz.fill(99);
    expect(next.channels[0]!.power[16]).not.toBe(99);
    expect(next.frequencyHz[16]).toBe(187.5);
    expect(peakBin(first.channels[1]!.power)).toBe(128);
    expect(input.channels).toEqual(before);
    expect(analyzeSpectrum(input, options)).toEqual(next);
  });
  it('measures mono and stereo silence exactly', () => {
    for (const channels of [[new Float32Array(fftSize)], [new Float32Array(fftSize), new Float32Array(fftSize)]] as const) {
      const result = analyzeSpectrum({ sampleRate, channels }, options);
      expect(result.channels).toHaveLength(channels.length);
      for (const channel of result.channels) {
        expect(channel.power).toEqual(new Float64Array(fftSize / 2 + 1));
        expect(channel.totalPower).toBe(0);
        expect(channel.bands.every(band => band.power === 0)).toBe(true);
      }
    }
  });

  describe.each(SUPPORTED_FFT_SIZES)('FFT size %s', size => {
    it.each([1, 0.5, 0.25])('normalizes a bin-aligned 1 kHz sine of amplitude %s', amplitude => {
      // 1000 Hz / 51200 Hz = 5/256: aligns at every supported power-of-two size.
      const rate = 51200;
      const result = analyzeSpectrum(mono(tone(1000, size, rate, amplitude), rate), { frameOffset: 0, fftSize: size });
      const { power, totalPower } = result.channels[0]!;
      const k = size * 1000 / rate;
      expect(peakBin(power)).toBe(k);
      expect(result.frequencyHz[k]).toBe(1000);
      expect(result.frequencyBinSpacingHz).toBe(rate / size);
      expect(power.length).toBe(size / 2 + 1);
      expect(result.frequencyHz[0]).toBe(0);
      expect(result.frequencyHz[size / 2]).toBe(rate / 2);
      // Periodic Hann spreads an interior bin-centered tone over three bins.
      close(power[k]!, amplitude ** 2 / 3, FIXTURE_POWER_TOLERANCE);
      close(power[k - 1]!, amplitude ** 2 / 12, FIXTURE_POWER_TOLERANCE);
      close(power[k + 1]!, amplitude ** 2 / 12, FIXTURE_POWER_TOLERANCE);
      close(totalPower, amplitude ** 2 / 2, FIXTURE_POWER_TOLERANCE);
      expect(power.every(value => Number.isFinite(value) && value >= 0)).toBe(true);
    });
  });

  it.each([
    { frequency: 1000, size: 4096 },
    { frequency: 60, size: 32768 },
  ])('resolves $frequency Hz at 48 kHz with size $size and matches a direct analytic DFT', ({ frequency, size }) => {
    const samples = tone(frequency, size);
    const ideal = Float64Array.from({ length: size }, (_, n) => Math.sin(2 * Math.PI * frequency * n / sampleRate));
    const result = analyzeSpectrum(mono(samples), { frameOffset: 0, fftSize: size });
    const { power, totalPower } = result.channels[0]!;
    const k = Math.round(frequency * size / sampleRate);
    expect(peakBin(power)).toBe(k);
    expect(Math.abs(result.frequencyHz[k]! - frequency)).toBeLessThanOrEqual(result.frequencyBinSpacingHz / 2);
    close(power[k]!, referenceBin(ideal, size, k), FIXTURE_POWER_TOLERANCE);
    close(totalPower, referenceTotal(ideal), FIXTURE_POWER_TOLERANCE);
    const band = result.channels[0]!.bands.find(b => b.name === (frequency === 60 ? 'Bass' : 'Mids'))!;
    expect(band.power).toBeGreaterThan(0);
  });

  it('keeps two bin-aligned tones distinguishable with independent powers', () => {
    const low = tone(187.5, fftSize, sampleRate, 0.5); // bin 16
    const high = tone(1500, fftSize, sampleRate, 0.25); // bin 128
    const mixed = Float32Array.from(low, (value, n) => value + high[n]!);
    const channel = analyzeSpectrum(mono(mixed), options).channels[0]!;
    const peaks = Array.from(channel.power.keys()).filter(k => k > 0 && k < fftSize / 2 &&
      channel.power[k]! > channel.power[k - 1]! && channel.power[k]! > channel.power[k + 1]!)
      .sort((a, b) => channel.power[b]! - channel.power[a]!);
    expect(peaks.slice(0, 2)).toEqual([16, 128]);
    close(channel.power[16]!, 0.5 ** 2 / 3, FIXTURE_POWER_TOLERANCE);
    close(channel.power[128]!, 0.25 ** 2 / 3, FIXTURE_POWER_TOLERANCE);
    close(channel.totalPower, (0.5 ** 2 + 0.25 ** 2) / 2, FIXTURE_POWER_TOLERANCE);
  });

  it.each([0, 1])('preserves stereo order with only channel %s active', active => {
    const signal = tone(1500);
    const silence = new Float32Array(fftSize);
    const channels: PcmAudio['channels'] = active === 0 ? [signal, silence] : [silence, signal];
    const before = channels.map(channel => channel.slice());
    const first = analyzeSpectrum({ sampleRate, channels }, options);
    const again = analyzeSpectrum({ sampleRate, channels }, options);
    expect(first).toEqual(again);
    close(first.channels[active]!.totalPower, 0.5, FIXTURE_POWER_TOLERANCE);
    expect(first.channels[1 - active]!.power).toEqual(new Float64Array(fftSize / 2 + 1));
    expect(first.channels[1 - active]!.bands.every(b => b.power === 0)).toBe(true);
    expect(channels).toEqual(before);
    expect(first.channels[0]!.power).not.toBe(first.channels[1]!.power);
  });

  it('handles non-bin-aligned leakage rather than forcing power into one bin', () => {
    const frequency = 85.5 * sampleRate / fftSize;
    const samples = tone(frequency);
    const channel = analyzeSpectrum(mono(samples), options).channels[0]!;
    close(channel.totalPower, referenceTotal(samples));
    for (const k of [80, 84, 85, 86, 87, 91]) close(channel.power[k]!, referenceBin(samples, fftSize, k));
    expect(channel.power[85]).toBeGreaterThan(0.2);
    expect(channel.power[86]).toBeGreaterThan(0.2);
    expect(channel.power[80]).toBeGreaterThan(1e-8); // Away from the Hann main lobe.
    expect(channel.totalPower).toBeGreaterThan(channel.power[peakBin(channel.power)]!);
  });

  it.each(['DC', 'Nyquist'] as const)('weights %s once and satisfies Parseval', endpoint => {
    const samples = Float32Array.from({ length: fftSize }, (_, n) => endpoint === 'DC' ? 1 : (n % 2 === 0 ? 1 : -1));
    const channel = analyzeSpectrum(mono(samples), options).channels[0]!;
    const k = endpoint === 'DC' ? 0 : fftSize / 2;
    close(channel.power[k]!, 2 / 3);
    close(channel.power[endpoint === 'DC' ? 1 : k - 1]!, 1 / 3);
    close(channel.totalPower, 1);
    close(channel.totalPower, referenceTotal(samples));
  });

  it('checks Parseval on a varied signed signal with DC, including over-range samples', () => {
    const samples = Float32Array.from({ length: fftSize }, (_, n) =>
      0.3 + 2 * Math.sin(2 * Math.PI * 12.3 * n / fftSize) + (n % 17 - 8) / 9);
    const before = samples.slice();
    const channel = analyzeSpectrum(mono(samples), options).channels[0]!;
    close(channel.totalPower, referenceTotal(samples));
    expect(samples).toEqual(before);
  });

  it('selects only the requested offset and documents padding without changing duration', () => {
    const length = 1024;
    const selected = tone(1500, length);
    const source = new Float32Array(length + 31).fill(3);
    source.set(selected, 17);
    const before = source.slice();
    const padded = analyzeSpectrum(mono(source), { frameOffset: 17, fftSize, frameLength: length });
    const direct = analyzeSpectrum(mono(selected), { frameOffset: 0, fftSize: length });
    expect(padded.frameOffset).toBe(17);
    expect(padded.frameLength).toBe(length);
    expect(padded.frameDurationSeconds).toBe(length / sampleRate);
    expect(padded.zeroPaddingSamples).toBe(fftSize - length);
    expect(padded.window).toEqual(direct.window);
    close(padded.channels[0]!.totalPower, direct.channels[0]!.totalPower);
    for (let k = 0; k <= length / 2; k++) {
      // Same frequency samples; padded per-bin power has the finer integration spacing.
      close(padded.channels[0]!.power[k * 4]! * 4, direct.channels[0]!.power[k]!);
    }
    close(padded.channels[0]!.totalPower, referenceTotal(selected));
    expect(source).toEqual(before);
    expect(padded.powerUnits).toBe('squared-linear-amplitude');
    expect(padded.normalization).toBe('one-sided-window-mean-square');
    expect(padded.sampleRate).toBe(sampleRate);
  });

  it('keeps extreme finite Float32 amplitudes finite and nonnegative', () => {
    const samples = new Float32Array(1024).fill(3e38);
    const channel = analyzeSpectrum(mono(samples), { frameOffset: 0, fftSize: 1024 }).channels[0]!;
    expect(Number.isFinite(channel.totalPower)).toBe(true);
    expect(channel.power.every(value => Number.isFinite(value) && value >= 0)).toBe(true);
    close(channel.totalPower / samples[0]! ** 2, 1);
  });
});

describe('frequency bands', () => {
  it('keeps published analysis settings fixed for untyped callers', () => {
    expect(Reflect.set(SUPPORTED_FFT_SIZES, '0', 3)).toBe(false);
    expect(Reflect.set(SOUNDSCAPE_BANDS[0], 'lowerHz', 0)).toBe(false);
    expect(Reflect.set(SOUNDSCAPE_BANDS, '0', { name: 'changed', lowerHz: 0, upperHz: 1 })).toBe(false);
    expect(() => analyzeSpectrum(mono(new Float32Array(1024)), { frameOffset: 0, fftSize: 1024 })).not.toThrow();
  });

  it.each([1000, 24000, 40960, 48000, 192000])('matches an independent band sum at sample rate %s', rate => {
    const size = 1024;
    const power = Float64Array.from({ length: size / 2 + 1 }, (_, k) => (k % 11) / 16);
    const actual = aggregateBandPower(power, rate, size);
    for (const [index, band] of SOUNDSCAPE_BANDS.entries()) {
      let expected = 0;
      let count = 0;
      for (let k = 0; k < power.length; k++) {
        const frequency = k * rate / size;
        if (frequency >= band.lowerHz && (frequency < band.upperHz || (index === 6 && frequency === 20000))) {
          expected += power[k]!;
          count++;
        }
      }
      expect(actual[index]!.power).toBe(expected);
      expect(actual[index]!.binCount).toBe(count);
    }
  });
  it('assigns shared boundaries to the higher band; includes 20 kHz and excludes DC/outside bins', () => {
    const size = 4096;
    const rate = 40960; // 10 Hz bin spacing aligns every nominal boundary.
    const power = new Float64Array(size / 2 + 1);
    for (const frequency of [0, 10, 20, 60, 250, 500, 2000, 6000, 12000, 20000, 20010]) power[frequency / 10] = 1;
    const before = power.slice();
    const bands = aggregateBandPower(power, rate, size);
    expect(bands.map(b => b.name)).toEqual(SOUNDSCAPE_BANDS.map(b => b.name));
    expect(bands.map(b => b.power)).toEqual([1, 1, 1, 1, 1, 1, 2]);
    expect(bands.reduce((sum, b) => sum + b.power, 0)).toBe(8);
    expect(power).toEqual(before);
  });

  it('clamps at Nyquist, including Nyquist when it is a shared lower boundary', () => {
    const size = 1024;
    const rate = 24000;
    const power = new Float64Array(size / 2 + 1);
    power[size / 2] = 2;
    const bands = aggregateBandPower(power, rate, size);
    expect(bands[5]!.power).toBe(0);
    expect(bands[6]).toEqual({ name: 'Air', lowerHz: 12000, upperHz: 12000, power: 2, binCount: 1 });
    expect(bands.every(b => b.upperHz <= rate / 2)).toBe(true);
  });

  it('returns zero for above-Nyquist and otherwise empty bands', () => {
    const result = analyzeSpectrum(mono(new Float32Array(1024), 1000), { frameOffset: 0, fftSize: 1024 });
    expect(result.channels[0]!.bands.slice(4).every(b => b.binCount === 0 && b.power === 0 && b.upperHz === 500)).toBe(true);
    const coarse = aggregateBandPower(new Float64Array(513), 192000, 1024);
    expect(coarse[0]).toEqual({ name: 'Sub-bass', lowerHz: 20, upperHz: 60, binCount: 0, power: 0 });
  });

  it('rejects malformed bin arrays, negative/nonfinite power, invalid rates and mismatched sizes', () => {
    expect(() => aggregateBandPower([] as unknown as Float64Array, sampleRate, 1024)).toThrow(TypeError);
    for (const value of [-1, NaN, Infinity]) {
      const power = new Float64Array(513);
      power[0] = value;
      expect(() => aggregateBandPower(power, sampleRate, 1024)).toThrow(RangeError);
    }
    expect(() => aggregateBandPower(new Float64Array(4), sampleRate, 1024)).toThrow(RangeError);
    expect(() => aggregateBandPower(new Float64Array(513), 0, 1024)).toThrow(RangeError);
    expect(() => aggregateBandPower(new Float64Array(513), sampleRate, 1023)).toThrow(RangeError);
    expect(() => aggregateBandPower(new Float64Array(513), sampleRate, '1024' as unknown as number)).toThrow(TypeError);
    const overflowing = new Float64Array(513);
    overflowing[2] = overflowing[3] = Number.MAX_VALUE;
    expect(() => aggregateBandPower(overflowing, sampleRate, 1024)).toThrow(RangeError);
    expect(() => aggregateBandPower(new Float64Array(513), Number.MIN_VALUE, 1024)).toThrow(RangeError);
  });
});

describe('spectral input validation', () => {
  const input = mono(new Float32Array(fftSize));
  it.each([0, 1, 512, 1000, 4095, 131072, NaN, Infinity])('rejects unsupported FFT size %s', size => {
    expect(() => analyzeSpectrum(input, { ...options, fftSize: size })).toThrow(RangeError);
  });
  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER])('rejects invalid offset %s', frameOffset => {
    expect(() => analyzeSpectrum(input, { ...options, frameOffset })).toThrow(RangeError);
  });
  it.each([0, 3, -1, 1.5, fftSize + 1, NaN, Infinity])('rejects frame length %s', frameLength => {
    expect(() => analyzeSpectrum(input, { ...options, frameLength })).toThrow(RangeError);
  });
  it.each([null, undefined, [], {}, { fftSize, frameOffset: '0' }, { fftSize: '4096', frameOffset: 0 },
    { ...options, frameLength: null }])('rejects malformed options %j', invalid => {
    expect(() => analyzeSpectrum(input, invalid as unknown as SpectrumOptions)).toThrow(TypeError);
  });
  it('rejects implicit padding and out-of-range selected windows', () => {
    expect(() => analyzeSpectrum(mono(new Float32Array(1024)), options)).toThrow(RangeError);
    expect(() => analyzeSpectrum(input, { ...options, frameOffset: 1 })).toThrow(RangeError);
    expect(() => analyzeSpectrum(input, { ...options, frameOffset: fftSize, frameLength: 4 })).toThrow(RangeError);
  });
  it.each([null, undefined, {}, { sampleRate, channels: null }, { sampleRate, channels: [null] }])('rejects malformed PCM %j', invalid => {
    expect(() => analyzeSpectrum(invalid as unknown as PcmAudio, options)).toThrow(TypeError);
  });
  it.each([
    { sampleRate: 0, channels: [new Float32Array(fftSize)] },
    { sampleRate, channels: [] },
    { sampleRate, channels: [new Float32Array()] },
    { sampleRate, channels: [new Float32Array(fftSize), new Float32Array(fftSize - 1)] },
    { sampleRate, channels: [new Float32Array(fftSize).fill(NaN)] },
  ])('rejects invalid PCM ranges', invalid => {
    expect(() => analyzeSpectrum(invalid as unknown as PcmAudio, options)).toThrow(RangeError);
  });
  it('rejects spectral timing that cannot be represented by Number', () => {
    expect(() => analyzeSpectrum({ ...input, sampleRate: Number.MIN_VALUE }, options)).toThrow(RangeError);
  });
});

describe('reusable spectral sessions', () => {
  it.each([4, 997, 1024, 4096])('matches public calls and independent references with length %s', frameLength => {
    let seed = 0x2402;
    const randomChannel = () => Float32Array.from({ length: 9000 }, () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x100000000 - 0.5;
    });
    for (const channels of [[randomChannel()], [randomChannel(), randomChannel()]] as const) {
      const input: PcmAudio = { sampleRate, channels };
      const before = channels.map(channel => channel.slice());
      const session = createSpectrumAnalyzer(input, { fftSize, frameLength });
      for (const frameOffset of [0, 13, 2048, 9000 - frameLength, 0]) {
        const result = session.analyzeFrame(frameOffset);
        expect(result).toEqual(analyzeSpectrum(input, { fftSize, frameLength, frameOffset }));
        for (const [index, channel] of channels.entries()) {
          const selected = channel.subarray(frameOffset, frameOffset + frameLength);
          close(result.channels[index]!.totalPower, referenceTotal(selected));
          for (const k of [0, 1, 85, fftSize / 2]) {
            close(result.channels[index]!.power[k]!, referenceBin(selected, fftSize, k));
          }
        }
      }
      expect(channels).toEqual(before);
    }
  });

  it('keeps earlier frames and caller edits independent of scratch and later results', () => {
    const input: PcmAudio = { sampleRate, channels: [tone(187.5, fftSize * 2), tone(1500, fftSize * 2)] };
    // Frame B is silence, so scratch aliasing cannot hide behind equal outputs.
    input.channels[0].fill(0, fftSize);
    input.channels[1]!.fill(0, fftSize);
    const session = createSpectrumAnalyzer(input, { fftSize });
    const first = session.analyzeFrame(0);
    const snapshot = structuredClone(first);
    const second = session.analyzeFrame(fftSize);
    expect(second.channels.every(channel => channel.totalPower === 0)).toBe(true);
    expect(first).toEqual(snapshot);
    first.frequencyHz.fill(-1);
    first.channels[0]!.power.fill(-1);
    (first.channels[0]!.bands[0] as { power: number }).power = -1;
    (first.window as { coherentGain: number }).coherentGain = -1;
    expect(session.analyzeFrame(0)).toEqual(snapshot);
    expect(createSpectrumAnalyzer(input, { fftSize }).analyzeFrame(0)).toEqual(snapshot);
  });

  it.each(['silence', 'DC', 'Nyquist'] as const)('handles repeated %s frames and endpoint weights', kind => {
    const samples = Float32Array.from({ length: 2048 }, (_, n) => kind === 'silence' ? 0 : kind === 'DC' ? 1 : (-1) ** n);
    const session = createSpectrumAnalyzer(mono(samples), { fftSize: 1024 });
    for (const frameOffset of [0, 1, 1024]) {
      const result = session.analyzeFrame(frameOffset).channels[0]!;
      close(result.totalPower, kind === 'silence' ? 0 : 1);
      if (kind !== 'silence') close(result.power[kind === 'DC' ? 0 : 512]!, 2 / 3);
      expect(result).toEqual(analyzeSpectrum(mono(samples), { fftSize: 1024, frameOffset }).channels[0]);
    }
  });

  it('validates the recording only once, but every public single call validates again', () => {
    const validation = vi.spyOn(pcm, 'validatePcm');
    try {
      const input = mono(tone(1000, fftSize * 2));
      const session = createSpectrumAnalyzer(input, { fftSize });
      session.analyzeFrame(0);
      session.analyzeFrame(1);
      session.analyzeFrame(fftSize);
      expect(validation).toHaveBeenCalledTimes(1);
      analyzeSpectrum(input, options);
      analyzeSpectrum(input, options);
      expect(validation).toHaveBeenCalledTimes(3);
    } finally {
      validation.mockRestore();
    }
  });

  it('rejects invalid samples outside the frame at either safe public boundary', () => {
    const samples = tone(1000, fftSize * 2);
    samples[samples.length - 1] = NaN;
    expect(() => createSpectrumAnalyzer(mono(samples), { fftSize })).toThrow(RangeError);
    expect(() => analyzeSpectrum(mono(samples), options)).toThrow(RangeError);
  });

  it('captures metadata and rejects invalid offsets, mutated nonfinite samples, and detached buffers', () => {
    const samples = tone(1000, fftSize * 2);
    const input = { sampleRate, channels: [samples] as [Float32Array] };
    const session = createSpectrumAnalyzer(input, { fftSize });
    const before = session.analyzeFrame(0);
    input.sampleRate = 1;
    input.channels[0] = new Float32Array(1);
    expect(session.analyzeFrame(0)).toEqual(before);
    for (const offset of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER, fftSize + 1]) {
      expect(() => session.analyzeFrame(offset)).toThrow(RangeError);
    }
    expect(() => session.analyzeFrame('0' as unknown as number)).toThrow(TypeError);
    samples[1] = NaN;
    expect(() => session.analyzeFrame(0)).toThrow(RangeError);
    samples[1] = 0;
    structuredClone(samples.buffer, { transfer: [samples.buffer] });
    expect(() => session.analyzeFrame(0)).toThrow(RangeError);
  });

  it('retains configuration and PCM runtime validation at the session boundary', () => {
    const input = mono(new Float32Array(fftSize));
    for (const settings of [null, undefined, [], {}, { fftSize: '4096' }, { fftSize, frameLength: null }]) {
      expect(() => createSpectrumAnalyzer(input, settings as unknown as SpectrumSettings)).toThrow(TypeError);
    }
    for (const settings of [{ fftSize: 3 }, { fftSize, frameLength: 3 }, { fftSize, frameLength: fftSize + 1 }]) {
      expect(() => createSpectrumAnalyzer(input, settings)).toThrow(RangeError);
    }
    for (const invalid of [null, {}, { sampleRate, channels: [null] }]) {
      expect(() => createSpectrumAnalyzer(invalid as unknown as PcmAudio, { fftSize })).toThrow(TypeError);
    }
    expect(() => createSpectrumAnalyzer(mono(new Float32Array(1024)), { fftSize })).toThrow(RangeError);
    expect(() => createSpectrumAnalyzer(mono(new Float32Array(fftSize), Number.MIN_VALUE), { fftSize })).toThrow(RangeError);
  });
});
