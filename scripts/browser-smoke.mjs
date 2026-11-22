import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

// Use Chromium's built-in debugging protocol and Node's WebSocket; no test framework.
const profile = await mkdtemp(join(tmpdir(), 'soundscape-browser-'));
const smokeEntry = ['import', 'playback', 'responsiveness'].includes(process.env.SMOKE_ENTRY) ? process.env.SMOKE_ENTRY : 'spectral';
const server = await createServer({ cacheDir: join(profile, 'vite-cache'), server: { host: '127.0.0.1', port: 5173 }, plugins: [{
  name: 'spectral-smoke-entry',
  transform(source, id) {
    if (smokeEntry !== 'responsiveness' || !id.includes('/src/')) return;
    const calls = {
      '/browser/import-audio.ts': [['new Float32Array(samples)', 'copy'], ['validatePcm(pcm)', 'copy validation']],
      '/song-inspection.ts': [['measureAudio(pcm)', 'whole-record total'], ['createSpectrumAnalyzer(pcm, { fftSize: INSPECTION_FFT_SIZE })', 'analyzer total']],
      '/waveform-overview.ts': [['validatePcm(pcm)', 'waveform validation']],
      '/song-session.ts': [['createWaveformOverview(pcm)', 'waveform total']],
      '/audio/measurements.ts': [['validatePcm(input)', 'measurement validation']],
      '/audio/spectrum.ts': [['validatePcm(input)', 'analyzer validation']],
    };
    let changed = false;
    for (const [suffix, entries] of Object.entries(calls)) {
      if (!id.endsWith(suffix)) continue;
      for (const [call, name] of entries) {
        source = source.replaceAll(call, `__profileImport(${JSON.stringify(name)}, () => ${call})`);
        changed = true;
      }
    }
    if (id.endsWith('/song-inspection.ts')) {
      source = source.replace('yield* measureAudioSteps(pcm)', "yield* __profileSteps('whole-record total', measureAudioSteps(pcm))");
      source += `
function* __profileSteps(name, steps) { let step; do { step = __profileImport(name, () => steps.next()); if (!step.done) yield; } while (!step.done); return step.value; }`;
      changed = true;
    }
    if (changed) return source + `
function __profileImport(name, run) { const start = performance.now(); try { return run(); } finally { performance.measure('import: ' + name, {start, end: performance.now()}); } }`;
  },
  configureServer(server) {
    server.middlewares.use('/__spectral-smoke.html', (_request, response) => {
      response.setHeader('Content-Type', 'text/html');
      response.end(`<!doctype html><html><body data-status="pending">Browser checks pending<script type="module" src="/scripts/${smokeEntry}-browser.ts" onerror="document.body.dataset.status='failed';document.body.textContent='Browser check module failed to load'"></script></body></html>`);
    });
  },
}] });
let browser;
let socket;
let closeBrowser;
let probeTimer;
let stderr = '';
try {
  await server.listen();
  const args = [ ...(process.env.CHROMIUM_HEADLESS === '0' ? [] : ['--headless']), '--disable-gpu', '--disable-dev-shm-usage', '--no-proxy-server',
    '--disable-background-networking', '--no-first-run', `--user-data-dir=${profile}`,
    '--remote-debugging-port=0', 'about:blank'];
  // Explicit opt-in only for containers whose Chromium sandbox is unavailable.
  if (process.env.CHROMIUM_NO_SANDBOX === '1') args.unshift('--no-sandbox');
  browser = spawn(process.env.CHROMIUM || 'chromium', args, {
    env: { ...process.env, XDG_CONFIG_HOME: profile, XDG_CACHE_HOME: profile }, stdio: ['ignore', 'ignore', 'pipe'],
  });
  let launchError;
  browser.on('error', error => { launchError = error; });
  browser.stderr.on('data', data => { stderr = (stderr + data).slice(-12000); });
  let debugPort;
  const deadline = Date.now() + (smokeEntry !== 'spectral' ? 120000 : 30000);
  while (!debugPort && Date.now() < deadline) {
    if (launchError) throw launchError;
    if (browser.exitCode !== null || browser.signalCode !== null) throw new Error(`Chromium exited: ${stderr}`);
    try { debugPort = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); }
    catch { await delay(100); }
  }
  if (!debugPort) throw new Error(`Chromium debugging endpoint did not start: ${stderr}`);
  const url = new URL(`http://127.0.0.1:${server.httpServer.address().port}/__spectral-smoke.html`);
  if (smokeEntry === 'responsiveness' && process.env.STARTUP_VARIANT) url.searchParams.set('startup', process.env.STARTUP_VARIANT);
  const response = await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(url.toString())}`, { method: 'PUT', signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`Chromium target creation failed: ${response.status}`);
  const target = await response.json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  const exceptions = [];
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails);
    const request = pending.get(message.id);
    if (request) { pending.delete(message.id); request(message); }
  });
  const command = async (method, params = {}) => {
    const requestId = ++id;
    let timer;
    try {
      const result = await Promise.race([
        new Promise(resolve => { pending.set(requestId, resolve); socket.send(JSON.stringify({ id: requestId, method, params })); }),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`CDP timeout: ${method}`)), 5000); }),
      ]);
      if (result.error) throw new Error(JSON.stringify(result.error));
      return result.result;
    } finally { clearTimeout(timer); pending.delete(requestId); }
  };
  closeBrowser = () => command('Browser.close');
  await command('Runtime.enable');
  if (smokeEntry === 'responsiveness') {
    await command('Page.bringToFront');
    probeTimer = setInterval(() => {
      void command('Input.dispatchMouseEvent', { type: 'mousePressed', x: 60, y: 20, button: 'left', clickCount: 1 }).catch(() => {});
      void command('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 60, y: 20, button: 'left', clickCount: 1 }).catch(() => {});
    }, 20);
  }
  if (smokeEntry === 'playback') await command('Emulation.setDeviceMetricsOverride', { width: 1400, height: 2400, deviceScaleFactor: 1, mobile: false });
  let outcome;
  let lastStage;
  while (Date.now() < deadline) {
    const result = await command('Runtime.evaluate', { expression: 'JSON.stringify({status:document.body?.dataset.status,text:document.body?.textContent,capture:document.body?.dataset.capture,gesture:document.body?.dataset.gesture,key:document.body?.dataset.key,stage:document.body?.dataset.stage})', returnByValue: true });
    outcome = JSON.parse(result.result.value);
    if (smokeEntry === 'playback' && outcome.stage !== lastStage) { console.log(`Playback check: ${outcome.stage}`); lastStage = outcome.stage; }
    if (smokeEntry === 'playback' && outcome.gesture) {
      const point = JSON.parse(outcome.gesture);
      console.log(`Trusted gesture: ${JSON.stringify(point)}`);
      await command('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
      await command('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
      await command('Runtime.evaluate', { expression: 'delete document.body.dataset.gesture' });
    }
    if (smokeEntry === 'playback' && outcome.key) {
      const key = JSON.parse(outcome.key);
      await command('Input.dispatchKeyEvent', { type: 'keyDown', ...key });
      await command('Input.dispatchKeyEvent', { type: 'keyUp', ...key });
      await command('Runtime.evaluate', { expression: 'delete document.body.dataset.key' });
    }
    if (smokeEntry !== 'spectral' && ['desktop', 'narrow'].includes(outcome.capture)) {
      const bounds = await command('Runtime.evaluate', { expression: 'JSON.stringify((()=>{const r=document.querySelector("iframe").getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scale:1}})())', returnByValue: true });
      const screenshot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: JSON.parse(bounds.result.value) });
      const path = join(tmpdir(), `soundscape-${smokeEntry}-${outcome.capture}.png`);
      await writeFile(path, Buffer.from(screenshot.data, 'base64'));
      console.log(`Screenshot: ${path}`);
      await command('Runtime.evaluate', { expression: 'delete document.body.dataset.capture' });
    }
    if (outcome.status === 'passed' || outcome.status === 'failed') break;
    await delay(100);
  }
  if (outcome?.status !== 'passed' || exceptions.length) {
    if (smokeEntry === 'playback') {
      const shot = await command('Page.captureScreenshot', { format: 'png' }).catch(() => undefined);
      if (shot) { const path = join(tmpdir(), 'soundscape-playback-failure.png'); await writeFile(path, Buffer.from(shot.data, 'base64')); console.log(`Failure screenshot: ${path}`); }
    }
    throw new Error(`Browser smoke failed: ${JSON.stringify({ outcome, exceptions })}`);
  }
  console.log(outcome.text);
} finally {
  clearInterval(probeTimer);
  if (browser && browser.exitCode === null && browser.signalCode === null) {
    const exited = new Promise(resolve => browser.once('exit', resolve));
    if (closeBrowser) await closeBrowser().catch(() => {});
    await Promise.race([exited, delay(1000)]);
    if (browser.exitCode === null && browser.signalCode === null) browser.kill('SIGKILL');
    await exited;
  }
  socket?.close();
  await server.close();
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
