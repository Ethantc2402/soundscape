import { validateSampleRate } from './pcm';

export interface SineOptions {
  readonly sampleRate: number;
  readonly frameCount: number;
  readonly frequencyHz: number;
  readonly amplitude?: number;
  readonly phaseRadians?: number;
}

/** x[n] = amplitude * sin(2π * frequencyHz * n / sampleRate + phaseRadians). */
export function sineWave({
  sampleRate, frameCount, frequencyHz, amplitude = 1, phaseRadians = 0,
}: SineOptions): Float32Array {
  validateSampleRate(sampleRate);
  if (!Number.isSafeInteger(frameCount) || frameCount <= 0) {
    throw new RangeError('Frame count must be a positive safe integer.');
  }
  if (!Number.isFinite(frequencyHz) || frequencyHz < 0 || frequencyHz >= sampleRate / 2) {
    throw new RangeError('Frequency must be finite and in [0, sampleRate / 2).');
  }
  if (!Number.isFinite(amplitude) || amplitude < 0 || !Number.isFinite(phaseRadians)) {
    throw new RangeError('Amplitude must be finite and nonnegative; phase must be finite.');
  }
  const samples = new Float32Array(frameCount);
  const step = 2 * Math.PI * (frequencyHz / sampleRate);
  for (let n = 0; n < frameCount; n++) {
    const sample = amplitude * Math.sin(step * n + phaseRadians);
    if (Math.abs(sample) > 3.4028234663852886e38) {
      throw new RangeError('Generated sample exceeds the finite Float32 range.');
    }
    samples[n] = sample;
  }
  return samples;
}
