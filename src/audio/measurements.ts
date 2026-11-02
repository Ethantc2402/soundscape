import { validatePcm } from './pcm';
import type { PcmAudio } from './pcm';

export interface ChannelMeasurement {
  /** Maximum absolute stored sample, in linear amplitude. */
  readonly samplePeak: number;
  /** Root mean square including DC, in linear amplitude. */
  readonly rms: number;
  /** Mean-square signal power in squared linear amplitude; legacy name, not total energy. */
  readonly meanSquareEnergy: number;
}

export interface AudioMeasurement {
  readonly sampleRate: number;
  readonly frameCount: number;
  /** One result per input channel; stereo order is left, right. */
  readonly channels: readonly ChannelMeasurement[];
}

/** Linear amplitude peak for each channel, without intersample reconstruction. */
export function samplePeak(input: PcmAudio): number[] {
  validatePcm(input);
  return input.channels.map(channel => {
    let peak = 0;
    for (const sample of channel) peak = Math.max(peak, Math.abs(sample));
    return peak;
  });
}

/** Mean squared linear amplitude per channel, not summed physical energy. */
export function perChannelMeanSquareEnergy(input: PcmAudio): number[] {
  validatePcm(input);
  return input.channels.map(channel => {
    let sumSquares = 0;
    for (const sample of channel) sumSquares += sample * sample;
    return sumSquares / channel.length;
  });
}

/** Root mean square per channel, including DC, in linear amplitude. */
export function rms(input: PcmAudio): number[] {
  return perChannelMeanSquareEnergy(input).map(Math.sqrt);
}

export function measureAudio(input: PcmAudio): AudioMeasurement {
  validatePcm(input);
  return {
    sampleRate: input.sampleRate,
    frameCount: input.channels[0].length,
    channels: input.channels.map(channel => {
      let peak = 0;
      let sumSquares = 0;
      for (const sample of channel) {
        peak = Math.max(peak, Math.abs(sample));
        sumSquares += sample * sample;
      }
      const meanSquareEnergy = sumSquares / channel.length;
      return { samplePeak: peak, rms: Math.sqrt(meanSquareEnergy), meanSquareEnergy };
    }),
  };
}
