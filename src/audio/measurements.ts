import { validatePcm } from './pcm';
import type { PcmAudio } from './pcm';

export interface ChannelMeasurement {
  readonly samplePeak: number;
  readonly rms: number;
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
    let sum = 0;
    for (const sample of channel) sum += sample * sample;
    return sum / channel.length;
  });
}

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
      let sum = 0;
      for (const sample of channel) {
        peak = Math.max(peak, Math.abs(sample));
        sum += sample * sample;
      }
      const meanSquareEnergy = sum / channel.length;
      return { samplePeak: peak, rms: Math.sqrt(meanSquareEnergy), meanSquareEnergy };
    }),
  };
}
