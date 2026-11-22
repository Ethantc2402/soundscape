import { useEffect, useState } from 'react';
import { importAudio } from './browser/import-audio';
import type { AudioFile } from './browser/import-audio';
import { createImportSession } from './import-session';
import type { ImportState } from './import-session';
import { prepareSongSession } from './song-session';
import type { SongSession } from './song-session';
import { SongTransport } from './SongTransport';

type LoadedSong = SongSession;
// Phase paint opportunity; arithmetic chunks use shorter tasks below.
const yieldToBrowser = () => new Promise<void>(resolve => setTimeout(resolve, 20));
const channelName = (index: number, count: number) => count === 1 ? 'Mono' : index === 0 ? 'Left' : 'Right';

function SongResults({ song }: { song: LoadedSong }) {
  const { inspection } = song;
  const channels = inspection.measurements.channels;
  return <div className="song-results">
    <h3>{song.fileName}</h3>
    <p>Duration: {inspection.durationSeconds.toFixed(6)} s · Decoded sample rate: {inspection.measurements.sampleRate} Hz · {channels.length === 1 ? 'Mono' : 'Stereo (Left / Right)'}</p>
    <div className="song-table-scroll" role="region" aria-label="Whole-record measurement table" tabIndex={0}>
      <table className="song-table">
        <caption>Whole-record measurements</caption>
        <thead><tr><th scope="col">Channel</th><th scope="col">Sample peak (linear amplitude)</th><th scope="col">RMS (linear amplitude)</th><th scope="col">Mean-square power (squared linear amplitude)</th></tr></thead>
        <tbody>{channels.map((channel, index) => <tr key={index}>
          <th scope="row">{channelName(index, channels.length)}</th>
          <td>{channel.samplePeak.toPrecision(7)}</td><td>{channel.rms.toPrecision(7)}</td><td>{channel.meanSquareEnergy.toPrecision(7)}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <SongTransport song={song} />
  </div>;
}

export function ImportedSong() {
  const [state, setState] = useState<ImportState<LoadedSong>>({ status: 'empty' });
  const [session, setSession] = useState<ReturnType<typeof createImportSession<AudioFile, LoadedSong>>>();
  useEffect(() => {
    const controller = createImportSession<AudioFile, LoadedSong>(async (file, isCurrent, onPhase) => {
      const imported = await importAudio(file, { isCurrent, onPhase, yieldToBrowser });
      if (!imported || !isCurrent()) return;
      onPhase('Measuring recording…');
      await yieldToBrowser();
      if (!isCurrent()) return;
      return prepareSongSession(imported.fileName, imported.pcm, isCurrent,
        () => new Promise(resolve => setTimeout(resolve, 0)));
    }, setState, song => song.dispose());
    setSession(controller);
    return () => controller.dispose();
  }, []);
  return <section aria-labelledby="import-title">
    <h2 id="import-title">Inspect a local song</h2>
    <p>Choose a mono or stereo PCM WAV, up to 64 MiB and five minutes. Audio stays on this device. Import may resample to 48,000 Hz.</p>
    <label htmlFor="song-file">WAV file</label>{' '}
    <input id="song-file" type="file" accept=".wav,audio/wav,audio/x-wav" disabled={!session} onChange={event => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = '';
      if (file) session?.select(file);
    }} />
    {state.status === 'loading' && <button type="button" onClick={() => session?.cancel()}>Cancel import</button>}
    <p role="status">{state.status === 'loading' ? state.phase : state.status === 'ready' ? 'Recording ready.' : state.status === 'empty' ? 'Choose a WAV to begin.' : ''}</p>
    {state.status === 'error' && <p role="alert">{state.message}</p>}
    {state.status === 'ready' && <SongResults key={state.value.fileName} song={state.value} />}
  </section>;
}
