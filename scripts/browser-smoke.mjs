import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

// Use Chromium's built-in debugging protocol and Node's WebSocket; no test framework.
const profile = await mkdtemp(join(tmpdir(), 'soundscape-browser-'));
const server = await createServer({ cacheDir: join(profile, 'vite-cache'), server: { host: '127.0.0.1', port: 5173 }, plugins: [{
  name: 'spectral-smoke-entry',
  configureServer(server) {
    server.middlewares.use('/__spectral-smoke.html', (_request, response) => {
      response.setHeader('Content-Type', 'text/html');
      response.end(`<!doctype html><html><body data-status="pending">Spectral smoke pending<script type="module" src="/scripts/spectral-browser.ts" onerror="document.body.dataset.status='failed';document.body.textContent='Spectral smoke module failed to load'"></script></body></html>`);
    });
  },
}] });
let browser;
let socket;
let closeBrowser;
let stderr = '';
try {
  await server.listen();
  const args = ['--headless', '--disable-gpu', '--disable-dev-shm-usage', '--no-proxy-server',
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
  const deadline = Date.now() + 30000;
  while (!debugPort && Date.now() < deadline) {
    if (launchError) throw launchError;
    if (browser.exitCode !== null || browser.signalCode !== null) throw new Error(`Chromium exited: ${stderr}`);
    try { debugPort = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); }
    catch { await delay(100); }
  }
  if (!debugPort) throw new Error(`Chromium debugging endpoint did not start: ${stderr}`);
  const url = `http://127.0.0.1:${server.httpServer.address().port}/__spectral-smoke.html`;
  const response = await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(url)}`, { method: 'PUT', signal: AbortSignal.timeout(5000) });
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
  let outcome;
  while (Date.now() < deadline) {
    const result = await command('Runtime.evaluate', { expression: 'JSON.stringify({status:document.body?.dataset.status,text:document.body?.textContent})', returnByValue: true });
    outcome = JSON.parse(result.result.value);
    if (outcome.status === 'passed' || outcome.status === 'failed') break;
    await delay(100);
  }
  if (outcome?.status !== 'passed' || exceptions.length) {
    throw new Error(`Browser smoke failed: ${JSON.stringify({ outcome, exceptions })}`);
  }
  console.log(outcome.text);
} finally {
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
