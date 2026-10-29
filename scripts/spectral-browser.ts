import { analyzeSpectrum, createSpectrumAnalyzer } from '../src/audio/spectrum';
import { sineWave } from '../src/audio/fixtures';

// Separate development-only entry: the application and its UI stay unchanged.
try {
  const sampleRate = 48000;
  const fftSize = 4096;
  const pcm = { sampleRate, channels: [sineWave({ sampleRate, frameCount: fftSize, frequencyHz: 1000 })] as [Float32Array] };
  const results = [analyzeSpectrum(pcm, { fftSize, frameOffset: 0 }),
    createSpectrumAnalyzer(pcm, { fftSize }).analyzeFrame(0)];
  const observations = results.map(result => {
    const power = result.channels[0]?.power;
    if (!power || !power.every(value => Number.isFinite(value) && value >= 0)) throw new Error('Invalid spectral power');
    let peak = 0;
    for (let k = 1; k < power.length; k++) if (power[k]! > power[peak]!) peak = k;
    const frequencyHz = result.frequencyHz[peak]!;
    if (!(power[peak]! > 0) || Math.abs(frequencyHz - 1000) > result.frequencyBinSpacingHz) {
      throw new Error(`Unexpected peak: ${frequencyHz} Hz, ${power[peak]}`);
    }
    return { peak, frequencyHz, power: power[peak], totalPower: result.channels[0]?.totalPower };
  });
  document.body.dataset.status = 'passed';
  document.body.textContent = JSON.stringify({ status: 'passed', runtime: navigator.userAgent, observations });
} catch (error) {
  document.body.dataset.status = 'failed';
  document.body.textContent = `Spectral browser smoke FAILED: ${String(error)}`;
  throw error;
}
