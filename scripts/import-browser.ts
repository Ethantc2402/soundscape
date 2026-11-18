import { importAudio } from '../src/browser/import-audio';
import { createSongInspection } from '../src/song-inspection';
import { wavFixture } from './wav-fixture';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function near(actual: number, expected: number, tolerance: number, label: string) {
  assert(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);
}
const pause = (ms = 20) => new Promise<void>(resolve => setTimeout(resolve, ms));
async function waitFor(test: () => boolean, label: string) {
  const deadline = performance.now() + 15000;
  while (!test()) {
    if (performance.now() > deadline) throw new Error(`Timed out: ${label}`);
    await pause();
  }
}
const makeFile = (bytes: ArrayBuffer, name = 'fixture.wav') => new File([bytes], name, { type: 'audio/wav' });

async function run() {
  const outcomes: string[] = [];
  for (const bits of [16, 24] as const) {
    for (const count of [1, 2]) {
      const audio = await importAudio(makeFile(wavFixture({ bits, channels: count })))!;
      assert(audio, 'Decoded fixture missing');
      const { pcm } = audio;
      assert(pcm.sampleRate === 48000 && pcm.channels.length === count, 'Decoded metadata');
      const session = createSongInspection(pcm);
      pcm.channels.forEach((samples, channel) => {
        // Observed macOS Chrome PCM16: positive codes /32767, negative /32768.
        // This is a decode convention, not a change to Soundscape's DSP tolerances.
        const decodeScale = bits === 16 && navigator.platform.startsWith('Mac') ? 32768 / 32767 : 1;
        const negativeAmplitude = channel === 0 ? 0.5 : 0.25;
        const amplitude = negativeAmplitude * decodeScale;
        const period = [0, amplitude, 0, -negativeAmplitude];
        samples.forEach((sample, i) => near(sample, period[i % 4]!, 1e-7, `PCM${bits} quantized decoded sample`));
        const measurement = session.measurements.channels[channel]!;
        near(measurement.samplePeak, amplitude, 1e-6, 'Peak');
        const expectedMeanSquare = (amplitude ** 2 + negativeAmplitude ** 2) / 4;
        near(measurement.rms, Math.sqrt(expectedMeanSquare), 1e-6, 'RMS');
        near(measurement.meanSquareEnergy, expectedMeanSquare, 1e-7, 'Mean square');
        const sineAmplitude = (amplitude + negativeAmplitude) / 2;
        const bands = session.inspect(0)!.channels[channel]!;
        bands.forEach(band => near(band.power, band.name === 'Treble' ? sineAmplitude ** 2 / 12
          : band.name === 'Air' ? 5 * sineAmplitude ** 2 / 12 : 0, 1e-7, 'Hann band power'));
      });
      outcomes.push(`PCM${bits} ${count === 1 ? 'mono' : 'stereo'}: decoded samples and analytic measurements passed`);
    }
  }
  const converted = await importAudio(makeFile(wavFixture({ sampleRate: 44100, frames: 44100 })))!;
  assert(converted && converted.pcm.sampleRate === 48000, '44.1 kHz import must decode at 48 kHz');
  near(converted.pcm.channels[0].length / converted.pcm.sampleRate, 1, 1 / 48000, 'Resampled duration');
  for (const bytes of [new ArrayBuffer(20), wavFixture().slice(0, 12), wavFixture({ channels: 3 })]) {
    let rejected = false;
    try { await importAudio(makeFile(bytes)); } catch { rejected = true; }
    assert(rejected, 'Corrupt/multichannel input must reject');
  }
  outcomes.push('Resampling, corrupt WAV, and unsupported layout passed');

  const iframe = document.createElement('iframe');
  iframe.src = '/'; iframe.style.width = '1200px'; iframe.style.height = '1000px';
  document.body.textContent = '';
  iframe.style.display = 'block';
  document.body.append(iframe);
  async function capture(name: string) {
    document.body.dataset.capture = name;
    await waitFor(() => !document.body.dataset.capture, `Capture ${name}`);
  }
  await waitFor(() => !!iframe.contentDocument?.querySelector('#song-file:not(:disabled)'), 'React app');
  const doc = iframe.contentDocument!;
  function upload(file: File) {
    const input = doc.querySelector<HTMLInputElement>('#song-file')!;
    const transfer = new DataTransfer(); transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  const ready = () => !!doc.querySelector('.song-results');
  const sampleFile = makeFile(wavFixture());
  upload(sampleFile);
  await waitFor(ready, 'Ready UI');
  assert(doc.querySelectorAll('.song-results tbody tr').length === 9, 'Two channel rows plus seven bands');
  assert(doc.body.textContent!.includes('Left') && doc.body.textContent!.includes('Right'), 'Channel labels');
  await capture('desktop');
  const timeInput = doc.querySelector<HTMLInputElement>('#song-time')!;
  // Native setter avoids React's value tracker so this exercises its real change path.
  const inputConstructor = (iframe.contentWindow as Window & typeof globalThis).HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(inputConstructor.prototype, 'value')!.set!;
  setter.call(timeInput, '0.1'); timeInput.dispatchEvent(new Event('input', { bubbles: true }));
  await waitFor(() => doc.body.textContent!.includes('start at 4800;'), 'Numeric time inspection');
  const slider = doc.querySelector<HTMLInputElement>('#song-position')!;
  setter.call(slider, '0'); slider.dispatchEvent(new Event('input', { bubbles: true }));
  await waitFor(() => doc.body.textContent!.includes('start at 0;'), 'Slider inspection');
  iframe.style.width = '320px';
  await pause(100);
  assert(doc.documentElement.scrollWidth <= doc.documentElement.clientWidth, 'No page overflow at 320px');
  await capture('narrow');
  assert(doc.querySelector('label[for="song-file"]') && doc.querySelector('[role="status"]'), 'Accessible labels/status');
  upload(makeFile(new ArrayBuffer(20), 'corrupt.wav'));
  await waitFor(() => !!doc.querySelector('[role="alert"]'), 'Error UI');
  assert(!ready(), 'Previous results cleared on error');
  upload(sampleFile);
  await waitFor(ready, 'Retry same file');
  upload(makeFile(wavFixture({ frames: 4 }), 'short.wav'));
  await waitFor(() => !!doc.body.textContent?.includes('Too short for this analysis window'), 'Short recording');
  upload(sampleFile);
  await pause(0);
  const cancel = Array.from(doc.querySelectorAll('button')).find(button => button.textContent === 'Cancel import');
  assert(cancel, 'Cancel button'); cancel.click();
  await waitFor(() => doc.querySelector('[role="status"]')?.textContent === 'Choose a WAV to begin.', 'Cancel UI');
  await pause(100);
  assert(!ready(), 'Canceled results stay suppressed');
  outcomes.push('Actual React UI: numeric/slider inspection, 320px layout, corrupt/retry, short input and cancel passed');

  const longFile = makeFile(wavFixture({ frames: 48000 * 300 }), 'five-minute.wav');
  const heap = () => (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize;
  const heapBefore = heap();
  const phases: { phase: string; milliseconds: number }[] = [];
  const start = performance.now();
  const longAudio = await importAudio(longFile, { onPhase: phase => phases.push({ phase, milliseconds: performance.now() - start }) });
  assert(longAudio, 'Long decoded audio');
  const copied = performance.now();
  const session = createSongInspection(longAudio.pcm);
  const measured = performance.now();
  const cursorStart = performance.now();
  for (let i = 0; i < 100; i++) session.inspect(i * session.maxStartSeconds / 99);
  const cursorEnd = performance.now();
  outcomes.push(JSON.stringify({ browser: navigator.userAgent, platform: navigator.platform,
    hardwareConcurrency: navigator.hardwareConcurrency, encodedBytes: longFile.size,
    decodedPcmBytes: longAudio.pcm.channels.reduce((sum, channel) => sum + channel.byteLength, 0), phases,
    importThroughCopyMs: copied - start, measurementSetupMs: measured - copied,
    cursor100Ms: cursorEnd - cursorStart, jsHeapBefore: heapBefore, jsHeapAfter: heap(),
    memoryCaveat: 'JS heap observations exclude a reliable accounting of native decoder memory and are not a peak-memory bound.' }));
  const uiStart = performance.now(); upload(longFile);
  await waitFor(ready, 'Five-minute UI import');
  assert(doc.body.textContent!.includes('300.000000 s'), 'Five-minute duration in UI');
  outcomes.push(`Five-minute real UI import completed in ${performance.now() - uiStart} ms`);
  document.body.textContent = outcomes.join('\n');
  document.body.dataset.status = 'passed';
}
run().catch(error => {
  document.body.dataset.status = 'failed';
  document.body.textContent = error instanceof Error ? `${error.message}\n${error.stack}` : String(error);
});
