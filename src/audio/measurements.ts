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
  const steps = measureAudioSteps(input);
  let step = steps.next();
  while (!step.done) step = steps.next();
  return step.value;
}

/** Stable borrowed PCM required until completion; yields between bounded arithmetic scans.
 * No partial result is published. Task scheduling belongs to the caller, outside DSP.
 */
export function* measureAudioSteps(input: PcmAudio): Generator<void, AudioMeasurement> {
  validatePcm(input);
  const sampleRate = input.sampleRate;
  const pcmChannels = [...input.channels];
  const frameCount = pcmChannels[0]!.length;
  yield;
  const channels: ChannelMeasurement[] = [];
  for (const channel of pcmChannels) {
    let peak = 0;
    let sumSquares = 0;
    for (let offset = 0; offset < channel.length; offset += 262144) {
      const end = Math.min(offset + 262144, channel.length);
      for (let index = offset; index < end; index++) {
        const sample = channel[index]!;
        peak = Math.max(peak, Math.abs(sample));
        sumSquares += sample * sample;
      }
      yield;
    }
    const meanSquareEnergy = sumSquares / channel.length;
    channels.push({ samplePeak: peak, rms: Math.sqrt(meanSquareEnergy), meanSquareEnergy });
  }
  return { sampleRate, frameCount, channels };
}
