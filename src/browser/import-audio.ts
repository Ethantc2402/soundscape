import { validatePcm } from '../audio/pcm';
import type { PcmAudio } from '../audio/pcm';

export const MAX_FILE_BYTES = 64 * 1024 * 1024;
export const MAX_DURATION_SECONDS = 300;
export type AudioFile = Pick<File, 'name' | 'size' | 'arrayBuffer'>;
export interface DecodedAudio {
  readonly sampleRate: number;
  readonly length: number;
  readonly numberOfChannels: number;
  getChannelData(index: number): Float32Array;
}
export interface ImportedAudio { readonly fileName: string; readonly pcm: PcmAudio }

export function copyDecodedAudio(decoded: DecodedAudio): PcmAudio {
  if (!Number.isFinite(decoded.sampleRate) || decoded.sampleRate <= 0 ||
      !Number.isSafeInteger(decoded.length) || decoded.length <= 0) {
    throw new RangeError('The decoded recording has invalid timing or length.');
  }
  if (decoded.numberOfChannels !== 1 && decoded.numberOfChannels !== 2) {
    throw new RangeError('Choose a mono or stereo WAV; other channel layouts are unsupported.');
  }
  if (decoded.length / decoded.sampleRate > MAX_DURATION_SECONDS) {
    throw new RangeError('Choose a recording of at most five minutes.');
  }
  const copyChannel = (index: number) => {
    const samples = decoded.getChannelData(index);
    if (!(samples instanceof Float32Array)) throw new TypeError('Invalid decoded channel storage.');
    if (samples.length !== decoded.length) throw new RangeError('Invalid decoded channel length.');
    return new Float32Array(samples);
  };
  const left = copyChannel(0);
  const pcm: PcmAudio = {
    sampleRate: decoded.sampleRate,
    channels: decoded.numberOfChannels === 1 ? [left] : [left, copyChannel(1)],
  };
  validatePcm(pcm);
  return pcm;
}

async function decodeWav(bytes: ArrayBuffer): Promise<DecodedAudio> {
  if (typeof OfflineAudioContext === 'undefined') {
    throw new Error('This browser does not support local audio decoding. Try a current desktop browser.');
  }
  const context = new OfflineAudioContext(1, 1, 48000);
  try { return await context.decodeAudioData(bytes); }
  catch { throw new Error('Could not decode this WAV. Try an uncompressed PCM16 or PCM24 WAV.'); }
}

export async function importAudio(
  file: AudioFile,
  options: {
    decode?: (bytes: ArrayBuffer) => Promise<DecodedAudio>;
    isCurrent?: () => boolean;
    onPhase?: (phase: string) => void;
    yieldToBrowser?: () => Promise<void>;
  } = {},
): Promise<ImportedAudio | undefined> {
  if (!Number.isSafeInteger(file.size) || file.size <= 0) throw new RangeError('Choose a nonempty WAV file.');
  if (file.size > MAX_FILE_BYTES) throw new RangeError('Choose a WAV no larger than 64 MiB.');
  const isCurrent = options.isCurrent ?? (() => true);
  options.onPhase?.('Reading WAV…');
  const bytes = await file.arrayBuffer();
  if (!isCurrent()) return;
  // Sniff only the container signature; decoding remains the browser's job.
  const header = new Uint8Array(bytes, 0, Math.min(12, bytes.byteLength));
  if (String.fromCharCode(...header.slice(0, 4)) !== 'RIFF' ||
      String.fromCharCode(...header.slice(8, 12)) !== 'WAVE') {
    throw new Error('Choose a RIFF WAV file. This file is not a supported WAV container.');
  }
  options.onPhase?.('Decoding WAV…');
  const decoded = await (options.decode ?? decodeWav)(bytes);
  if (!isCurrent()) return;
  options.onPhase?.('Preparing audio…');
  await options.yieldToBrowser?.();
  if (!isCurrent()) return;
  return { fileName: file.name, pcm: copyDecodedAudio(decoded) };
}
