/** Planar PCM: mono, or stereo in left/right order. Samples are linear amplitude. */
export interface PcmAudio {
  readonly sampleRate: number;
  readonly channels: readonly [Float32Array] | readonly [Float32Array, Float32Array];
}

export function validateSampleRate(sampleRate: number): void {
  if (typeof sampleRate !== 'number') {
    throw new TypeError('Sample rate must be a number.');
  }
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new RangeError('Sample rate must be finite and greater than zero.');
  }
}

/**
 * Validate untyped callers too, without mutating input.
 * TypeError: malformed input, containers, channel storage, or sample-rate type.
 * RangeError: unsupported channel count, empty/mismatched lengths, or invalid numbers.
 */
export function validatePcm(input: PcmAudio): void {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new TypeError('PCM input must be an object.');
  }
  validateSampleRate(input.sampleRate);
  if (!Array.isArray(input.channels)) {
    throw new TypeError('PCM channels must be an array.');
  }
  if (input.channels.length !== 1 && input.channels.length !== 2) {
    throw new RangeError('PCM must contain one or two channels.');
  }
  let frameCount: number | undefined;
  for (const channel of input.channels) {
    if (!(channel instanceof Float32Array)) {
      throw new TypeError('PCM channels must be Float32Array instances.');
    }
    if (channel.length === 0) throw new RangeError('PCM channels must not be empty.');
    frameCount ??= channel.length;
    if (channel.length !== frameCount) {
      throw new RangeError('PCM channel lengths must match.');
    }
    for (const sample of channel) {
      if (!Number.isFinite(sample)) throw new RangeError('PCM samples must be finite.');
    }
  }
}
