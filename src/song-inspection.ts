import { measureAudio } from './audio/measurements';
import type { PcmAudio } from './audio/pcm';
import { createSpectrumAnalyzer } from './audio/spectrum';

export const INSPECTION_FFT_SIZE = 8192;

/** Borrows stable PCM for the session lifetime; results never expose its arrays. */
export function createSongInspection(pcm: PcmAudio) {
  const measurements = measureAudio(pcm);
  const { sampleRate, frameCount } = measurements;
  const analyzer = frameCount >= INSPECTION_FFT_SIZE
    ? createSpectrumAnalyzer(pcm, { fftSize: INSPECTION_FFT_SIZE }) : undefined;
  const maxStartSeconds = Math.max(0, (frameCount - INSPECTION_FFT_SIZE) / sampleRate);
  return {
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
      const spectrum = analyzer.analyzeFrame(frameOffset);
      return {
        frameOffset,
        startTimeSeconds: frameOffset / sampleRate,
        endTimeSeconds: (frameOffset + INSPECTION_FFT_SIZE) / sampleRate,
        channels: spectrum.channels.map(channel => channel.bands),
      };
    },
  };
}

export type SongInspection = ReturnType<typeof createSongInspection>;
