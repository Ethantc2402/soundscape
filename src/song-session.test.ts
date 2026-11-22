import { expect, it, vi } from 'vitest';
import { createSongSession, prepareSongSession } from './song-session';

it('owns stable analysis and waveform, creates no context until Play and releases on disposal', () => {
  const constructor = vi.fn(() => { throw new Error('Context must be lazy'); });
  vi.stubGlobal('AudioContext', constructor);
  try {
    const session = createSongSession('short.wav', { sampleRate: 48000, channels: [new Float32Array([0, 2, -1])] });
    expect(session.inspection.inspect(0)).toBeUndefined();
    expect(session.waveform.channels[0]!.max).toEqual(new Float32Array([0, 2, -1]));
    const transport = session.playback();
    expect(session.playback()).toBe(transport);
    expect(constructor).not.toHaveBeenCalled();
    transport.seek(1 / 48000);
    expect(transport.snapshot().sample).toBe(1);
    session.dispose(); session.dispose();
    expect(() => session.inspection).toThrow('disposed');
    expect(() => session.waveform).toThrow('disposed');
    expect(() => session.playback()).toThrow('disposed');
  } finally { vi.unstubAllGlobals(); }
});


it('prepares analytic stereo results cooperatively without sharing waveform or mutating PCM', async () => {
  const left = new Float32Array(262145).fill(-2);
  const right = new Float32Array(left.length).fill(0.5);
  const song = await prepareSongSession('stereo.wav', { sampleRate: 48000, channels: [left, right] },
    () => true, async () => {});
  expect(song!.inspection.measurements.channels).toEqual([
    { samplePeak: 2, rms: 2, meanSquareEnergy: 4 },
    { samplePeak: 0.5, rms: 0.5, meanSquareEnergy: 0.25 },
  ]);
  expect(song!.inspection.inspectSample(left.length)!.frameOffset).toBe(left.length - 8192);
  song!.waveform.channels[0]!.min.fill(9);
  expect(left.every(sample => sample === -2)).toBe(true);
  expect(right.every(sample => sample === 0.5)).toBe(true);
  song!.dispose();
});

it.each([1, 2, 4])('abandons obsolete preparation at task boundary %s', async boundary => {
  // Force a deadline at each step, without timing-sensitive assertions.
  let now = 0;
  const clock = vi.spyOn(performance, 'now').mockImplementation(() => now += 5);
  let current = true;
  let yields = 0;
  try {
    const result = await prepareSongSession('obsolete.wav',
      { sampleRate: 48000, channels: [new Float32Array(262145)] }, () => current,
      async () => { if (++yields === boundary) current = false; });
    expect(result).toBeUndefined();
    expect(yields).toBe(boundary);
  } finally { clock.mockRestore(); }
});

it('does no work for already obsolete PCM and propagates preparation failures', async () => {
  const invalid = { sampleRate: 48000, channels: [new Float32Array([NaN])] as const };
  const yieldTask = vi.fn(async () => {});
  expect(await prepareSongSession('obsolete.wav', invalid, () => false, yieldTask)).toBeUndefined();
  expect(yieldTask).not.toHaveBeenCalled();
  await expect(prepareSongSession('invalid.wav', invalid, () => true, yieldTask)).rejects.toThrow(RangeError);
  await expect(prepareSongSession('failed.wav', { sampleRate: 48000, channels: [new Float32Array(1)] },
    () => true, async () => { throw new Error('Task failed'); })).rejects.toThrow('Task failed');
});
