import type { SpectrumOptions } from './spectrum';

/** Bounded power-of-two sizes; 32768/65536 allow longer low-frequency observations. */
export const SUPPORTED_FFT_SIZES = Object.freeze([1024, 2048, 4096, 8192, 16384, 32768, 65536] as const);

export function resolveSpectrumOptions(options: SpectrumOptions): Required<SpectrumOptions> {
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
