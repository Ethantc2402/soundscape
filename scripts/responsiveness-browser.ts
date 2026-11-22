import { wavFixture } from './wav-fixture';

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
async function run() {
  // Diagnostic constructor variants never affect the production adapter.
  const startupVariant = new URL(location.href).searchParams.get('startup') ?? 'default';
  if (!['default', 'rate', 'playback-latency', 'silent-switch'].includes(startupVariant)) throw new Error('Unknown startup variant');
  const iframe = document.createElement('iframe');
  iframe.src = '/'; iframe.style.cssText = 'width:1200px;height:1800px;display:block;margin-top:50px';
  document.body.append(iframe);
  const end = performance.now() + 30000;
  async function waitFor(test: () => boolean) {
    while (!test()) { if (performance.now() > end) throw new Error('Timed out: ' + JSON.stringify({ status: iframe.contentDocument?.querySelector('.transport-buttons')?.parentElement?.textContent?.slice(-2200), native: document.body.dataset.startupCosts })); await delay(10); }
  }
  await waitFor(() => !!iframe.contentDocument?.querySelector('#song-file:not(:disabled)'));
  const doc = iframe.contentDocument!;
  const win = iframe.contentWindow as Window & typeof globalThis;
  // Generate bytes before observing the app, so fixture generation is excluded.
  const file = new File([wavFixture({ frames: 48000 * 300, sample: (i, c) => i % 4 === 1 ? (c + 1) / 64 : 0 })], 'five-minute.wav');
  const probe = document.createElement('button'); probe.textContent = 'Interaction probe';
  probe.style.cssText = 'position:fixed;left:0;top:0;width:140px;height:40px;z-index:10000';
  document.body.append(probe);
  type Observation = { clicks: number[]; timerGaps: number[]; frameGaps: number[]; elapsedMs?: number };
  const observations: Record<string, Observation> = {};
  let stage = 'idle';
  let contextFinished = Infinity;
  const postContext = { clicks: [] as number[], timerGaps: [] as number[], frameGaps: [] as number[] };
  const record = () => observations[stage];
  probe.onclick = event => { if (event.isTrusted) record()?.clicks.push(performance.now() - event.timeStamp); };
  let previousTimer = performance.now();
  const timer = setInterval(() => { const now = performance.now(); record()?.timerGaps.push(now - previousTimer); if (previousTimer >= contextFinished) postContext.timerGaps.push(now - previousTimer); previousTimer = now; }, 10);
  let previousFrame = performance.now(); let frame = 0;
  function paint(now: number) { record()?.frameGaps.push(now - previousFrame); if (previousFrame >= contextFinished) postContext.frameGaps.push(now - previousFrame); previousFrame = now; frame = requestAnimationFrame(paint); }
  frame = requestAnimationFrame(paint);
  async function observe(name: string, action: () => void, done: () => boolean) {
    await delay(100);
    observations[name] = { clicks: [], timerGaps: [], frameGaps: [] }; stage = name;
    const start = performance.now(); action();
    await waitFor(done); observations[name]!.elapsedMs = performance.now() - start;
    // Include the frame/input delayed by the final synchronous work.
    await delay(100); stage = 'idle';
  }
  win.performance.clearMeasures();
  await observe('preparation', () => {
    const transfer = new DataTransfer(); transfer.items.add(file);
    const input = doc.querySelector<HTMLInputElement>('#song-file')!;
    input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true }));
  }, () => !!doc.querySelector('.song-results'));
  const nativeCosts: { allocationMs: number[]; copyMs: number[]; startMs: number[]; contextMs: number[]; resumeCallMs: number[] } = { allocationMs: [], copyMs: [], startMs: [], contextMs: [], resumeCallMs: [] };
  const resumeReadyMs: number[] = [];
  const sinkCallMs: number[] = [];
  const sinkReadyMs: number[] = [];
  const contextEvents: { state: string; at: number }[] = [];
  const debugCosts = () => { document.body.dataset.startupCosts = JSON.stringify({ nativeCosts, contextEvents, sinkCallMs, sinkReadyMs, resumeReadyMs, contextDetails }); };
  const contextDetails: { sampleRate: number; baseLatency: number; sinkId: unknown }[] = [];
  type SinkContext = AudioContext & { setSinkId?: (id: string) => Promise<void>; sinkId?: unknown };
  const NativeContext = win.AudioContext;
  win.AudioContext = class extends NativeContext {
    constructor(options?: AudioContextOptions) {
      const actualOptions = startupVariant === 'rate' ? { ...options, sampleRate: 48000 }
        : startupVariant === 'playback-latency' ? { ...options, latencyHint: 'playback' as const }
        : startupVariant === 'silent-switch' ? { ...options, sinkId: { type: 'none' }, sampleRate: 48000 } : options;
      const start = performance.now(); super(actualOptions); nativeCosts.contextMs.push(performance.now() - start); contextFinished = performance.now();
      const sink = (this as SinkContext).sinkId;
      contextDetails.push({ sampleRate: this.sampleRate, baseLatency: this.baseLatency,
        sinkId: typeof sink === 'object' && sink !== null ? { type: (sink as { type?: string }).type } : sink });
      this.addEventListener('statechange', () => { contextEvents.push({ state: this.state, at: performance.now() }); debugCosts(); });
      debugCosts();
    }
    override resume() {
      const start = performance.now(); const result = super.resume();
      nativeCosts.resumeCallMs.push(performance.now() - start);
      let routed = Promise.resolve();
      if (startupVariant === 'silent-switch') {
        const sinkContext = this as SinkContext;
        if (!sinkContext.setSinkId) throw new Error('Silent-switch diagnostic unsupported');
        const sinkStart = performance.now();
        routed = sinkContext.setSinkId('');
        sinkCallMs.push(performance.now() - sinkStart);
        routed = routed.then(() => { sinkReadyMs.push(performance.now() - sinkStart); debugCosts(); });
      }
      debugCosts();
      return Promise.all([result, routed]).then(() => { resumeReadyMs.push(performance.now() - start); debugCosts(); });
    }
  };
  const createBuffer = win.AudioContext.prototype.createBuffer;
  win.AudioContext.prototype.createBuffer = function (...args) {
    const start = performance.now(); const result = createBuffer.apply(this, args);
    nativeCosts.allocationMs.push(performance.now() - start); return result;
  };
  const copyToChannel = win.AudioBuffer.prototype.copyToChannel;
  win.AudioBuffer.prototype.copyToChannel = function (...args) {
    const start = performance.now(); copyToChannel.apply(this, args);
    nativeCosts.copyMs.push(performance.now() - start);
  };
  const sourceStart = win.AudioBufferSourceNode.prototype.start;
  win.AudioBufferSourceNode.prototype.start = function (...args) {
    const start = performance.now(); sourceStart.apply(this, args);
    nativeCosts.startMs.push(performance.now() - start);
  };
  // The probe's trusted pointer activation precedes Play; resume remains inside a click.
  let clicked = false;
  let activationAtPlay = false;
  probe.onclick = event => {
    if (!event.isTrusted) return;
    record()?.clicks.push(performance.now() - event.timeStamp);
    if (event.timeStamp >= contextFinished) postContext.clicks.push(performance.now() - event.timeStamp);
    if (stage === 'firstPlay' && !clicked) {
      clicked = true;
      activationAtPlay = win.navigator.userActivation.isActive;
      Array.from(doc.querySelectorAll('button')).find(button => button.textContent === 'Play')!.click();
    }
  };
  await observe('firstPlay', () => {}, () => !!doc.body.textContent?.includes('Playing.'));
  clearInterval(timer); cancelAnimationFrame(frame);
  const summary = Object.fromEntries(Object.entries(observations).map(([name, data]) => [name, {
    elapsedMs: data.elapsedMs,
    trustedClickCount: data.clicks.length, maxClickDelayMs: Math.max(0, ...data.clicks),
    maxTimerGapMs: Math.max(0, ...data.timerGaps), maxFrameGapMs: Math.max(0, ...data.frameGaps),
    frameGapsOver50Ms: data.frameGaps.filter(value => value > 50).length,
  }]));
  if (Object.values(observations).some(value => !value.clicks.length || !value.frameGaps.length)) throw new Error('Missing foreground interaction/frame evidence');
  if (!activationAtPlay || document.hidden || doc.hidden) throw new Error('Missing foreground/activation evidence');
  const result = { startupVariant, contextDetails, contextEvents, resumeReadyMs, sinkCallMs, sinkReadyMs, browser: navigator.userAgent, hidden: document.hidden, iframeHidden: doc.hidden, focused: document.hasFocus(), activationAtPlay,
    measurements: summary, observations, nativeCosts, postContext, importPhases: win.performance.getEntriesByType('measure').filter(entry => entry.name.startsWith('import:')).map(entry => ({ name: entry.name, durationMs: entry.duration })),
    caveat: 'CDP pointer probe at 20 ms intervals; timer at 10 ms; rAF gaps are observed callbacks, not measured physical dropped frames. First Play is triggered in a probe click handler using an activated document. No physical audio/display synchronization or native-memory claim.' };
  iframe.remove(); document.body.textContent = JSON.stringify(result); document.body.dataset.status = 'passed';
}
run().catch(error => { document.body.textContent = String(error); document.body.dataset.status = 'failed'; });
