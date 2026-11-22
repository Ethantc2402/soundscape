import { expect, it } from 'vitest';
import { prepareSongSession } from './song-session';
import type { SongSession } from './song-session';
import { createImportSession } from './import-session';
import type { ImportState } from './import-session';

function harness() {
  const jobs: { input: string; resolve: (value: string) => void; reject: (error: Error) => void;
    isCurrent: () => boolean; phase: (text: string) => void }[] = [];
  const states: ImportState<string>[] = [];
  let active = 0;
  let peakActive = 0;
  const controller = createImportSession<string, string>(async (input, isCurrent, phase) => {
    peakActive = Math.max(peakActive, ++active);
    try { return await new Promise<string>((resolve, reject) => jobs.push({ input, resolve, reject, isCurrent, phase })); }
    finally { active--; }
  }, state => states.push(state));
  return { jobs, states, controller, peakActive: () => peakActive };
}
const flush = async () => {
  // Drain the deferred run() and controller continuations without wall-clock timers.
  for (let i = 0; i < 4; i++) await Promise.resolve();
};

it('serializes A→B replacement and publishes only the latest result', async () => {
  const h = harness();
  h.controller.select('A');
  h.controller.select('B');
  expect(h.jobs.map(job => job.input)).toEqual(['A']);
  expect(h.jobs[0]!.isCurrent()).toBe(false);
  h.jobs[0]!.phase('stale phase');
  expect(h.states.at(-1)).toEqual({ status: 'loading', phase: 'Waiting for previous import…' });
  h.jobs[0]!.resolve('stale A');
  await flush();
  expect(h.jobs.map(job => job.input)).toEqual(['A', 'B']);
  h.jobs[1]!.resolve('B result');
  await flush();
  expect(h.states.filter(state => state.status === 'ready')).toEqual([{ status: 'ready', value: 'B result' }]);
  expect(h.peakActive()).toBe(1);
});

it('keeps only the latest pending selection and ignores stale failure', async () => {
  const h = harness();
  h.controller.select('A'); h.controller.select('B'); h.controller.select('C');
  h.jobs[0]!.reject(new Error('stale error'));
  await flush();
  expect(h.jobs.map(job => job.input)).toEqual(['A', 'C']);
  h.jobs[1]!.resolve('C result');
  await flush();
  expect(h.states.some(state => state.status === 'error')).toBe(false);
  expect(h.states.at(-1)).toEqual({ status: 'ready', value: 'C result' });
});

it.each(['success', 'failure'])('cancel invalidates active and pending jobs after %s', async outcome => {
  const h = harness();
  h.controller.select('A'); h.controller.select('B'); h.controller.cancel();
  expect(h.states.at(-1)).toEqual({ status: 'empty' });
  if (outcome === 'success') h.jobs[0]!.resolve('A');
  else h.jobs[0]!.reject(new Error('A'));
  await flush();
  expect(h.jobs).toHaveLength(1);
  expect(h.states.at(-1)).toEqual({ status: 'empty' });
  h.controller.select('A');
  expect(h.jobs).toHaveLength(2);
  h.jobs[1]!.resolve('same file again');
  await flush();
  expect(h.states.at(-1)).toEqual({ status: 'ready', value: 'same file again' });
});

it('new selection after cancel waits for native decode to settle', async () => {
  const h = harness();
  h.controller.select('A'); h.controller.cancel(); h.controller.select('B');
  expect(h.jobs).toHaveLength(1);
  h.jobs[0]!.resolve('A');
  await flush();
  expect(h.jobs.map(job => job.input)).toEqual(['A', 'B']);
  expect(h.peakActive()).toBe(1);
});

it.each(['success', 'failure'])('dispose suppresses %s and drops the pending selection', async outcome => {
  const h = harness();
  h.controller.select('A'); h.controller.select('B'); h.controller.dispose();
  const count = h.states.length;
  expect(h.jobs[0]!.isCurrent()).toBe(false);
  h.jobs[0]!.phase('late');
  if (outcome === 'success') h.jobs[0]!.resolve('A'); else h.jobs[0]!.reject(new Error('A'));
  await flush();
  h.controller.select('C'); h.controller.cancel();
  expect(h.jobs).toHaveLength(1);
  expect(h.states).toHaveLength(count);
});

it('reports current failure and can recover', async () => {
  const h = harness();
  h.controller.select('A'); h.jobs[0]!.reject(new Error('Invalid WAV'));
  await flush();
  expect(h.states.at(-1)).toEqual({ status: 'error', message: 'Invalid WAV' });
  h.controller.select('B'); h.jobs[1]!.resolve('B');
  await flush();
  expect(h.states.at(-1)).toEqual({ status: 'ready', value: 'B' });
});

it('disposes published values immediately on replacement/cancel/unmount and obsolete constructed values', async () => {
  const disposed: string[] = [];
  const jobs: ((value: string) => void)[] = [];
  const controller = createImportSession<string, string>(
    () => new Promise(resolve => jobs.push(resolve)), () => {}, value => disposed.push(value));
  controller.select('A'); jobs[0]!('A'); await flush();
  controller.select('B'); expect(disposed).toEqual(['A']);
  controller.select('C'); jobs[1]!('obsolete B'); await flush();
  expect(disposed).toEqual(['A', 'obsolete B']);
  jobs[2]!('C'); await flush(); controller.cancel();
  expect(disposed).toEqual(['A', 'obsolete B', 'C']);
  controller.select('D'); controller.dispose(); jobs[3]!('obsolete D'); await flush();
  expect(disposed).toEqual(['A', 'obsolete B', 'C', 'obsolete D']);
});


it.each(['replace', 'cancel', 'dispose'])('serializes real cooperative preparation across %s', async action => {
  const states: ImportState<SongSession>[] = [];
  const started: string[] = [];
  let unblock!: () => void;
  let active = 0;
  let maxActive = 0;
  const controller = createImportSession<string, SongSession>(async (name, isCurrent) => {
    started.push(name);
    maxActive = Math.max(maxActive, ++active);
    try {
      return await prepareSongSession(name, { sampleRate: 48000, channels: [new Float32Array(262145)] },
        isCurrent, name === 'A' ? () => new Promise(resolve => { unblock = resolve; }) : async () => {});
    } finally { active--; }
  }, state => states.push(state), song => song.dispose());
  controller.select('A');
  controller.select('B');
  if (action === 'replace') controller.select('C');
  if (action === 'cancel') { controller.cancel(); controller.select('C'); }
  if (action === 'dispose') controller.dispose();
  expect(started).toEqual(['A']);
  unblock();
  for (let i = 0; i < 20; i++) await flush();
  expect(maxActive).toBe(1);
  expect(started).toEqual(action === 'dispose' ? ['A'] : ['A', 'C']);
  expect(states.filter(state => state.status === 'ready').map(state => state.value.fileName))
    .toEqual(action === 'dispose' ? [] : ['C']);
  controller.dispose();
});
