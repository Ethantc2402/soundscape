import { copyPlaybackBuffer, connectPlaybackSource } from '../src/browser/song-playback';
import { createWaveformOverview } from '../src/waveform-overview';
import { createSongInspection } from '../src/song-inspection';
import { wavFixture } from './wav-fixture';
import { createElement, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ImportedSong } from '../src/ImportedSong';

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
const delay = (ms = 20) => new Promise<void>(resolve => setTimeout(resolve, ms));
async function waitFor(test: () => boolean, label: string) {
  document.body.dataset.stage = label;
  const end = performance.now() + 15000;
  while (!test()) { if (performance.now() > end) throw new Error(`Timeout: ${label}; UI: ${document.querySelector('iframe')?.contentDocument?.querySelector('.song-results')?.textContent?.slice(0, 1600)}`); await delay(); }
}
async function run() {
  const results: string[] = [];
  // Matched-rate direct-copy oracle: independent sample-index schedule.
  const rate = 48000;
  const left = new Float32Array(480);
  const right = new Float32Array(480);
  left[0] = 0.125; left[240] = -0.25; left[479] = 0.0625;
  for (let i = 100; i < 200; i++) right[i] = [0, 0.125, 0, -0.125][i % 4]!;
  const pcm = { sampleRate: rate, channels: [left, right] as const };
  const context = new OfflineAudioContext(2, 2400, rate);
  const buffer = copyPlaybackBuffer(context, pcm);
  const first = connectPlaybackSource(context, buffer, false);
  first.start(120 / rate, 240 / rate); first.stop(300 / rate);
  const looping = connectPlaybackSource(context, buffer, true);
  looping.start(600 / rate); looping.stop(1680 / rate);
  const restart = connectPlaybackSource(context, buffer, false);
  restart.start(1800 / rate);
  const rendered = await context.startRendering();
  [left, right].forEach((samples, channel) => {
    const actual = rendered.getChannelData(channel);
    for (let i = 0; i < actual.length; i++) {
      const expected = i >= 120 && i < 300 ? samples[i - 120 + 240]!
        : i >= 600 && i < 1680 ? samples[(i - 600) % 480]!
        : i >= 1800 && i < 2280 ? samples[i - 1800]! : 0;
      assert(Math.abs(actual[i]! - expected) <= 1e-7, `Graph channel ${channel} sample ${i}: ${actual[i]} vs ${expected}`);
    }
  });
  assert(left[240] === -0.25 && right[101] === 0.125, 'PCM preserved');
  // Different device/context rate: duration and impulse alignment, no bitwise resampler claim.
  const converted = new OfflineAudioContext(2, 2205, 44100);
  // Isolate the central impulse: a half-sample resampled peak can be smaller
  // than the lower-amplitude, grid-aligned first impulse of the matched fixture.
  const isolated = new Float32Array(480); isolated[240] = -0.25;
  const resampled = connectPlaybackSource(converted, copyPlaybackBuffer(converted,
    { sampleRate: rate, channels: [isolated, new Float32Array(480).fill(0.03125)] }), false);
  resampled.start(0.01);
  const output = await converted.startRendering();
  const samples = output.getChannelData(0);
  let strongest = 0;
  for (let i = 0; i < samples.length; i++) if (Math.abs(samples[i]!) > Math.abs(samples[strongest]!)) strongest = i;
  assert(Math.abs(strongest - 0.015 * 44100) <= 1, `Resampled central impulse within one context sample: peak ${strongest}, expected ${0.015 * 44100}`);
  const durationSamples = output.getChannelData(1);
  const firstActive = durationSamples.findIndex(value => Math.abs(value) > 1e-6);
  let lastActive = -1;
  for (let i = 0; i < durationSamples.length; i++) if (Math.abs(durationSamples[i]!) > 1e-6) lastActive = i;
  assert(Math.abs(firstActive - 441) <= 1 && Math.abs(lastActive - 881) <= 1,
    `Resampled duration edges: ${firstActive}..${lastActive}, expected 441..881`);
  const overRange = new Float32Array([2, -3]);
  const copiedOverRange = copyPlaybackBuffer(new OfflineAudioContext(1, 2, rate), { sampleRate: rate, channels: [overRange] });
  assert(copiedOverRange.getChannelData(0)[0] === 2 && copiedOverRange.getChannelData(0)[1] === -3 &&
    overRange[0] === 2 && overRange[1] === -3, 'Native copy preserves finite over-range PCM');
  results.push('Offline actual adapter graph: offset/stop/restart/native loop seam, independent L/R impulses and tone burst passed (1e-7 amplitude); 48→44.1 kHz impulse alignment/duration edges within one sample; native over-range copy preserved.');

  const iframe = document.createElement('iframe');
  iframe.src = '/'; iframe.style.width = '1200px'; iframe.style.height = '1800px'; iframe.style.display = 'block';
  document.body.textContent = ''; document.body.append(iframe);
  await waitFor(() => !!iframe.contentDocument?.querySelector('#song-file:not(:disabled)'), 'React');
  const doc = iframe.contentDocument!;
  const win = iframe.contentWindow as Window & typeof globalThis;
  let deviceContext: AudioContext | undefined;
  const nativeResume = win.AudioContext.prototype.resume;
  let rejectResume = false;
  win.AudioContext.prototype.resume = function () {
    deviceContext = this;
    if (rejectResume) { rejectResume = false; return Promise.reject(new win.Error('Injected resume failure')); }
    return nativeResume.call(this);
  };
  function upload(frames: number, name = 'playback.wav') {
    const file = new File([wavFixture({ frames, sample: (frame, channel) => frame % 48000 < 4800
      ? [0, channel === 0 ? 0.03125 : 0.015625, 0, channel === 0 ? -0.03125 : -0.015625][frame % 4]! : 0 })], name, { type: 'audio/wav' });
    const transfer = new DataTransfer(); transfer.items.add(file);
    const input = doc.querySelector<HTMLInputElement>('#song-file')!;
    input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function button(text: string) { return Array.from(doc.querySelectorAll('button')).find(el => el.textContent === text)!; }
  async function gesture(el: Element) {
    el.scrollIntoView({ block: 'center' }); iframe.scrollIntoView({ block: 'start' });
    const outer = iframe.getBoundingClientRect(); const r = el.getBoundingClientRect();
    document.body.dataset.gesture = JSON.stringify({ label: el.tagName + ':' + (el.textContent || el.getAttribute('type')), x: outer.x + iframe.clientLeft + r.x + r.width / 2,
      y: outer.y + iframe.clientTop + r.y + r.height / 2 });
    await waitFor(() => !document.body.dataset.gesture, 'Trusted mouse gesture');
  }
  async function key(key: string, code: string, windowsVirtualKeyCode: number) {
    document.body.dataset.key = JSON.stringify({ key, code, windowsVirtualKeyCode });
    await waitFor(() => !document.body.dataset.key, 'Trusted keyboard input');
  }
  function input(id: string, value: string) {
    const el = doc.querySelector<HTMLInputElement>(id)!;
    Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  const text = () => doc.body.textContent!;
  const ready = () => !!doc.querySelector('.song-results');
  upload(rate * 2);
  await waitFor(ready, 'Song ready');
  let trusted = false;
  doc.addEventListener('click', event => { if ((event.target as Element).textContent === 'Play') trusted = event.isTrusted; }, { capture: true });
  await gesture(button('Play'));
  await waitFor(() => text().includes('Playing.'), 'Playing');
  assert(trusted, 'Play click must be trusted, no autoplay bypass');
  await delay(200);
  await gesture(button('Pause'));
  await waitFor(() => text().includes('Paused.'), 'Pause');
  input('#song-time', ''); await delay();
  assert(doc.querySelector('#song-time')?.getAttribute('aria-invalid') === 'true', 'Empty seek invalid');
  input('#song-time', '5'); await delay();
  assert(doc.querySelector('#song-time')?.getAttribute('aria-invalid') === 'true', 'Out of range invalid');
  input('#song-time', '0.5');
  await waitFor(() => text().includes('start at 24000;'), 'Seek full window');
  input('#song-position', '1'); await waitFor(() => text().includes('start at 48000;'), 'Range seek');
  input('#song-time', '0.25');
  await waitFor(() => text().includes('Sample 12000') && text().includes('start at 12000;'), 'Before waveform seek');
  const svg = doc.querySelector('svg')!;
  // The driver clicks the SVG center: half of the two-second, 48 kHz fixture.
  const midpointSample = rate * 2 / 2;
  await gesture(svg);
  await waitFor(() => text().includes(`Sample ${midpointSample} ·`) &&
    text().includes(`start at ${midpointSample};`), 'Waveform midpoint changes playhead and analysis');
  const loop = doc.querySelector<HTMLInputElement>('input[type=checkbox]')!;
  await gesture(loop); assert(loop.checked, 'Loop enabled');
  input('#song-time', '1.9'); await gesture(button('Play')); await delay(300);
  await waitFor(() => text().includes('Playing.'), 'Native loop continues');
  await gesture(button('Pause')); await waitFor(() => text().includes('Paused.'), 'Loop pause drained'); await gesture(loop); assert(!loop.checked, 'Loop disabled');
  input('#song-time', '2'); await waitFor(() => text().includes('Sample 96000'), 'Exact end');
  await gesture(button('Play')); await waitFor(() => text().includes('Playing.'), 'Replay');
  await gesture(button('Pause')); await waitFor(() => text().includes('Paused.'), 'Replay pause drained');
  // Natural end must retain the final full analysis window.
  input('#song-time', '1.9'); await gesture(button('Play'));
  await waitFor(() => text().includes('Sample 96000'), 'Natural end');
  await waitFor(() => text().includes('start at 87808;'), 'Final window clamps at N-L');
  results.push(JSON.stringify({ deviceContextRate: deviceContext?.sampleRate, timestamp: deviceContext?.getOutputTimestamp?.(),
    timingUi: Array.from(doc.querySelectorAll('p')).find(el => el.textContent?.startsWith('Playhead:'))?.textContent,
    route: 'Not verified; headless process, system_profiler reported no audio devices.' }));
  rejectResume = true; await gesture(button('Play'));
  await waitFor(() => text().includes('Injected resume failure'), 'Playback error');
  await gesture(button('Play')); await waitFor(() => text().includes('Playing.'), 'Playback retry');
  await gesture(button('Pause')); await waitFor(() => text().includes('Paused.'), 'Retry pause drained');
  for (const width of [1200, 320]) {
    iframe.style.width = `${width}px`; await delay(100);
    assert(doc.documentElement.scrollWidth <= doc.documentElement.clientWidth, `${width}px no overflow`);
    document.body.dataset.capture = width === 320 ? 'narrow' : 'desktop';
    await waitFor(() => !document.body.dataset.capture, 'Screenshot');
  }
  const seekInput = doc.querySelector<HTMLInputElement>('#song-time')!;
  seekInput.focus(); input('#song-time', '0.25'); await delay(100);
  assert(doc.activeElement === seekInput, 'Seek retains focus through snapshots');
  const range = doc.querySelector<HTMLInputElement>('#song-position')!; range.focus();
  await key('ArrowRight', 'ArrowRight', 39);
  await waitFor(() => Number(range.value) > 0.25, 'Keyboard range seek');
  loop.focus(); await key(' ', 'Space', 32);
  assert(loop.checked, 'Keyboard loop toggle');
  upload(4, 'short.wav'); await waitFor(() => text().includes('Too short'), 'Playable short audio');
  assert(button('Play'), 'Short audio has transport');
  results.push('Real React UI with trusted CDP pointer activation (no autoplay bypass): play/pause, invalid numeric seek, range/waveform seek, loop, exact/natural end/replay, focus retention, short input, 1200/320px no overflow passed. Trusted keyboard range seek and loop toggle passed; full manual listening/assistive-technology QA remains unverified.');

  // Bounded five-minute stereo preparation/copy/analysis observation, no speed guarantee.
  const heap = () => (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize;
  const heapBefore = heap();
  const longPcm = { sampleRate: rate, channels: [new Float32Array(rate * 300), new Float32Array(rate * 300)] as const };
  const t0 = performance.now(); const overview = createWaveformOverview(longPcm); const t1 = performance.now();
  const offline = new OfflineAudioContext(2, 1, rate);
  const playbackBuffer = copyPlaybackBuffer(offline, longPcm); const t2 = performance.now();
  const inspection = createSongInspection(longPcm); const t3 = performance.now();
  for (let i = 0; i < 100; i++) inspection.inspect(i * 3);
  const t4 = performance.now();
  assert(playbackBuffer.length === rate * 300 && overview.bucketCount === 2048, 'Bounded five-minute storage');
  results.push(JSON.stringify({ browser: navigator.userAgent, platform: navigator.platform, hardwareConcurrency: navigator.hardwareConcurrency,
    waveformMs: t1 - t0, playbackValidationAllocationCopyMs: t2 - t1, inspectionSetupMs: t3 - t2, analysis100Ms: t4 - t3,
    nominalPcmBytes: 115200000, nominalPlaybackBytes: 115200000, extremaBytes: 32768, jsHeapBefore: heapBefore, jsHeapDuring: heap(),
    caveat: 'Headless macOS browser. Physical output route, refresh rate and audible sync not measured. Native memory, dropped frames and five-minute drift unverified. These timed synthetic preparations are not full interaction/performance acceptance.' }));
  const uiStart = performance.now(); upload(rate * 300, 'five-minute.wav');
  await waitFor(ready, 'Five-minute UI');
  const uiReady = performance.now();
  await gesture(button('Play')); await waitFor(() => text().includes('Playing.'), 'Five-minute first Play');
  const firstPlay = performance.now();
  input('#song-time', '299'); await waitFor(() => {
    const match = text().match(/start at (\d+);/);
    return !!match && Number(match[1]) >= 14352000;
  }, 'Five-minute seek');
  const sought = performance.now();
  const heapPlaying = heap();
  upload(4, 'replacement.wav'); await waitFor(() => text().includes('replacement.wav'), 'Replace while playing');
  results.push(JSON.stringify({ fiveMinuteUiImportMs: uiReady - uiStart, firstPlayThroughTrustedDriverMs: firstPlay - uiReady,
    seekThroughDomObservationMs: sought - firstPlay, jsHeapPlaying: heapPlaying, jsHeapAfterReplacement: heap(),
    caveat: 'Response includes driver polling. JS heap is process-wide and does not quantify released native audio storage.' }));
  iframe.remove();
  // Instrument actual React effect replay/unmount with a controlled deferred native
  // resume. This is lifecycle evidence, separate from trusted-activation evidence.
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const nativeContext = window.AudioContext;
  const nativeAdd = document.addEventListener.bind(document);
  const nativeRemove = document.removeEventListener.bind(document);
  const nativeRaf = window.requestAnimationFrame.bind(window);
  const nativeCancel = window.cancelAnimationFrame.bind(window);
  const listeners = new Set<EventListenerOrEventListenerObject>();
  const frames = new Set<number>();
  let resumeDeferred: (() => void) | undefined;
  let sourcesCreated = 0;
  let contextsCreated = 0;
  let contextsClosed = 0;
  class DeferredContext extends nativeContext {
    constructor() { super(); contextsCreated++; }
    override resume() { return new Promise<void>(resolve => { resumeDeferred = resolve; }); }
    override close() { contextsClosed++; return super.close(); }
    override createBufferSource() { sourcesCreated++; return super.createBufferSource(); }
  }
  window.AudioContext = DeferredContext;
  document.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: AddEventListenerOptions | boolean) => {
    if (type === 'visibilitychange') listeners.add(listener);
    nativeAdd(type, listener, options);
  }) as typeof document.addEventListener;
  document.removeEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: EventListenerOptions | boolean) => {
    if (type === 'visibilitychange') listeners.delete(listener);
    nativeRemove(type, listener, options);
  }) as typeof document.removeEventListener;
  window.requestAnimationFrame = callback => {
    const id = nativeRaf(time => { frames.delete(id); callback(time); }); frames.add(id); return id;
  };
  window.cancelAnimationFrame = id => { frames.delete(id); nativeCancel(id); };
  try {
    root.render(createElement(StrictMode, null, createElement(ImportedSong)));
    await waitFor(() => !!host.querySelector('#song-file:not(:disabled)'), 'StrictMode import');
    const transfer = new DataTransfer(); transfer.items.add(new File([wavFixture()], 'strict.wav', { type: 'audio/wav' }));
    const file = host.querySelector<HTMLInputElement>('#song-file')!;
    file.files = transfer.files; file.dispatchEvent(new Event('change', { bubbles: true }));
    await waitFor(() => !!host.querySelector('.waveform-overview'), 'StrictMode ready/effect replay');
    assert(Number(listeners.size) === 2, 'Exactly one adapter and one UI visibility listener after replay');
    const play = Array.from(host.querySelectorAll('button')).find(el => el.textContent === 'Play')!;
    play.click(); await waitFor(() => !!resumeDeferred, 'Deferred native resume');
    root.unmount();
    assert(listeners.size === 0 && frames.size === 0, 'Unmount removes visibility listeners and animation');
    assert(contextsCreated === 1 && contextsClosed === 1, 'One lazy context, closed once');
    resumeDeferred!(); await delay(50);
    assert(sourcesCreated === 0, 'Disposed pending resume cannot create a source');
    assert(!host.textContent, 'No stale UI after unmount');
    results.push('Instrumented actual React StrictMode effect replay/unmount passed: one adapter/context, no surviving visibility listener or animation, late resume creates no source or UI.');
  } finally {
    window.AudioContext = nativeContext; document.addEventListener = nativeAdd;
    document.removeEventListener = nativeRemove; window.requestAnimationFrame = nativeRaf;
    window.cancelAnimationFrame = nativeCancel; host.remove();
  }
  document.body.textContent = results.join('\n'); document.body.dataset.status = 'passed';
}
run().catch(error => { document.body.dataset.status = 'failed'; document.body.textContent = `${error}\n${error instanceof Error ? error.stack : ''}`; });
