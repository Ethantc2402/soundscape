import { expect, it, vi } from 'vitest';
import { createSongPlayback } from './song-playback';
function harness() {
  const pcm = { sampleRate: 48000, channels: [new Float32Array([0, 2, -3, 0]), new Float32Array([1, 0, 0, -1])] as const };
  const doc = Object.assign(new EventTarget(), { hidden: false });
  const events = new EventTarget();
  const resumes: { resolve: () => void; reject: (error: Error) => void }[] = [];
  const copies: Float32Array[][] = [];
  const sources: { buffer: AudioBuffer | null; loop: boolean; onended: (() => void) | null;
    start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] = [];
  const context = {
    currentTime: 0, sampleRate: 44100, state: 'suspended', destination: {},
    resume: vi.fn(() => new Promise<void>((resolve, reject) => resumes.push({ resolve: () => { context.state = 'running'; resolve(); }, reject }))),
    close: vi.fn(async () => { context.state = 'closed'; }),
    addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events),
    getOutputTimestamp: () => ({ contextTime: Math.max(0, context.currentTime - 0.01), performanceTime: 1000 }),
    createBuffer: vi.fn((channels: number, length: number, rate: number) => {
      expect(rate).toBe(48000);
      const data = Array.from({ length: channels }, () => new Float32Array(length)); copies.push(data);
      return { copyToChannel: (samples: Float32Array, index: number) => data[index]!.set(samples) };
    }),
    createBufferSource: vi.fn(() => {
      const source = { buffer: null, loop: false, onended: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn(), disconnect: vi.fn() };
      sources.push(source); return source;
    }),
  };
  const playback = createSongPlayback(pcm, { context: () => context as unknown as AudioContext, document: doc, now: () => 1000 });
  return { pcm, playback, context, doc, events, resumes, copies, sources };
}
it('does not allocate before Play; deferred seek coalesces, copy preserves samples/order, reuses buffer', async () => {
  const h = harness();
  expect(h.context.createBuffer).not.toHaveBeenCalled();
  const playing = h.playback.play();
  expect(h.playback.play()).toBe(playing);
  h.playback.seek(1.9 / 48000);
  h.resumes[0]!.resolve(); await playing;
  expect(h.sources).toHaveLength(1);
  expect(h.sources[0]!.start).toHaveBeenCalledWith(0, 1 / 48000);
  expect(h.copies[0]).toEqual(h.pcm.channels);
  h.playback.seek(2 / 48000);
  expect(h.sources[0]!.stop).toHaveBeenCalledOnce();
  expect(h.sources[1]!.start).toHaveBeenCalledWith(0, 2 / 48000);
  expect(h.context.createBuffer).toHaveBeenCalledOnce();
  h.playback.dispose();
});
it.each(['pause', 'dispose', 'hidden'])('invalidates pending resume on %s without starting stale audio', async action => {
  const h = harness(); const playing = h.playback.play();
  if (action === 'hidden') { h.doc.hidden = true; h.doc.dispatchEvent(new Event('visibilitychange')); }
  else if (action === 'dispose') h.playback.dispose(); else h.playback.pause();
  h.resumes[0]!.resolve(); await playing;
  expect(h.sources).toHaveLength(0);
  if (action === 'dispose') { await h.playback.play(); expect(h.resumes).toHaveLength(1); }
  h.playback.dispose();
});
it('rapid play/pause/play ignores the first resume; failed resume permits retry', async () => {
  const h = harness(); const a = h.playback.play(); h.playback.pause(); const b = h.playback.play();
  h.resumes[0]!.resolve(); await a; expect(h.sources).toHaveLength(0);
  h.resumes[1]!.reject(new Error('denied')); await b;
  expect(h.playback.snapshot().error).toContain('denied');
  const retry = h.playback.play(); h.resumes[2]!.resolve(); await retry;
  expect(h.sources).toHaveLength(1); expect(h.playback.snapshot().error).toBe('');
  h.playback.dispose();
});
it('stale ended cannot reset restarted position; end/replay and loop use native source scheduling', async () => {
  const h = harness(); const play = h.playback.play(); h.resumes[0]!.resolve(); await play;
  const oldEnded = h.sources[0]!.onended!;
  h.playback.setLoop(true); expect(h.sources[1]!.loop).toBe(true);
  oldEnded(); expect(h.playback.snapshot().playing).toBe(true);
  h.playback.seek(4 / 48000);
  expect(h.playback.snapshot().sample).toBe(4); expect(h.playback.snapshot().playing).toBe(false);
  const replay = h.playback.play(); h.resumes[1]!.resolve(); await replay;
  expect(h.sources.at(-1)!.start).toHaveBeenCalledWith(0, 0);
  h.playback.setLoop(false);
  h.context.currentTime = 1;
  h.sources.at(-1)!.onended!();
  expect(h.playback.snapshot()).toMatchObject({ sample: 4, playing: false });
  h.playback.dispose();
});
it('pauses on interruption and removes document/context listeners on disposal', async () => {
  const h = harness(); const play = h.playback.play(); h.resumes[0]!.resolve(); await play;
  h.context.state = 'suspended'; h.events.dispatchEvent(new Event('statechange'));
  expect(h.sources[0]!.stop).toHaveBeenCalledOnce();
  expect(h.playback.snapshot().playing).toBe(false);
  h.playback.dispose(); h.playback.dispose();
  h.doc.dispatchEvent(new Event('visibilitychange')); h.events.dispatchEvent(new Event('statechange'));
  expect(h.context.close).toHaveBeenCalledOnce();
});

it('preserves exact snapped command sample indices despite seconds round trips', () => {
  const pcm = { sampleRate: 48000, channels: [new Float32Array(1000)] as const };
  const playback = createSongPlayback(pcm);
  for (const sample of [27, 49, 54, 61, 98]) {
    playback.seek((sample + 0.5) / 48000);
    expect(playback.snapshot().sample).toBe(sample);
  }
  playback.dispose();
});
it('seeking after natural end preserves stopped intent', async () => {
  const h = harness(); const playing = h.playback.play(); h.resumes[0]!.resolve(); await playing;
  h.context.currentTime = 1;
  h.sources[0]!.onended!();
  h.playback.seek(1 / 48000);
  expect(h.sources).toHaveLength(1);
  expect(h.playback.snapshot().playing).toBe(false);
  h.playback.dispose();
});

it('holds preceding output segments through queued seek/pause and settles only after output drains', async () => {
  const events = new EventTarget();
  let time = 0;
  let output = 0;
  const nodes: { onended: (() => void) | null; stop: ReturnType<typeof vi.fn> }[] = [];
  const context = {
    get currentTime() { return time; }, state: 'running', sampleRate: 44100, destination: {},
    resume: async () => {}, close: async () => {},
    addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events),
    createBuffer: () => ({ copyToChannel: () => {} }),
    createBufferSource: () => {
      const node = { buffer: null, loop: false, connect() {}, disconnect() {}, start() {}, stop: vi.fn(), onended: null };
      nodes.push(node); return node;
    },
    getOutputTimestamp: () => ({ contextTime: output, performanceTime: 1000 }),
  };
  const transport = createSongPlayback({ sampleRate: 48000, channels: [new Float32Array(480000)] },
    { context: () => context as unknown as AudioContext, now: () => 1000 });
  await transport.play();
  time = 1; output = 0.95;
  transport.seek(5);
  expect(transport.snapshot().timing).toBe('output estimate');
  expect(Math.abs(transport.snapshot().seconds - 0.95)).toBeLessThanOrEqual(1e-9);
  time = 1.1; output = 1.05;
  expect(Math.abs(transport.snapshot().seconds - 5.05)).toBeLessThanOrEqual(1e-9);
  transport.pause();
  expect(transport.snapshot().playing).toBe(true);
  time = 1.2; output = 1.15;
  expect(transport.snapshot().playing).toBe(false);
  expect(Math.abs(transport.snapshot().seconds - 5.1)).toBeLessThanOrEqual(1e-9);
  expect(nodes[0]!.stop).toHaveBeenCalledOnce();
  expect(nodes[1]!.stop).toHaveBeenCalledOnce();
  transport.dispose();
});

it('replays from end even before the source-ended notification arrives', async () => {
  const h = harness(); const playing = h.playback.play(); h.resumes[0]!.resolve(); await playing;
  h.context.currentTime = 1;
  const replay = h.playback.play();
  expect(h.resumes).toHaveLength(2);
  h.resumes[1]!.resolve(); await replay;
  expect(h.sources).toHaveLength(2);
  expect(h.sources[1]!.start).toHaveBeenCalledWith(1, 0);
  h.playback.dispose();
});

it('ignores a delayed ended callback while replay resume is pending', async () => {
  const h = harness(); const playing = h.playback.play(); h.resumes[0]!.resolve(); await playing;
  const ended = h.sources[0]!.onended!;
  h.context.currentTime = 1;
  const replay = h.playback.play();
  ended();
  h.resumes[1]!.resolve(); await replay;
  expect(h.sources).toHaveLength(2);
  expect(h.sources[1]!.start).toHaveBeenCalledWith(1, 0);
  // Observe the replay boundary after the preceding output has drained.
  vi.spyOn(h.context, 'getOutputTimestamp').mockReturnValue({ contextTime: 1, performanceTime: 1000 });
  expect(h.playback.snapshot()).toMatchObject({ sample: 0, playing: true, pending: false, error: '' });
  h.playback.dispose();
});

it.each([false, true])('preserves pending replay position when loop changes (seek while pending: %s)', async seek => {
  const h = harness();
  h.playback.seek(4 / 48000);
  const replay = h.playback.play();
  if (seek) h.playback.seek(2 / 48000);
  h.playback.setLoop(true);
  h.resumes[0]!.resolve(); await replay;
  expect(h.sources).toHaveLength(1);
  expect(h.sources[0]!.loop).toBe(true);
  expect(h.sources[0]!.start).toHaveBeenCalledWith(0, seek ? 2 / 48000 : 0);
  expect(h.playback.snapshot()).toMatchObject({ sample: seek ? 2 : 0, playing: true, loop: true, pending: false, error: '' });
  h.playback.dispose();
});

it('yields during a long first Play, shares one preparation across pause/replay and preserves chunk boundaries', async () => {
  const length = 262144 * 2 + 1;
  const left = new Float32Array(length); const right = new Float32Array(length);
  left[262143] = 2; left[262144] = -3; left[length - 1] = 0.125;
  right[0] = -0.25; right[262144] = 0.5;
  const pcm = { sampleRate: 48000, channels: [left, right] as const };
  const data = [new Float32Array(length), new Float32Array(length)];
  const yields: (() => void)[] = [];
  const source = { buffer: null, loop: false, onended: null, connect() {}, disconnect() {}, stop() {}, start: vi.fn() };
  const context = {
    currentTime: 0, state: 'running', destination: {}, resume: async () => {}, close: async () => {},
    addEventListener() {}, removeEventListener() {},
    createBuffer: vi.fn(() => ({ copyToChannel(samples: Float32Array, channel: number, offset: number) { data[channel]!.set(samples, offset); } })),
    createBufferSource: vi.fn(() => source),
  };
  const transport = createSongPlayback(pcm, { context: () => context as unknown as AudioContext,
    yieldToBrowser: () => new Promise(resolve => yields.push(resolve)) });
  const first = transport.play();
  await vi.waitFor(() => expect(yields).toHaveLength(1));
  expect(transport.snapshot().pending).toBe(true);
  expect(source.start).not.toHaveBeenCalled();
  transport.pause(); const replay = transport.play();
  transport.seek(27.5 / 48000); transport.setLoop(true);
  await Promise.resolve();
  expect(context.createBuffer).toHaveBeenCalledOnce();
  yields[0]!(); await vi.waitFor(() => expect(yields).toHaveLength(2));
  yields[1]!(); await Promise.all([first, replay]);
  expect(data).toEqual(pcm.channels);
  expect(source.start).toHaveBeenCalledOnce();
  expect(source.start).toHaveBeenCalledWith(0, 27 / 48000);
  expect(source.loop).toBe(true);
  transport.pause(); await transport.play();
  expect(context.createBuffer).toHaveBeenCalledOnce();
  transport.dispose();
});

it.each(['dispose', 'pause', 'hidden', 'interruption', 'invalid-tail'])('never starts a partial buffer after %s during preparation', async action => {
  const samples = new Float32Array(262145);
  if (action === 'invalid-tail') samples[262144] = NaN;
  let next: (() => void) | undefined;
  const copy = vi.fn(); const start = vi.fn();
  const doc = Object.assign(new EventTarget(), { hidden: false });
  const events = new EventTarget();
  const context = { currentTime: 0, state: 'running', destination: {}, resume: async () => {}, close: async () => {},
    addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events),
    createBuffer: () => ({ copyToChannel: copy }), createBufferSource: start };
  const transport = createSongPlayback({ sampleRate: 48000, channels: [samples] }, {
    context: () => context as unknown as AudioContext, document: doc,
    yieldToBrowser: () => new Promise(resolve => { next = resolve; }),
  });
  const playing = transport.play();
  await vi.waitFor(() => expect(next).toBeDefined());
  if (action === 'dispose') transport.dispose();
  if (action === 'pause') transport.pause();
  if (action === 'hidden') { doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange')); }
  if (action === 'interruption') {
    context.state = 'suspended'; events.dispatchEvent(new Event('statechange')); context.state = 'running';
  }
  next!(); await playing;
  expect(copy).toHaveBeenCalledTimes(action === 'pause' || action === 'hidden' || action === 'interruption' ? 2 : 1);
  expect(start).not.toHaveBeenCalled();
  if (action === 'invalid-tail') expect(transport.snapshot().error).toContain('finite');
  transport.dispose();
});
