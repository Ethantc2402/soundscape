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

/**
 * Analyze a single selected frame. No sample mutation, mixing, DC removal, or playback.
 * P[k] = d[k] |FFT(x*w)[k]|² / (fftSize * sum(w²)); d is 1 at DC/Nyquist, otherwise 2.
 */
export function analyzeSpectrum(input: PcmAudio, options: SpectrumOptions): SpectrumResult {
  validatePcm(input);
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
  if (frameOffset > input.channels[0].length - frameLength) {
    throw new RangeError('Selected frame exceeds PCM bounds; padding must be explicit via frameLength.');
  }
  const frequencyBinSpacingHz = input.sampleRate / fftSize;
  const frameDurationSeconds = frameLength / input.sampleRate;
  if (frequencyBinSpacingHz === 0 || !Number.isFinite(frameDurationSeconds)) {
    throw new RangeError('Spectral timing and frequency spacing must be representable.');
  }

  const window = periodicHann(frameLength);
  const fft = new FFT(fftSize);
  // Reuse per-call workspace across channels; no global mutable plan/cache.
  const windowed = new Float64Array(fftSize);
  const coefficients = new Float64Array(2 * fftSize);
  const binCount = fftSize / 2 + 1;
  const frequencyHz = Float64Array.from({ length: binCount }, (_, k) => k * frequencyBinSpacingHz);
  const denominator = fftSize * window.sumSquaredCoefficients;
  const channels = input.channels.map(channel => {
    for (let n = 0; n < frameLength; n++) {
      windowed[n] = channel[frameOffset + n]! * window.coefficients[n]!;
    }
    // fft.js forward transform is unscaled; only the one-sided half is needed.
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
    return { power, totalPower, bands: aggregateBandPower(power, input.sampleRate, fftSize) };
  });
  return {
    sampleRate: input.sampleRate, fftSize, frameOffset, frameLength, frameDurationSeconds,
    zeroPaddingSamples: fftSize - frameLength,
    frequencyBinSpacingHz, frequencyHz,
    window: { type: window.type, coherentGain: window.coherentGain, meanSquareGain: window.meanSquareGain },
    powerUnits: 'squared-linear-amplitude', normalization: 'one-sided-window-mean-square', channels,
  };
}
