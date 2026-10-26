import { describe, expect, it } from 'vitest';
import { sineWave } from './fixtures';
import { measureAudio, perChannelMeanSquareEnergy, rms, samplePeak } from './measurements';
import type { PcmAudio } from './pcm';

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

  const invalidInputs: [string, unknown][] = [
    ...[0, -1, NaN, Infinity, -Infinity].map(rate => [
      `sample rate ${rate}`, { sampleRate: rate, channels: [new Float32Array(1)] },
    ] as [string, unknown]),
    ['empty mono', { sampleRate, channels: [new Float32Array()] }],
    ['empty stereo', { sampleRate, channels: [new Float32Array(), new Float32Array()] }],
    ['mismatched lengths', { sampleRate, channels: [new Float32Array(2), new Float32Array(3)] }],
    ['no channels', { sampleRate, channels: [] }],
    ['three channels', { sampleRate, channels: Array.from({ length: 3 }, () => new Float32Array(1)) }],
    ['wrong sample storage', { sampleRate, channels: [[0]] }],
    ...[NaN, Infinity, -Infinity].map(value => [
      `nonfinite sample ${value}`, { sampleRate, channels: [new Float32Array([value])] },
    ] as [string, unknown]),
  ];

  describe.each([samplePeak, rms, perChannelMeanSquareEnergy, measureAudio])('%s validation', measure => {
    it.each(invalidInputs)('rejects %s', (_label, input) => {
      // Deliberately model untyped callers to test the runtime boundary.
      expect(() => measure(input as PcmAudio)).toThrow();
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
