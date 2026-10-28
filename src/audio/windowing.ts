export interface HannWindow {
  readonly type: 'hann-periodic';
  readonly coefficients: Float64Array;
  readonly coherentGain: number;
  readonly meanSquareGain: number;
  readonly sumSquaredCoefficients: number;
}

/** Periodic Hann uses length, not length - 1. Apply before zero-padding. */
export function periodicHann(length: number): HannWindow {
  if (typeof length !== 'number') throw new TypeError('Window length must be a number.');
  if (!Number.isSafeInteger(length) || length < 4 || length > 65536) {
    throw new RangeError('Window length must be an integer from 4 through 65536.');
  }
  const coefficients = new Float64Array(length);
  let sum = 0;
  let sumSquaredCoefficients = 0;
  for (let n = 0; n < length; n++) {
    const value = 0.5 * (1 - Math.cos(2 * Math.PI * n / length));
    coefficients[n] = value;
    sum += value;
    sumSquaredCoefficients += value * value;
  }
  return {
    type: 'hann-periodic', coefficients,
    coherentGain: sum / length,
    meanSquareGain: sumSquaredCoefficients / length,
    sumSquaredCoefficients,
  };
}
