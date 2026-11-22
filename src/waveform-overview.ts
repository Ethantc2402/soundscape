import { validatePcm } from './audio/pcm';
import type { PcmAudio } from './audio/pcm';

/** Compact independent extrema; each bucket is [floor(b*N/B),floor((b+1)*N/B)). */
export function createWaveformOverview(pcm: PcmAudio) {
  validatePcm(pcm);
  const frameCount = pcm.channels[0].length;
  const bucketCount = Math.min(frameCount, 2048);
  const channels = pcm.channels.map(samples => {
    const min = new Float32Array(bucketCount);
    const max = new Float32Array(bucketCount);
    for (let bucket = 0; bucket < bucketCount; bucket++) {
      let low = Infinity;
      let high = -Infinity;
      for (let i = Math.floor(bucket * frameCount / bucketCount); i < Math.floor((bucket + 1) * frameCount / bucketCount); i++) {
        low = Math.min(low, samples[i]!);
        high = Math.max(high, samples[i]!);
      }
      min[bucket] = low;
      max[bucket] = high;
    }
    return { min, max };
  });
  return { frameCount, sampleRate: pcm.sampleRate, bucketCount, channels };
}
export type WaveformSummary = ReturnType<typeof createWaveformOverview>;
