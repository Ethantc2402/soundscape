import { measureAudioSteps } from './audio/measurements';
import type { PcmAudio } from './audio/pcm';
import { createSpectrumAnalyzer } from './audio/spectrum';

export const INSPECTION_FFT_SIZE = 8192;

/** Borrows stable PCM for the session lifetime; results never expose its arrays. */
export function createSongInspection(pcm: PcmAudio) {
  const steps = prepareSongInspection(pcm);
  let step = steps.next();
  while (!step.done) step = steps.next();
  return step.value;
}

/** The session owner keeps PCM stable across preparation steps. */
export function* prepareSongInspection(pcm: PcmAudio) {
  const measurements = yield* measureAudioSteps(pcm);
  const { sampleRate, frameCount } = measurements;
  const analyzer = frameCount >= INSPECTION_FFT_SIZE
    ? createSpectrumAnalyzer(pcm, { fftSize: INSPECTION_FFT_SIZE }) : undefined;
  const maxStartSeconds = Math.max(0, (frameCount - INSPECTION_FFT_SIZE) / sampleRate);
  function inspectSample(sample: number) {
    if (typeof sample !== 'number') throw new TypeError('Inspection sample must be a number.');
    if (!Number.isSafeInteger(sample) || sample < 0 || sample > frameCount) throw new RangeError('Invalid inspection sample.');
    if (!analyzer) return undefined;
    const frameOffset = Math.min(sample, frameCount - INSPECTION_FFT_SIZE);
    const spectrum = analyzer.analyzeFrame(frameOffset);
    return {
      frameOffset,
      startTimeSeconds: frameOffset / sampleRate,
      endTimeSeconds: (frameOffset + INSPECTION_FFT_SIZE) / sampleRate,
      channels: spectrum.channels.map(channel => channel.bands),
    };
  }
  return {
    inspectSample,
    measurements,
    durationSeconds: frameCount / sampleRate,
    maxStartSeconds,
    inspect(timeSeconds: number) {
      if (typeof timeSeconds !== 'number') throw new TypeError('Inspection time must be a number.');
      if (!Number.isFinite(timeSeconds) || timeSeconds < 0) {
        throw new RangeError('Inspection time must be finite and nonnegative.');
      }
      if (!analyzer) return undefined;
      // Clamp before multiplying: even huge finite times select the last full window.
      const frameOffset = timeSeconds >= maxStartSeconds ? frameCount - INSPECTION_FFT_SIZE
        : Math.floor(timeSeconds * sampleRate);
      return inspectSample(frameOffset);
    },
  };
}

export type SongInspection = ReturnType<typeof createSongInspection>;
