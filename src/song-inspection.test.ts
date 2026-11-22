import { describe, expect, it, vi } from 'vitest';
import { sineWave } from './audio/fixtures';
import type { PcmAudio } from './audio/pcm';
import { createSongInspection } from './song-inspection';

const tone = (frequencyHz: number, amplitude: number, frameCount = 16384) =>
  sineWave({ sampleRate: 48000, frequencyHz, amplitude, frameCount });
const near = (actual: number, expected: number, tolerance = 1e-7) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);

describe('song inspection', () => {
  it('measures independent stereo tones analytically and preserves source storage', () => {
    const left = tone(187.5, 0.5);
    const right = tone(3000, 0.25);
    const before = [left.slice(), right.slice()];
    const session = createSongInspection({ sampleRate: 48000, channels: [left, right] });
    const frame = session.inspect(0)!;
    [0.5, 0.25].forEach((amplitude, index) => {
      const measurement = session.measurements.channels[index]!;
      near(measurement.samplePeak, amplitude, 1e-6);
      near(measurement.rms, amplitude / Math.sqrt(2), 1e-6);
      near(measurement.meanSquareEnergy, amplitude ** 2 / 2);
      for (const band of frame.channels[index]!) {
        near(band.power, band.name === (index === 0 ? 'Bass' : 'High mids') ? amplitude ** 2 / 2 : 0);
      }
    });
    session.inspect(session.maxStartSeconds);
    expect(left).toEqual(before[0]);
    expect(right).toEqual(before[1]);
    expect(session.durationSeconds).toBe(16384 / 48000);
  });

  it('preserves exact silence and unclipped finite over-range samples', () => {
    const silent = createSongInspection({ sampleRate: 48000, channels: [new Float32Array(8192)] });
    expect(silent.measurements.channels[0]).toEqual({ samplePeak: 0, rms: 0, meanSquareEnergy: 0 });
    expect(silent.inspect(0)!.channels[0]!.every(band => band.power === 0)).toBe(true);
    const loud = createSongInspection({ sampleRate: 48000, channels: [tone(187.5, 2, 8192)] });
    near(loud.measurements.channels[0]!.samplePeak, 2, 1e-6);
    near(loud.inspect(0)!.channels[0]![1]!.power, 2);
  });

  it('selects actual sample-grid windows, clamps the final window, and changes content', () => {
    const samples = new Float32Array(16384);
    samples.set(tone(187.5, 0.5, 8192));
    samples.set(tone(3000, 0.25, 8192), 8192);
    const session = createSongInspection({ sampleRate: 48000, channels: [samples] });
    near(session.inspect(0)!.channels[0]![1]!.power, 0.125);
    const end = session.inspect(session.maxStartSeconds)!;
    expect(end.frameOffset).toBe(8192);
    expect(end.endTimeSeconds).toBe(16384 / 48000);
    near(end.channels[0]![4]!.power, 0.03125);
    near(end.channels[0]![1]!.power, 0);
    expect(session.inspect(Number.MAX_VALUE)!.frameOffset).toBe(8192);
    const fractional = session.inspect(1.9 / 48000)!;
    expect(fractional.frameOffset).toBe(1);
    expect(fractional.startTimeSeconds).toBe(1 / 48000);
    expect(fractional.endTimeSeconds).toBe(8193 / 48000);
  });

  it('handles exact-fit and short recordings without inferred padding', () => {
    expect(createSongInspection({ sampleRate: 48000, channels: [tone(187.5, 0.5, 8192)] }).inspect(9)!.frameOffset).toBe(0);
    const short = createSongInspection({ sampleRate: 48000, channels: [new Float32Array([2])] });
    expect(short.inspect(0)).toBeUndefined();
    expect(short.maxStartSeconds).toBe(0);
    expect(short.measurements.channels[0]!.samplePeak).toBe(2);
  });

  it.each([-1, NaN, Infinity, -Infinity])('rejects invalid time %s', time => {
    const session = createSongInspection({ sampleRate: 48000, channels: [new Float32Array(8192)] });
    expect(() => session.inspect(time)).toThrow(RangeError);
  });

  it('rejects malformed time and PCM with intentional error classes', () => {
    const session = createSongInspection({ sampleRate: 48000, channels: [new Float32Array(8192)] });
    expect(() => session.inspect('1' as unknown as number)).toThrow(TypeError);
    expect(() => createSongInspection({ sampleRate: 48000, channels: [new Float32Array([NaN])] })).toThrow(RangeError);
    expect(() => createSongInspection(null as unknown as PcmAudio)).toThrow(TypeError);
  });

  it('reuses validated analyzer state and returns independent band results', () => {
    const samples = tone(187.5, 0.5);
    const iterator = vi.spyOn(samples, Symbol.iterator);
    const session = createSongInspection({ sampleRate: 48000, channels: [samples] });
    const scans = iterator.mock.calls.length;
    const first = session.inspect(0)!;
    (first.channels[0]![1]! as { power: number }).power = 123;
    near(session.inspect(0.01)!.channels[0]![1]!.power, 0.125);
    expect(iterator.mock.calls.length).toBe(scans);
  });
});

it('maps exact transport samples independently of seconds rounding, end and loop seam', () => {
  const samples = new Float32Array(16384);
  samples.set(tone(187.5, 0.5, 8192)); samples.set(tone(3000, 0.25, 8192), 8192);
  const inspection = createSongInspection({ sampleRate: 48000, channels: [samples] });
  expect(inspection.inspectSample(27)!.frameOffset).toBe(27);
  expect(inspection.inspectSample(16384)!.frameOffset).toBe(8192);
  const loopStart = inspection.inspectSample(0)!;
  near(loopStart.channels[0]![1]!.power, 0.125);
  const end = inspection.inspectSample(16384)!;
  near(end.channels[0]![4]!.power, 0.03125);
  for (const band of end.channels[0]!) if (band.name !== 'High mids') near(band.power, 0);
  expect(() => inspection.inspectSample(0.5)).toThrow(RangeError);
  expect(() => inspection.inspectSample(16385)).toThrow(RangeError);
});
