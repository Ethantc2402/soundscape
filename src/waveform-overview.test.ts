import { expect, it } from 'vitest';
import { createWaveformOverview } from './waveform-overview';
import type { PcmAudio } from './audio/pcm';

it('retains signed extrema and independent channel order, silence, singleton and N<B', () => {
  const left = new Float32Array([0, -2, 3, 0]);
  const right = new Float32Array(4);
  const pcm: PcmAudio = { sampleRate: 48000, channels: [left, right] };
  const summary = createWaveformOverview(pcm);
  expect(summary.bucketCount).toBe(4);
  expect(summary.channels[0]!.min).toEqual(left);
  expect(summary.channels[0]!.max).toEqual(left);
  expect(summary.channels[1]!.min).toEqual(right);
  summary.channels[0]!.min.fill(100);
  expect(left).toEqual(new Float32Array([0, -2, 3, 0]));
  expect(createWaveformOverview(pcm).channels[0]!.min).toEqual(left);
  expect(createWaveformOverview({ sampleRate: 1, channels: [new Float32Array([-3])] }).channels[0]!.max[0]).toBe(-3);
  const reversed = createWaveformOverview({ sampleRate: 1, channels: [right, left] });
  expect(reversed.channels[0]!.max).toEqual(right);
  expect(reversed.channels[1]!.max).toEqual(left);
});
it('covers bucket boundaries and nondivisible final tails exactly with bounded storage', () => {
  // N=4097 B=2048: all buckets have two samples except the last has three.
  const samples = new Float32Array(4097);
  samples[1] = -2; samples[2] = 3; samples[4094] = -4; samples[4096] = 5;
  const summary = createWaveformOverview({ sampleRate: 48000, channels: [samples, samples] });
  expect(summary.channels[0]!.min[0]).toBe(-2);
  expect(summary.channels[0]!.max[0]).toBe(0);
  expect(summary.channels[0]!.max[1]).toBe(3);
  expect(summary.channels[0]!.min[2047]).toBe(-4);
  expect(summary.channels[0]!.max[2047]).toBe(5);
  expect(summary.channels.reduce((n, c) => n + c.min.byteLength + c.max.byteLength, 0)).toBe(32768);
});
it('rejects malformed and unequal channels without mutation', () => {
  expect(() => createWaveformOverview({ sampleRate: 1, channels: [new Float32Array(1), new Float32Array(2)] })).toThrow(RangeError);
  expect(() => createWaveformOverview({ sampleRate: 1, channels: [new Float32Array([Infinity])] })).toThrow(RangeError);
});
