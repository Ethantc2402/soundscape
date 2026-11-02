import { validatePcm } from './pcm';
import type { PcmAudio } from './pcm';
import { createSpectrumAnalyzer } from './spectrum';
import type { SpectrumResult, SpectrumSettings } from './spectrum';
import { resolveSpectrumOptions } from './spectrum-settings';

export interface TimelineSettings extends SpectrumSettings {
  /** Positive safe integer, in samples per channel; overlap and gaps are allowed. */
  readonly hopSize: number;
}

export interface TimelineFrame {
  readonly index: number;
  readonly frameOffset: number;
  readonly startTimeSeconds: number;
  /** End-exclusive observed time, excluding FFT padding. */
  readonly endTimeSeconds: number;
  readonly spectrum: SpectrumResult;
}

/**
 * Eagerly validate one recording/settings, then lazily analyze fully fitting windows.
 * The returned iterator is single-use. Keep source PCM stable (no mutation or transfer)
 * for its lifetime; it retains PCM and one private analyzer, never a history of results.
 * Call return() or finish a for-of loop to release generator-held state when stopping.
 */
export function createSpectrumTimeline(input: PcmAudio, settings: TimelineSettings): Generator<TimelineFrame, void, unknown> {
  if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
    throw new TypeError('Timeline settings must be an object.');
  }
  const { hopSize, fftSize: requestedFftSize, frameLength: requestedFrameLength } = settings;
  if (typeof hopSize !== 'number') throw new TypeError('Hop size must be a number.');
  if (!Number.isSafeInteger(hopSize) || hopSize <= 0) {
    throw new RangeError('Hop size must be a positive safe integer.');
  }
  const { fftSize, frameLength } = resolveSpectrumOptions({
    fftSize: requestedFftSize, frameOffset: 0,
    ...(requestedFrameLength === undefined ? {} : { frameLength: requestedFrameLength }),
  });
  // Validate here only when no analyzer can be constructed: its public contract
  // intentionally rejects short recordings. Fitting input is scanned by the factory.
  const analyzer = (() => {
    // A short-path decision must not dereference malformed untyped PCM.
    if (typeof input === 'object' && input !== null && Array.isArray(input.channels) &&
        input.channels[0] instanceof Float32Array && input.channels[0].length < frameLength) {
      validatePcm(input);
      return undefined;
    }
    return createSpectrumAnalyzer(input, { fftSize, frameLength });
  })();
  const sampleRate = input.sampleRate;
  // Match spectral representability rules even if there are no fitting windows.
  if (sampleRate / fftSize === 0 || !Number.isFinite(frameLength / sampleRate)) {
    throw new RangeError('Spectral timing and frequency spacing must be representable.');
  }
  const length = input.channels[0].length;
  const frameCount = length < frameLength ? 0 : 1 + Math.floor((length - frameLength) / hopSize);
  if (frameCount > 0 && !Number.isFinite(((frameCount - 1) * hopSize + frameLength) / sampleRate)) {
    throw new RangeError('Timeline times must be representable.');
  }
  return (function* (): Generator<TimelineFrame, void, unknown> {
    for (let index = 0; index < frameCount; index++) {
      const frameOffset = index * hopSize;
      yield {
        index, frameOffset,
        startTimeSeconds: frameOffset / sampleRate,
        endTimeSeconds: (frameOffset + frameLength) / sampleRate,
        // A nonempty schedule always has a validated analyzer.
        spectrum: analyzer!.analyzeFrame(frameOffset),
      };
    }
  })();
}
