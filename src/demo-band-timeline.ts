import type { BandPower } from './audio/bands';
import { sineWave } from './audio/fixtures';
import type { PcmAudio } from './audio/pcm';
import { createSpectrumTimeline } from './audio/timeline';

const sampleRate = 40960;
const windowSamples = 4096;
const segmentSamples = 2 * windowSamples;

function createBandTimelineFixture(): PcmAudio {
  const samples = new Float32Array(3 * segmentSamples);
  samples.set(sineWave({ sampleRate, frameCount: segmentSamples, frequencyHz: 150 }));
  samples.set(sineWave({
    sampleRate, frameCount: segmentSamples, frequencyHz: 3000, amplitude: 0.5,
  }), 2 * segmentSamples);
  return { sampleRate, channels: [samples] };
}

interface BandTimelineColumn {
  readonly startTimeSeconds: number;
  readonly endTimeSeconds: number;
  readonly bands: readonly Pick<BandPower, 'name' | 'power'>[];
}

export function createDemoBandTimeline(): readonly BandTimelineColumn[] {
  const timeline = createSpectrumTimeline(createBandTimelineFixture(), {
    fftSize: windowSamples, hopSize: windowSamples,
  });
  return Array.from(timeline, ({ startTimeSeconds, endTimeSeconds, spectrum }) => ({
    startTimeSeconds,
    endTimeSeconds,
    bands: spectrum.channels[0]!.bands.map(({ name, power }) => ({ name, power })),
  }));
}
