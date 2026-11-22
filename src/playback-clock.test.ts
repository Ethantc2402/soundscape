import { expect, it } from 'vitest';
import { createPlaybackClock, outputTime } from './playback-clock';
const near = (actual: number, expected: number) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1e-9);

it('maps start, queued seek/pause/resume, exact end and replay from known anchors', () => {
  const clock = createPlaybackClock(48000, 480000);
  clock.transition(2, 0, true, false);
  near(clock.snapshot(1).seconds, 0);
  near(clock.snapshot(2.25).seconds, 0.25);
  clock.transition(3, 7, true, false);
  near(clock.snapshot(2.9).seconds, 0.9);
  near(clock.snapshot(3.1).seconds, 7.1);
  clock.transition(4, 8, false, false);
  near(clock.snapshot(3.9).seconds, 7.9);
  near(clock.snapshot(9).seconds, 8);
  clock.transition(9, 8, true, false);
  expect(clock.snapshot(11)).toMatchObject({ seconds: 10, sample: 480000, playing: false });
  clock.transition(12, 0, true, false);
  near(clock.snapshot(12.5).seconds, 0.5);
});
it('snaps command seeks and retains continuous clock precision across loop wraps', () => {
  const clock = createPlaybackClock(48000, 480000);
  expect(clock.seekSample(1.9 / 48000)).toBe(1);
  expect(clock.seekSample(10)).toBe(480000);
  clock.transition(1, 9, true, true);
  near(clock.snapshot(2).seconds, 0);
  near(clock.snapshot(10002.125).seconds, 0.125);
  clock.transition(10003, 1, true, false);
  near(clock.snapshot(10004).seconds, 2);
  clock.transition(10005, 10, false, true);
  expect(clock.snapshot(10006)).toMatchObject({ seconds: 10, playing: false });
});
it('coalesces same-time edits and bounds history with explicit lost timing quality', () => {
  const clock = createPlaybackClock(1, 1000);
  for (let at = 1; at <= 100; at++) clock.transition(at, at, true, false);
  expect(clock.snapshot(1).timing).toBe('unconfirmed');
  clock.transition(100, 5, false, false);
  expect(clock.snapshot(100)).toMatchObject({ seconds: 5, playing: false, timing: 'uncompensated' });
});
it('selects valid output timestamps and rejects zero, future, stale, malformed and suspended pairs', () => {
  expect(outputTime(5, 1000, true, { contextTime: 4.8, performanceTime: 950 })).toEqual({ time: 4.85, timing: 'output estimate' });
  expect(outputTime(5, 1000, true, { contextTime: 4.99, performanceTime: 950 }).time).toBe(5);
  for (const timestamp of [undefined, { contextTime: 0, performanceTime: 0 }, { contextTime: NaN, performanceTime: 950 },
    { contextTime: 6, performanceTime: 950 }, { contextTime: 4, performanceTime: 749 }, { contextTime: 4, performanceTime: 1001 }]) {
    expect(outputTime(5, 1000, true, timestamp)).toEqual({ time: 5, timing: 'uncompensated' });
  }
  expect(outputTime(5, 1000, false, { contextTime: 4.8, performanceTime: 950 }).timing).toBe('uncompensated');
});
it('rejects invalid transport input with intentional error classes', () => {
  for (const rate of [NaN, 0, -1, Infinity]) expect(() => createPlaybackClock(rate, 4)).toThrow(RangeError);
  for (const count of [NaN, 0, -1, Infinity, 1.5]) expect(() => createPlaybackClock(48000, count)).toThrow(RangeError);
  expect(() => createPlaybackClock('48000' as unknown as number, 4)).toThrow(TypeError);
  expect(() => createPlaybackClock(1, '4' as unknown as number)).toThrow(TypeError);
  const clock = createPlaybackClock(48000, 48000);
  for (const value of [NaN, -1, Infinity, 1.001]) expect(() => clock.seekSample(value)).toThrow(RangeError);
  expect(() => clock.seekSample('0' as unknown as number)).toThrow(TypeError);
  expect(() => clock.transition(0, 0, 1 as unknown as boolean, false)).toThrow(TypeError);
});

it('bounds finite extreme times without overflow before clamping/wrapping', () => {
  const clock = createPlaybackClock(1e-308, 1);
  clock.transition(0, 9e307, true, false);
  expect(clock.snapshot(Number.MAX_VALUE).seconds).toBe(1e308);
  clock.transition(0, 9e307, true, true);
  const snapshot = clock.snapshot(Number.MAX_VALUE);
  expect(Number.isFinite(snapshot.seconds)).toBe(true);
  expect(snapshot.seconds).toBeGreaterThanOrEqual(0);
  expect(snapshot.seconds).toBeLessThan(1e308);
});
