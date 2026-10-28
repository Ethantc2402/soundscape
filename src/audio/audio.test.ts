import { describe, expect, it } from 'vitest';
import { sineWave } from './fixtures';
import { measureAudio, perChannelMeanSquareEnergy, rms, samplePeak } from './measurements';
import type { PcmAudio } from './pcm';
import { validatePcm } from './pcm';

// Absolute error limits for Float32 fixtures and Number accumulation.
const AMPLITUDE_TOLERANCE = 1e-6;
const ENERGY_TOLERANCE = 1e-7;
const sampleRate = 48000;
const frameCount = 48000;
const fixture = (amplitude = 1) => sineWave({
  sampleRate, frameCount, frequencyHz: 1000, amplitude,
});

function close(actual: number, expected: number, tolerance: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

describe('PCM measurements', () => {
  it.each([1, 0.5, 0.25])('measures an integer-cycle sine with amplitude %s', amplitude => {
    const input: PcmAudio = { sampleRate, channels: [fixture(amplitude)] };
    close(samplePeak(input)[0]!, amplitude, AMPLITUDE_TOLERANCE);
    close(rms(input)[0]!, amplitude / Math.sqrt(2), AMPLITUDE_TOLERANCE);
    close(perChannelMeanSquareEnergy(input)[0]!, amplitude ** 2 / 2, ENERGY_TOLERANCE);
    const result = measureAudio(input);
    expect(result.sampleRate).toBe(sampleRate);
    expect(result.frameCount).toBe(frameCount);
    expect(result.channels).toHaveLength(1);
    close(result.channels[0]!.samplePeak, amplitude, AMPLITUDE_TOLERANCE);
    close(result.channels[0]!.rms, amplitude / Math.sqrt(2), AMPLITUDE_TOLERANCE);
    close(result.channels[0]!.meanSquareEnergy, amplitude ** 2 / 2, ENERGY_TOLERANCE);
  });

  it('measures mono and stereo silence exactly', () => {
    for (const channels of [[new Float32Array(8)], [new Float32Array(8), new Float32Array(8)]] as const) {
      const input = { sampleRate, channels };
      expect(samplePeak(input)).toEqual(channels.map(() => 0));
      expect(rms(input)).toEqual(channels.map(() => 0));
      expect(perChannelMeanSquareEnergy(input)).toEqual(channels.map(() => 0));
    }
  });

  it.each([0, 1])('preserves stereo ordering with only channel %s active', active => {
    const signal = fixture(0.5);
    const silence = new Float32Array(frameCount);
    const input: PcmAudio = {
      sampleRate, channels: active === 0 ? [signal, silence] : [silence, signal],
    };
    const result = measureAudio(input);
    expect(result.channels).toHaveLength(2);
    result.channels.forEach((channel, index) => {
      close(channel.samplePeak, index === active ? 0.5 : 0, AMPLITUDE_TOLERANCE);
      close(channel.rms, index === active ? 0.5 / Math.sqrt(2) : 0, AMPLITUDE_TOLERANCE);
      close(channel.meanSquareEnergy, index === active ? 0.125 : 0, ENERGY_TOLERANCE);
    });
    expect(samplePeak(input)).toEqual(result.channels.map(c => c.samplePeak));
    expect(rms(input)).toEqual(result.channels.map(c => c.rms));
    expect(perChannelMeanSquareEnergy(input)).toEqual(result.channels.map(c => c.meanSquareEnergy));
  });

  it('uses absolute peak, accepts finite over-range samples, and does not mutate input', () => {
    const samples = new Float32Array([-2, 1, 0]);
    const before = samples.slice();
    const input: PcmAudio = { sampleRate, channels: [samples] };
    expect(samplePeak(input)).toEqual([2]);
    close(rms(input)[0]!, Math.sqrt(5 / 3), AMPLITUDE_TOLERANCE);
    close(perChannelMeanSquareEnergy(input)[0]!, 5 / 3, ENERGY_TOLERANCE);
    measureAudio(input);
    expect(samples).toEqual(before);
  });

  const equivalenceInputs: [string, PcmAudio][] = [
    ['mono sine', { sampleRate, channels: [fixture()] }],
    ['mono silence', { sampleRate, channels: [new Float32Array(4)] }],
    ['stereo silence', { sampleRate, channels: [new Float32Array(4), new Float32Array(4)] }],
    ['different stereo signals', { sampleRate, channels: [fixture(0.25), fixture(0.5)] }],
    ['signed over-range stereo', {
      sampleRate, channels: [new Float32Array([-2, 1, 0]), new Float32Array([0.5, -3, 1])],
    }],
  ];

  it.each(equivalenceInputs)('matches public measurements and preserves %s', (_label, input) => {
    const before = input.channels.map(channel => channel.slice());
    const result = measureAudio(input);
    const peaks = samplePeak(input);
    const rmsValues = rms(input);
    const meanSquares = perChannelMeanSquareEnergy(input);
    expect(result).toEqual({
      sampleRate: input.sampleRate,
      frameCount: input.channels[0].length,
      channels: peaks.map((peak, index) => ({
        samplePeak: peak,
        rms: rmsValues[index],
        meanSquareEnergy: meanSquares[index],
      })),
    });
    expect(input.channels).toEqual(before);
  });

  const invalidRanges: [string, unknown][] = [
    ...[0, -1, NaN, Infinity, -Infinity].map(rate => [
      `sample rate ${rate}`, { sampleRate: rate, channels: [new Float32Array(1)] },
    ] as [string, unknown]),
    ['empty mono', { sampleRate, channels: [new Float32Array()] }],
    ['empty stereo', { sampleRate, channels: [new Float32Array(), new Float32Array()] }],
    ['mismatched lengths', { sampleRate, channels: [new Float32Array(2), new Float32Array(3)] }],
    ['no channels', { sampleRate, channels: [] }],
    ['three channels', { sampleRate, channels: Array.from({ length: 3 }, () => new Float32Array(1)) }],
    ...[NaN, Infinity, -Infinity].map(value => [
      `nonfinite sample ${value}`, { sampleRate, channels: [new Float32Array([value])] },
    ] as [string, unknown]),
  ];

  const invalidTypes: [string, unknown, string][] = [
    ...[undefined, null, true, 1, 'pcm', [], () => undefined].map(input => [
      `top-level ${String(input)}`, input, 'PCM input must be an object.',
    ] as [string, unknown, string]),
    ...[undefined, null, '48000', true, {}].map(rate => [
      `sample-rate type ${String(rate)}`, { sampleRate: rate, channels: [new Float32Array(1)] },
      'Sample rate must be a number.',
    ] as [string, unknown, string]),
    ...[undefined, null, 1, 'channels', {}, new Float32Array(1), { 0: new Float32Array(1), length: 1 }].map(channels => [
      `channels container ${String(channels)}`, { sampleRate, channels }, 'PCM channels must be an array.',
    ] as [string, unknown, string]),
    ...[undefined, null, 1, [0], new Float64Array(1), {}].map(channel => [
      `first channel ${String(channel)}`, { sampleRate, channels: [channel] },
      'PCM channels must be Float32Array instances.',
    ] as [string, unknown, string]),
    ['missing input fields', {}, 'Sample rate must be a number.'],
    ['malformed second channel', { sampleRate, channels: [new Float32Array(1), null] },
      'PCM channels must be Float32Array instances.'],
    ['sparse channel array', { sampleRate, channels: new Array(1) },
      'PCM channels must be Float32Array instances.'],
  ];

  describe.each([
    { name: 'samplePeak', measure: samplePeak },
    { name: 'rms', measure: rms },
    { name: 'perChannelMeanSquareEnergy', measure: perChannelMeanSquareEnergy },
    { name: 'measureAudio', measure: measureAudio },
    { name: 'validatePcm', measure: validatePcm },
  ])('$name validation', ({ measure }) => {
    it.each(invalidRanges)('rejects %s with RangeError', (_label, input) => {
      // Deliberately model untyped callers to test the runtime boundary.
      expect(() => measure(input as PcmAudio)).toThrow(RangeError);
    });
    it.each(invalidTypes)('rejects %s with an intentional TypeError', (_label, input, message) => {
      expect(() => measure(input as PcmAudio)).toThrow(TypeError);
      expect(() => measure(input as PcmAudio)).toThrow(message);
    });
  });
});

describe('sine fixture', () => {
  it('is deterministic, supports phase, and allocates independent arrays', () => {
    const options = { sampleRate: 8, frameCount: 4, frequencyHz: 2, amplitude: 0.5, phaseRadians: Math.PI / 2 };
    const first = sineWave(options);
    const second = sineWave(options);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    [0.5, 0, -0.5, 0].forEach((value, index) => close(first[index]!, value, AMPLITUDE_TOLERANCE));
  });

  it('supports zero amplitude and DC frequency', () => {
    expect(sineWave({ sampleRate, frameCount: 4, frequencyHz: 1000, amplitude: 0 })).toEqual(new Float32Array(4));
    expect(sineWave({ sampleRate, frameCount: 4, frequencyHz: 0, amplitude: 0.5, phaseRadians: Math.PI / 2 }))
      .toEqual(new Float32Array([0.5, 0.5, 0.5, 0.5]));
  });

  it.each([
    { sampleRate: 0 }, { sampleRate: NaN }, { sampleRate: Infinity },
    { frameCount: 0 }, { frameCount: -1 }, { frameCount: 1.5 }, { frameCount: Infinity },
    { frequencyHz: -1 }, { frequencyHz: sampleRate / 2 }, { frequencyHz: NaN }, { frequencyHz: Infinity },
    { amplitude: -1 }, { amplitude: Infinity }, { amplitude: NaN },
    { amplitude: 1e39, phaseRadians: Math.PI / 2 },
    { phaseRadians: NaN }, { phaseRadians: Infinity },
  ])('rejects invalid options %j', override => {
    expect(() => sineWave({ sampleRate, frameCount: 8, frequencyHz: 1000, ...override })).toThrow(RangeError);
  });
});
