import { validateSampleRate } from './audio/pcm';

export type TimingQuality = 'output estimate' | 'uncompensated' | 'unconfirmed';
export interface PlaybackSnapshot {
  seconds: number;
  sample: number;
  playing: boolean;
  loop: boolean;
  timing: TimingQuality;
}
function nonnegative(value: number, name: string) {
  if (typeof value !== 'number') throw new TypeError(`${name} must be a number.`);
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be finite and nonnegative.`);
}

/** W3C getOutputTimestamp pairing, extrapolated only while the context runs.
 * Application freshness budget: 250 ms; never infer latency by subtraction.
 */
export function outputTime(currentTime: number, nowMs: number, running: boolean,
  timestamp?: { contextTime: number; performanceTime: number }) {
  nonnegative(currentTime, 'Context time');
  nonnegative(nowMs, 'Performance time');
  if (running && timestamp && Number.isFinite(timestamp.contextTime) && timestamp.contextTime > 0 &&
      Number.isFinite(timestamp.performanceTime) && timestamp.performanceTime > 0 &&
      timestamp.contextTime <= currentTime && nowMs >= timestamp.performanceTime &&
      nowMs - timestamp.performanceTime <= 250) {
    return { time: Math.min(currentTime, timestamp.contextTime + (nowMs - timestamp.performanceTime) / 1000),
      timing: 'output estimate' as TimingQuality };
  }
  return { time: currentTime, timing: 'uncompensated' as TimingQuality };
}

/** Context-time segments keep queued output on its preceding recording anchor. */
export function createPlaybackClock(sampleRate: number, frameCount: number) {
  validateSampleRate(sampleRate);
  if (typeof frameCount !== 'number') throw new TypeError('Frame count must be a number.');
  if (!Number.isSafeInteger(frameCount) || frameCount <= 0) throw new RangeError('Invalid frame count.');
  const duration = frameCount / sampleRate;
  if (!Number.isFinite(duration) || duration <= 0) throw new RangeError('Unrepresentable duration.');
  type Segment = { at: number; seconds: number; playing: boolean; loop: boolean; sample?: number };
  let segments: Segment[] = [{ at: 0, seconds: 0, playing: false, loop: false }];
  let lostBefore = -1;
  function seekSample(seconds: number) {
    nonnegative(seconds, 'Seek time');
    if (seconds > duration) throw new RangeError('Seek is outside the recording.');
    return seconds === duration ? frameCount : Math.floor(seconds * sampleRate);
  }
  function snapshot(time: number, timing: TimingQuality = 'uncompensated'): PlaybackSnapshot {
    nonnegative(time, 'Context time');
    let segment = segments[0]!;
    for (const candidate of segments) {
      if (candidate.at > time) break;
      segment = candidate;
    }
    let seconds = segment.seconds;
    if (segment.playing) {
      const elapsed = Math.max(0, time - segment.at);
      if (segment.loop) {
        const wrapped = elapsed % duration;
        const remaining = duration - seconds;
        seconds = wrapped >= remaining ? wrapped - remaining : seconds + wrapped;
      } else {
        seconds = elapsed >= duration - seconds ? duration : seconds + elapsed;
      }
    }
    return { seconds, sample: segment.sample !== undefined && (!segment.playing || time <= segment.at) ? segment.sample
        : seconds === duration ? frameCount : Math.min(frameCount, Math.floor(seconds * sampleRate)),
      playing: segment.playing && (segment.loop || seconds < duration), loop: segment.loop,
      timing: time < lostBefore ? 'unconfirmed' : timing };
  }
  return {
    duration, seekSample, snapshot,
    transition(at: number, seconds: number, playing: boolean, loop: boolean, sample?: number) {
      nonnegative(at, 'Context time');
      nonnegative(seconds, 'Position');
      if (seconds > duration || at < segments.at(-1)!.at) throw new RangeError('Invalid clock transition.');
      if (typeof playing !== 'boolean' || typeof loop !== 'boolean') throw new TypeError('Transport flags must be boolean.');
      if (sample !== undefined && (!Number.isSafeInteger(sample) || sample < 0 || sample > frameCount || sample / sampleRate !== seconds)) {
        throw new RangeError('Invalid sample anchor.');
      }
      const segment: Segment = { at, seconds, playing: playing && seconds < duration, loop,
        ...(sample === undefined ? {} : { sample }) };
      if (at === segments.at(-1)!.at) segments[segments.length - 1] = segment;
      else segments.push(segment);
      if (segments.length > 64) {
        segments = segments.slice(-64);
        lostBefore = segments[0]!.at;
      }
    },
  };
}
