import type { PcmAudio } from './audio/pcm';
import { createSongInspection, prepareSongInspection } from './song-inspection';
import { createWaveformOverview } from './waveform-overview';
import { createSongPlayback } from './browser/song-playback';
import type { SongPlayback } from './browser/song-playback';

/** One owner for stable PCM, analysis, compact overview and lazy playback resources. */
export function createSongSession(fileName: string, pcm: PcmAudio) {
  return ownSongSession(fileName, pcm, createSongInspection(pcm), createWaveformOverview(pcm));
}

/** Serialize this work with decoding; obsolete preparation never publishes a session. */
export async function prepareSongSession(fileName: string, pcm: PcmAudio,
  isCurrent: () => boolean, yieldToBrowser: () => Promise<void>) {
  const steps = prepareSongInspection(pcm);
  // Soft arithmetic budget: validation/analyzer setup are still indivisible steps.
  let taskDeadline = performance.now() + 4;
  try {
    while (isCurrent()) {
      const step = steps.next();
      if (step.done || performance.now() >= taskDeadline) {
        await yieldToBrowser();
        if (!isCurrent()) return;
        taskDeadline = performance.now() + 4;
      }
      if (step.done) {
        const waveform = createWaveformOverview(pcm);
        return ownSongSession(fileName, pcm, step.value, waveform);
      }
    }
  } finally {
    // Close abandoned generators so their borrowed PCM/workspaces can be released.
    steps.return(undefined as never);
  }
}

function ownSongSession(fileName: string, pcm: PcmAudio,
  inspection: ReturnType<typeof createSongInspection>, waveform: ReturnType<typeof createWaveformOverview>) {
  let data: { inspection: ReturnType<typeof createSongInspection>; waveform: ReturnType<typeof createWaveformOverview>;
    pcm: PcmAudio } | undefined = {
    inspection, waveform, pcm,
  };
  let playback: SongPlayback | undefined;
  function requireData() {
    if (!data) throw new Error('Recording session is disposed.');
    return data;
  }
  return {
    fileName,
    get inspection() { return requireData().inspection; },
    get waveform() { return requireData().waveform; },
    // Adapter construction installs listeners, so call from an effect, never render.
    playback() { return playback ??= createSongPlayback(requireData().pcm); },
    dispose() { playback?.dispose(); playback = undefined; data = undefined; },
  };
}
export type SongSession = ReturnType<typeof createSongSession>;
