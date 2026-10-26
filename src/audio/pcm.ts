/** Planar PCM: mono, or stereo in left/right order. Samples are linear amplitude. */
export interface PcmAudio {
  readonly sampleRate: number;
  readonly channels: readonly [Float32Array] | readonly [Float32Array, Float32Array];
}

export function validateSampleRate(sampleRate: number): void {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new RangeError('Sample rate must be finite and greater than zero.');
  }
}

/** Validate at runtime too, including callers outside TypeScript. Never mutates input. */
export function validatePcm(input: PcmAudio): void {
  validateSampleRate(input.sampleRate);
  if (input.channels.length !== 1 && input.channels.length !== 2) {
    throw new RangeError('PCM must contain one or two channels.');
  }
  const frameCount = input.channels[0].length;
  for (const channel of input.channels) {
    if (!(channel instanceof Float32Array)) {
      throw new TypeError('PCM channels must be Float32Array instances.');
    }
    if (channel.length === 0) throw new RangeError('PCM channels must not be empty.');
    if (channel.length !== frameCount) {
      throw new RangeError('PCM channel lengths must match.');
    }
    for (const sample of channel) {
      if (!Number.isFinite(sample)) throw new RangeError('PCM samples must be finite.');
    }
  }
}
