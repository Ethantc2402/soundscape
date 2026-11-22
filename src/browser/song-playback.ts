import { validatePcm } from '../audio/pcm';
import type { PcmAudio } from '../audio/pcm';
import { createPlaybackClock, outputTime } from '../playback-clock';

/** Web Audio copy boundary; the returned native storage never aliases analysis PCM. */
export function copyPlaybackBuffer(context: BaseAudioContext, pcm: PcmAudio): AudioBuffer {
  validatePcm(pcm);
  const copy = context.createBuffer(pcm.channels.length, pcm.channels[0].length, pcm.sampleRate);
  pcm.channels.forEach((samples, index) => copy.copyToChannel(samples as Float32Array<ArrayBuffer>, index));
  return copy;
}

/** Private, unpublished native storage; session PCM must stay stable across yields. */
async function preparePlaybackBuffer(context: BaseAudioContext, pcm: PcmAudio,
  isCurrent: () => boolean, yieldToBrowser: () => Promise<void>) {
  // Validate channel shape without a full-record synchronous sample scan.
  const channels = pcm.channels.map(samples => {
    if (!(samples instanceof Float32Array)) throw new TypeError('PCM channels must be Float32Array instances.');
    if (samples.length !== pcm.channels[0].length) throw new RangeError('PCM channel lengths must match.');
    return samples.subarray(0, 1);
  });
  validatePcm({ sampleRate: pcm.sampleRate, channels: channels as unknown as PcmAudio['channels'] });
  const copy = context.createBuffer(pcm.channels.length, pcm.channels[0].length, pcm.sampleRate);
  // Bound each validation/copy task; native allocation itself cannot be subdivided.
  const chunkFrames = 262144;
  for (let offset = 0; offset < pcm.channels[0].length; offset += chunkFrames) {
    if (!isCurrent()) return;
    for (let channel = 0; channel < pcm.channels.length; channel++) {
      const samples = pcm.channels[channel]!.subarray(offset, offset + chunkFrames);
      validatePcm({ sampleRate: pcm.sampleRate, channels: [samples] });
      copy.copyToChannel(samples as Float32Array<ArrayBuffer>, channel, offset);
    }
    if (offset + chunkFrames < pcm.channels[0].length) await yieldToBrowser();
  }
  return isCurrent() ? copy : undefined;
}

/** Same source graph for realtime playback and offline scheduling verification. */
export function connectPlaybackSource(context: BaseAudioContext, buffer: AudioBuffer, loop: boolean) {
  const node = context.createBufferSource();
  node.buffer = buffer;
  node.loop = loop;
  node.connect(context.destination);
  return node;
}

/** Stable borrowed PCM is retained until dispose; one native copy is made on first Play. */
export function createSongPlayback(pcm: PcmAudio, options: {
  context?: () => AudioContext;
  now?: () => number;
  yieldToBrowser?: () => Promise<void>;
  document?: Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>;
} = {}) {
  let retained: PcmAudio | undefined = pcm;
  const sampleRate = pcm.sampleRate;
  const frameCount = pcm.channels[0].length;
  const clock = createPlaybackClock(sampleRate, frameCount);
  const doc = options.document ?? (typeof document === 'undefined' ? undefined : document);
  let context: AudioContext | undefined;
  let buffer: AudioBuffer | undefined;
  let preparation: Promise<AudioBuffer | undefined> | undefined;
  let source: AudioBufferSourceNode | undefined;
  let disposed = false;
  let intent = false;
  let loop = false;
  let position = 0;
  let positionSample: number | undefined = 0;
  let command = 0;
  let pending: Promise<void> | undefined;
  let error = '';
  const now = options.now ?? (() => performance.now());
  const current = () => context?.currentTime ?? 0;
  function stop(at = current()) {
    if (!source) return;
    source.onended = null;
    source.stop(at); source.disconnect(); source = undefined;
  }
  function start(at: number, seconds: number) {
    stop(at);
    if (!context || !buffer || seconds === clock.duration) return;
    const node = connectPlaybackSource(context, buffer, loop);
    source = node;
    // ended is resource notification only: output may still be draining.
    node.onended = () => {
      node.disconnect();
      if (source === node) { source = undefined; intent = false; }
    };
    try { node.start(at, seconds); }
    catch (failure) { stop(); throw failure; }
  }
  function pause() {
    if (disposed) return;
    command++; pending = undefined;
    const at = current();
    const stopped = clock.snapshot(at);
    position = stopped.seconds;
    positionSample = stopped.sample / sampleRate === stopped.seconds ? stopped.sample : undefined;
    intent = false;
    stop(at);
    clock.transition(at, position, false, loop, positionSample);
  }
  const hidden = () => { if (doc?.hidden) pause(); };
  const stateChanged = () => {
    if (context?.state !== 'running' && (source || pending)) pause();
  };
  doc?.addEventListener('visibilitychange', hidden);
  function snapshot() {
    let stamp: AudioTimestamp | undefined;
    try { stamp = context?.getOutputTimestamp?.(); } catch { /* Optional estimate unavailable. */ }
    const output = outputTime(current(), now(), context?.state === 'running',
      stamp?.contextTime !== undefined && stamp.performanceTime !== undefined
        ? { contextTime: stamp.contextTime, performanceTime: stamp.performanceTime } : undefined);
    return { ...clock.snapshot(output.time, output.timing), pending: !!pending, error };
  }
  return {
    snapshot,
    play(): Promise<void> {
      if (disposed) return Promise.resolve();
      if (pending) return pending;
      if (source && intent && clock.snapshot(current()).playing) return Promise.resolve();
      error = '';
      const identity = ++command;
      intent = true;
      const before = clock.snapshot(current());
      position = before.seconds;
      positionSample = before.sample / sampleRate === before.seconds ? before.sample : undefined;
      if (position === clock.duration) { position = 0; positionSample = 0; }
      // Retire the prior command's source before resume can yield to its ended event.
      stop();
      // Context creation/resume happen synchronously in the gesture's call stack.
      try {
        if (!context) {
          context = options.context?.() ?? new AudioContext();
          context.addEventListener('statechange', stateChanged);
        }
        const resumed = context.resume();
        const activeContext = context;
        pending = resumed.then(async () => {
          if (disposed || identity !== command || !intent) return;
          if (doc?.hidden || activeContext.state !== 'running') throw new Error('Playback interrupted. Press Play to retry.');
          if (!buffer && retained) {
            // Pause invalidates the command, while a later Play shares this copy.
            // Disposal invalidates preparation and prevents further chunks/publication.
            preparation ??= preparePlaybackBuffer(activeContext, retained, () => !disposed,
              options.yieldToBrowser ?? (() => new Promise(resolve => setTimeout(resolve, 0))));
            try {
              const prepared = await preparation;
              if (!disposed) buffer = prepared;
            }
            finally { preparation = undefined; }
          }
          if (disposed || identity !== command || !intent) return;
          if (doc?.hidden || activeContext.state !== 'running') throw new Error('Playback interrupted. Press Play to retry.');
          const at = current();
          start(at, position);
          clock.transition(at, position, true, loop, positionSample);
        }).catch(failure => {
          if (disposed || identity !== command) return;
          intent = false; stop();
          clock.transition(current(), position, false, loop, positionSample);
          error = failure instanceof Error ? `${failure.message} Press Play to retry.` : 'Playback failed. Press Play to retry.';
        }).finally(() => { if (identity === command) pending = undefined; });
      } catch (failure) {
        intent = false;
        error = failure instanceof Error ? `${failure.message} Press Play to retry.` : 'Playback unavailable. Try a current browser.';
        return Promise.resolve();
      }
      return pending;
    },
    pause,
    seek(seconds: number) {
      const sample = clock.seekSample(seconds);
      if (disposed) return;
      position = sample / sampleRate;
      positionSample = sample;
      const at = current();
      const playing = intent && !pending && clock.snapshot(at).playing && context?.state === 'running' && sample < frameCount;
      if (!pending && !playing) intent = false;
      if (sample === frameCount) { intent = false; command++; pending = undefined; }
      stop();
      let started = !!playing;
      try { if (playing) start(at, position); }
      catch { started = false; intent = false; error = 'Could not seek playback. Press Play to retry.'; }
      clock.transition(at, position, started, loop, sample);
    },
    setLoop(enabled: boolean) {
      if (typeof enabled !== 'boolean') throw new TypeError('Loop must be boolean.');
      if (disposed || loop === enabled) return;
      const at = current();
      const before = clock.snapshot(at);
      const beforeSample = before.sample / sampleRate === before.seconds ? before.sample : undefined;
      loop = enabled;
      // A pending Play may have prepared zero for replay while the clock is at end.
      if (!pending) {
        position = before.seconds;
        positionSample = beforeSample;
      }
      let playing = before.playing;
      try { if (source) start(at, position); }
      catch { playing = false; intent = false; error = 'Could not change playback loop. Press Play to retry.'; }
      clock.transition(at, before.seconds, playing, loop, beforeSample);
    },
    dispose() {
      if (disposed) return;
      pause(); disposed = true; retained = undefined; buffer = undefined;
      doc?.removeEventListener('visibilitychange', hidden);
      context?.removeEventListener('statechange', stateChanged);
      if (context && context.state !== 'closed') void context.close().catch(() => {});
      context = undefined;
    },
  };
}
export type SongPlayback = ReturnType<typeof createSongPlayback>;
