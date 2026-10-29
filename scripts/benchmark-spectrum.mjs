import { createServer } from 'vite';
import { performance } from 'node:perf_hooks';
import { cpus, totalmem } from 'node:os';

// Vite loads the real TypeScript engine without an additional TS runner dependency.
const server = await createServer({ cacheDir: '/tmp/soundscape-benchmark-vite-cache', optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true }, appType: 'custom' });
try {
  const { analyzeSpectrum, createSpectrumAnalyzer } = await server.ssrLoadModule('/src/audio/spectrum.ts');
  const sampleRate = 48000;
  const durationSeconds = Number(process.env.BENCH_SECONDS || 180);
  const publicFrameLimit = Number(process.env.BENCH_PUBLIC_FRAMES || 24);
  const trials = 3;
  const hop = 2048;
  if (!Number.isFinite(durationSeconds) || durationSeconds < 1 || durationSeconds > 180 ||
      !Number.isSafeInteger(publicFrameLimit) || publicFrameLimit < 1) throw new Error('Invalid benchmark limits');
  const length = Math.floor(sampleRate * durationSeconds);
  const channels = [new Float32Array(length), new Float32Array(length)];
  for (let n = 0; n < length; n++) {
    channels[0][n] = 0.5 * Math.sin(2 * Math.PI * 1000 * n / sampleRate);
    channels[1][n] = 0.25 * Math.sin(2 * Math.PI * 187.5 * n / sampleRate);
  }
  const pcm = { sampleRate, channels };
  console.log(JSON.stringify({ node: process.version, platform: process.platform, arch: process.arch,
    cpu: cpus()[0]?.model, logicalCpus: cpus().length, hostMemoryBytes: totalmem(),
    durationSeconds, sampleRate, channels: 2, pcmBytes: length * 8, hop, trials,
    methodology: 'Synthetic resident stereo Float32 PCM; warm up each path; three timed trials; outputs consumed then discarded. Public path samples evenly spaced valid hop offsets; session path measures both identical offsets and all offsets. Session creation includes full validation and is timed separately. Memory snapshots are process-wide, not per-path peaks.' }));
  let checksum = 0;
  for (const fftSize of [4096, 8192]) {
    const all = Array.from({ length: Math.floor((length - fftSize) / hop) + 1 }, (_, i) => i * hop);
    const count = Math.min(publicFrameLimit, all.length);
    const sampled = Array.from({ length: count }, (_, i) => all[count === 1 ? 0 : Math.floor(i * (all.length - 1) / (count - 1))]);
    const start = performance.now();
    const session = createSpectrumAnalyzer(pcm, { fftSize });
    const sessionCreationMs = performance.now() - start;
    const publicCall = offset => analyzeSpectrum(pcm, { fftSize, frameOffset: offset });
    const reusableCall = offset => session.analyzeFrame(offset);
    for (let i = 0; i < 2; i++) publicCall(sampled[0]);
    for (let i = 0; i < 8; i++) reusableCall(sampled[0]);
    for (const [path, offsets, call] of [['public-sampled', sampled, publicCall], ['session-sampled', sampled, reusableCall], ['session-all', all, reusableCall]]) {
      const memoryBefore = process.memoryUsage();
      const runs = [];
      for (let trial = 0; trial < trials; trial++) {
        const begin = performance.now();
        for (const offset of offsets) checksum += call(offset).channels[0].totalPower;
        runs.push(performance.now() - begin);
      }
      const medianMs = [...runs].sort((a, b) => a - b)[1];
      console.log(JSON.stringify({ fftSize, path, framesPerTrial: offsets.length, sessionCreationMs,
        trialMs: runs, medianMs, framesPerSecond: offsets.length * 1000 / medianMs,
        millionObservedChannelSamplesPerSecond: offsets.length * fftSize * 2 / (medianMs * 1000),
        memoryBefore, memoryAfter: process.memoryUsage() }));
    }
  }
  if (!Number.isFinite(checksum) || checksum <= 0) throw new Error('Invalid benchmark outputs');
  console.log(JSON.stringify({ checksum }));
} finally {
  await server.close();
}
