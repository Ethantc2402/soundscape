import FFT from 'fft.js';
import { describe, expect, it, vi } from 'vitest';
import * as pcm from './pcm';
import type { PcmAudio } from './pcm';
import { analyzeSpectrum, createSpectrumAnalyzer } from './spectrum';
import { createSpectrumTimeline } from './timeline';
import type { TimelineSettings } from './timeline';

const settings = { fftSize: 1024, frameLength: 4, hopSize: 4 };
const mono = (length: number, sampleRate = 48000): PcmAudio => ({ sampleRate, channels: [new Float32Array(length)] });

describe('spectral timeline scheduling', () => {
  it.each([
    [3, 4, []], [4, 4, [0]], [11, 4, [0, 4]], [12, 4, [0, 4, 8]],
    [8, 2, [0, 2, 4]], [15, 6, [0, 6]], [8, 100, [0]],
    [8, Number.MAX_SAFE_INTEGER, [0]],
  ])('schedules length %s hop %s', (length, hopSize, offsets) => {
    const iterator = createSpectrumTimeline(mono(length), { ...settings, hopSize });
    const frames = [...iterator];
    expect(frames.map(frame => frame.frameOffset)).toEqual(offsets);
    frames.forEach((frame, index) => {
      expect(frame.index).toBe(index);
      expect(frame.startTimeSeconds).toBe(offsets[index]! / 48000);
      expect(frame.endTimeSeconds).toBe((offsets[index]! + 4) / 48000);
      expect(frame.spectrum.zeroPaddingSamples).toBe(1020);
    });
    expect([...iterator]).toEqual([]);
  });

  it.each(['inherited', 'non-enumerable'] as const)('reads %s settings like the spectral API', kind => {
    const options: TimelineSettings = kind === 'inherited'
      ? Object.create(settings)
      : Object.defineProperties({}, {
        fftSize: { value: 1024 }, frameLength: { value: 4 }, hopSize: { value: 4 },
      });
    const input = mono(8);
    const expected = createSpectrumAnalyzer(input, options).analyzeFrame(0);
    const frames = [...createSpectrumTimeline(input, options)];
    expect(frames.map(frame => frame.frameOffset)).toEqual([0, 4]);
    expect(frames[0]!.spectrum).toEqual(expected);
  });

  it('honors an inherited observation length instead of silently defaulting it', () => {
    const options: TimelineSettings = Object.assign(Object.create({ frameLength: 4 }),
      { fftSize: 1024, hopSize: 4 });
    expect([...createSpectrumTimeline(mono(8), options)].map(frame => frame.frameOffset)).toEqual([0, 4]);
  });

  it('defaults observed length to FFT size', () => {
    const frames = [...createSpectrumTimeline(mono(2048), { fftSize: 1024, hopSize: 1024 })];
    expect(frames.map(f => f.frameOffset)).toEqual([0, 1024]);
    expect(frames[1]!.endTimeSeconds).toBe(2048 / 48000);
  });

  it.each([3, 12])('scans full PCM once for length %s', length => {
    const spy = vi.spyOn(pcm, 'validatePcm');
    try {
      const iterator = createSpectrumTimeline(mono(length), settings);
      expect(spy).toHaveBeenCalledTimes(1);
      [...iterator];
      expect(spy).toHaveBeenCalledTimes(1);
    } finally { spy.mockRestore(); }
  });

  it('computes lazily and closes on early termination', () => {
    const transform = vi.spyOn(FFT.prototype, 'realTransform');
    try {
      const iterator = createSpectrumTimeline(mono(12), settings);
      expect(transform).toHaveBeenCalledTimes(0);
      for (const frame of iterator) {
        expect(frame.index).toBe(0);
        expect(transform).toHaveBeenCalledTimes(1);
        break;
      }
      expect(transform).toHaveBeenCalledTimes(1);
      expect(iterator.next().done).toBe(true);
    } finally {
      transform.mockRestore();
    }
  });
});

describe('timeline validation', () => {
  it.each([undefined, null, [], {}, { ...settings, hopSize: '4' }, { ...settings, fftSize: '1024' },
    { ...settings, frameLength: null }])('rejects malformed settings eagerly %j', value => {
    expect(() => createSpectrumTimeline(mono(1), value as unknown as TimelineSettings)).toThrow(TypeError);
  });
  it.each([0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects hop %s', hopSize => {
    expect(() => createSpectrumTimeline(mono(1), { ...settings, hopSize })).toThrow(RangeError);
  });
  it.each([{ ...settings, fftSize: 3 }, { ...settings, frameLength: 3 },
    { ...settings, frameLength: 1025 }, { ...settings, frameLength: NaN }])('rejects settings on short input', value => {
    expect(() => createSpectrumTimeline(mono(1), value)).toThrow(RangeError);
  });
  it.each([null, undefined, {}, { sampleRate: 48000, channels: [null] },
    { sampleRate: 48000, channels: [new Float32Array(1), null] }])('rejects malformed PCM', value => {
    expect(() => createSpectrumTimeline(value as unknown as PcmAudio, settings)).toThrow(TypeError);
  });
  it.each([mono(0), { sampleRate: 0, channels: [new Float32Array(1)] },
    { sampleRate: 48000, channels: [] },
    { sampleRate: 48000, channels: [new Float32Array(1), new Float32Array(2)] },
    { sampleRate: 48000, channels: [new Float32Array(12).fill(NaN)] }])('rejects invalid PCM', value => {
    expect(() => createSpectrumTimeline(value as PcmAudio, settings)).toThrow(RangeError);
  });
  it('rejects a nonfinite sample in the discarded tail at construction', () => {
    const input = mono(11);
    input.channels[0][10] = NaN;

    expect(() => createSpectrumTimeline(input, settings)).toThrow(RangeError);
  });
  it.each([1, 12])('rejects unrepresentable spectral timing with length %s', length => {
    expect(() => createSpectrumTimeline(mono(length, Number.MIN_VALUE), settings)).toThrow(RangeError);
  });
  it('rejects end-time overflow even when individual frame duration is finite', () => {
    expect(() => createSpectrumTimeline(mono(12, 4e-308), settings)).toThrow(/Timeline times/);
  });
  it('preserves the existing session short-input rejection', () => {
    expect(() => createSpectrumAnalyzer(mono(3), settings)).toThrow(RangeError);
  });
  it.each(['nonfinite', 'detached'])('guards selected storage after construction: %s', kind => {
    const input = mono(8);
    const iterator = createSpectrumTimeline(input, settings);
    iterator.next();
    if (kind === 'nonfinite') input.channels[0][5] = Infinity;
    else structuredClone(input.channels[0].buffer, { transfer: [input.channels[0].buffer] });
    expect(() => iterator.next()).toThrow(RangeError);
  });
});

describe('timeline numerical and ownership contracts', () => {
  it.each([false, true])('matches public spectra with changing analytic frames, stereo=%s', stereo => {
    const left = Float32Array.from({ length: 3072 }, (_, n) =>
      n < 1024 ? 2 * Math.sin(2 * Math.PI * 16 * n / 1024) : n < 2048 ? 0 : -2);
    const right = new Float32Array(3072).fill(0.5);
    const input: PcmAudio = { sampleRate: 48000, channels: stereo ? [left, right] : [left] };
    const before = input.channels.map(c => c.slice());
    const frames = [...createSpectrumTimeline(input, { fftSize: 1024, hopSize: 1024 })];
    frames.forEach(frame => expect(frame.spectrum).toEqual(analyzeSpectrum(input,
      { fftSize: 1024, frameOffset: frame.frameOffset })));
    for (const [index, expected] of [2, 0, 4].entries()) {
      expect(Math.abs(frames[index]!.spectrum.channels[0]!.totalPower - expected)).toBeLessThanOrEqual(1e-7);
      if (stereo) expect(Math.abs(frames[index]!.spectrum.channels[1]!.totalPower - 0.25)).toBeLessThanOrEqual(1e-12);
    }
    expect(input.channels).toEqual(before);
  });
  it.each([4, 997, 1024])('matches overlapping padded stereo frames of length %s', frameLength => {
    const channels = [
      Float32Array.from({ length: 2200 }, (_, n) => 0.25 + Math.sin(n / 17)),
      Float32Array.from({ length: 2200 }, (_, n) => 2 * Math.cos(n / 11)),
    ] as const;
    const input = { sampleRate: 48000, channels };
    for (const frame of createSpectrumTimeline(input, { fftSize: 1024, frameLength, hopSize: 499 })) {
      expect(frame.spectrum).toEqual(analyzeSpectrum(input,
        { fftSize: 1024, frameLength, frameOffset: frame.frameOffset }));
      // Independent window-weighted mean square (Parseval), tolerance 1e-12.
      channels.forEach((channel, index) => {
        let sum = 0;
        let weights = 0;
        for (let n = 0; n < frameLength; n++) {
          const w = 0.5 * (1 - Math.cos(2 * Math.PI * n / frameLength));
          sum += (channel[frame.frameOffset + n]! * w) ** 2;
          weights += w ** 2;
        }
        expect(Math.abs(frame.spectrum.channels[index]!.totalPower - sum / weights)).toBeLessThanOrEqual(1e-12);
      });
    }
  });
  it('preserves padded spectra and independent caller-owned outputs', () => {
    const input = mono(12);
    input.channels[0].fill(2, 0, 4);
    const iterator = createSpectrumTimeline(input, settings);
    const first = iterator.next().value!;
    const snapshot = structuredClone(first);
    const second = iterator.next().value!;
    expect(first).toEqual(snapshot);
    first.spectrum.frequencyHz.fill(-1);
    first.spectrum.channels[0]!.power.fill(-1);
    Reflect.set(first.spectrum.window, 'coherentGain', -1);
    Reflect.set(first.spectrum.channels[0]!.bands[0]!, 'power', -1);
    expect(second.spectrum).toEqual(analyzeSpectrum(input, { ...settings, frameOffset: 4 }));
    expect(iterator.next().value!.spectrum).toEqual(analyzeSpectrum(input, { ...settings, frameOffset: 8 }));
    expect(Math.abs(snapshot.spectrum.channels[0]!.totalPower - 4)).toBeLessThanOrEqual(1e-12);
  });
  it('captures settings and metadata at construction', () => {
    const input = { sampleRate: 48000, channels: [new Float32Array(8)] as [Float32Array] };
    const options = { ...settings };
    const iterator = createSpectrumTimeline(input, options);
    options.hopSize = 100;
    input.sampleRate = 1;
    input.channels[0] = new Float32Array(1);
    const frames = [...iterator];
    expect(frames.map(f => f.frameOffset)).toEqual([0, 4]);
    expect(frames[1]!.endTimeSeconds).toBe(8 / 48000);
    expect(frames[1]!.spectrum.sampleRate).toBe(48000);
  });
});
