import FFT from 'fft.js';
import { validatePcm } from './pcm';
import type { PcmAudio } from './pcm';
import { periodicHann } from './windowing';
import { aggregateBandPower } from './bands';
import type { BandPower } from './bands';

/** Bounded power-of-two sizes; 32768/65536 allow longer low-frequency observations. */
export const SUPPORTED_FFT_SIZES = Object.freeze([1024, 2048, 4096, 8192, 16384, 32768, 65536] as const);

export interface SpectrumOptions {
  readonly frameOffset: number;
  readonly fftSize: number;
  /** Observed samples (4..fftSize); defaults to fftSize. A shorter frame explicitly requests padding. */
  readonly frameLength?: number;
}

export interface ChannelSpectrum {
  /** One-sided bin powers, including DC and Nyquist, in squared linear amplitude. */
  readonly power: Float64Array;
  readonly totalPower: number;
  readonly bands: readonly BandPower[];
}

export interface SpectrumResult {
  readonly sampleRate: number;
  readonly fftSize: number;
  readonly frameOffset: number;
  readonly frameLength: number;
  /** Duration of observed samples, excluding padding. */
  readonly frameDurationSeconds: number;
  readonly zeroPaddingSamples: number;
  readonly frequencyBinSpacingHz: number;
  readonly frequencyHz: Float64Array;
  readonly window: {
    readonly type: 'hann-periodic';
    readonly coherentGain: number;
    readonly meanSquareGain: number;
  };
  readonly powerUnits: 'squared-linear-amplitude';
  readonly normalization: 'one-sided-window-mean-square';
  /** Input order: mono, or left then right. */
  readonly channels: readonly ChannelSpectrum[];
}

/** Settings are fixed for a session; only the selected offset changes. */
export type SpectrumSettings = Omit<SpectrumOptions, 'frameOffset'>;

export interface SpectrumAnalyzer {
  analyzeFrame(frameOffset: number): SpectrumResult;
}

/**
 * Safe recording boundary: validate all samples once, then retain private FFT state.
 * Do not mutate or transfer PCM storage during the session (including from another
 * thread). The channel list and sample rate are captured, not read from mutable metadata.
 * This is synchronous sequential processing, not a scheduler or a shared/global cache.
 */
export function createSpectrumAnalyzer(input: PcmAudio, settings: SpectrumSettings): SpectrumAnalyzer {
  validatePcm(input);
  if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
    throw new TypeError('Spectrum options must be an object.');
  }
  const resolved = resolveOptions({ fftSize: settings.fftSize, frameOffset: 0,
    ...(settings.frameLength === undefined ? {} : { frameLength: settings.frameLength }) });
  return createValidatedAnalyzer(input, resolved);
}

/**
 * Analyze a single selected frame with full PCM validation on every call.
 * P[k] = d[k] |FFT(x*w)[k]|² / (fftSize * sum(w²)); d is 1 at DC/Nyquist, otherwise 2.
 */
export function analyzeSpectrum(input: PcmAudio, options: SpectrumOptions): SpectrumResult {
  validatePcm(input);
  const resolved = resolveOptions(options);
  return createValidatedAnalyzer(input, resolved).analyzeFrame(resolved.frameOffset);
}

function resolveOptions(options: SpectrumOptions): Required<SpectrumOptions> {
  if (typeof options !== 'object' || options === null || Array.isArray(options)) {
    throw new TypeError('Spectrum options must be an object.');
  }
  const { fftSize, frameOffset } = options;
  if (typeof fftSize !== 'number' || typeof frameOffset !== 'number') {
    throw new TypeError('FFT size and frame offset must be numbers.');
  }
  if (!SUPPORTED_FFT_SIZES.some(size => size === fftSize)) {
    throw new RangeError('Unsupported FFT size.');
  }
  if (!Number.isSafeInteger(frameOffset) || frameOffset < 0) {
    throw new RangeError('Frame offset must be a nonnegative safe integer.');
  }
  const frameLength = options.frameLength === undefined ? fftSize : options.frameLength;
  if (typeof frameLength !== 'number') throw new TypeError('Frame length must be a number.');
  if (!Number.isSafeInteger(frameLength) || frameLength < 4 || frameLength > fftSize) {
    throw new RangeError('Frame length must be an integer from 4 through FFT size.');
  }
  return { fftSize, frameOffset, frameLength };
}

function validateFrameOffset(frameOffset: number, frameLength: number, channels: readonly Float32Array[]): void {
  if (typeof frameOffset !== 'number') throw new TypeError('Frame offset must be a number.');
  if (!Number.isSafeInteger(frameOffset) || frameOffset < 0) {
    throw new RangeError('Frame offset must be a nonnegative safe integer.');
  }
  // Check each current buffer length too: a caller may have detached its storage.
  for (const channel of channels) {
    if (frameOffset > channel.length - frameLength) {
      throw new RangeError('Selected frame exceeds PCM bounds; padding must be explicit via frameLength.');
    }
  }
}

/** Private: callers can only reach this path after full boundary validation. */
function createValidatedAnalyzer(input: PcmAudio, settings: Required<SpectrumOptions>): SpectrumAnalyzer {
  const { fftSize, frameLength } = settings;
  const sampleRate = input.sampleRate;
  const pcmChannels = [...input.channels];
  validateFrameOffset(settings.frameOffset, frameLength, pcmChannels);
  const frequencyBinSpacingHz = sampleRate / fftSize;
  const frameDurationSeconds = frameLength / sampleRate;
  if (frequencyBinSpacingHz === 0 || !Number.isFinite(frameDurationSeconds)) {
    throw new RangeError('Spectral timing and frequency spacing must be representable.');
  }
  const window = periodicHann(frameLength);
  const fft = new FFT(fftSize);
  const windowed = new Float64Array(fftSize);
  const coefficients = new Float64Array(2 * fftSize);
  const binCount = fftSize / 2 + 1;
  const frequencyHz = Float64Array.from({ length: binCount }, (_, k) => k * frequencyBinSpacingHz);
  const denominator = fftSize * window.sumSquaredCoefficients;

  return { analyzeFrame(frameOffset) {
    validateFrameOffset(frameOffset, frameLength, pcmChannels);
    const channels = pcmChannels.map(channel => {
      for (let n = 0; n < frameLength; n++) {
        // Offset/bounds were checked above; Hann storage has exactly frameLength entries.
        const sample = channel[frameOffset + n]!;
        // Cheap frame-local guard against invalid post-validation mutation. This does
        // not rescan samples outside the frame or authorize mutation during a session.
        if (!Number.isFinite(sample)) throw new RangeError('PCM samples must be finite.');
        windowed[n] = sample * window.coefficients[n]!;
      }
      // realTransform reads its input; the zero-padding tail stays zero across frames.
      // Only DC..Nyquist of the interleaved output is used (indices <= fftSize + 1).
      fft.realTransform(coefficients, windowed);
      const power = new Float64Array(binCount);
      let totalPower = 0;
      for (let k = 0; k < binCount; k++) {
        const re = coefficients[2 * k]!;
        const im = coefficients[2 * k + 1]!;
        const weight = k === 0 || k === fftSize / 2 ? 1 : 2;
        const value = weight * (re * re + im * im) / denominator;
        power[k] = value;
        totalPower += value;
      }
      return { power, totalPower, bands: aggregateBandPower(power, sampleRate, fftSize) };
    });
    return {
      sampleRate, fftSize, frameOffset, frameLength, frameDurationSeconds,
      zeroPaddingSamples: fftSize - frameLength,
      frequencyBinSpacingHz, frequencyHz: frequencyHz.slice(),
      window: { type: window.type, coherentGain: window.coherentGain, meanSquareGain: window.meanSquareGain },
      powerUnits: 'squared-linear-amplitude', normalization: 'one-sided-window-mean-square', channels,
    };
  } };
}
