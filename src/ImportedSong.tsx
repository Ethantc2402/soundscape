import { useEffect, useState } from 'react';
import { importAudio } from './browser/import-audio';
import type { AudioFile } from './browser/import-audio';
import { createImportSession } from './import-session';
import type { ImportState } from './import-session';
import { createSongInspection } from './song-inspection';
import type { SongInspection } from './song-inspection';

interface LoadedSong { fileName: string; inspection: SongInspection }
// A short task boundary lets each phase paint before synchronous scans/copies.
const yieldToBrowser = () => new Promise<void>(resolve => setTimeout(resolve, 20));
const channelName = (index: number, count: number) => count === 1 ? 'Mono' : index === 0 ? 'Left' : 'Right';

function SongResults({ song }: { song: LoadedSong }) {
  const { inspection } = song;
  const [time, setTime] = useState(0);
  const [timeText, setTimeText] = useState('0');
  const [timeError, setTimeError] = useState('');
  const window = inspection.inspect(time);
  const channels = inspection.measurements.channels;
  function selectTime(text: string) {
    setTimeText(text);
    const value = text === '' ? NaN : Number(text);
    if (!Number.isFinite(value) || value < 0 || value > inspection.maxStartSeconds) {
      setTimeError(`Enter a time from 0 to ${inspection.maxStartSeconds} seconds.`);
      return;
    }
    setTimeError('');
    setTime(value);
  }
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
    {window ? <>
      <div className="song-controls">
        <label htmlFor="song-time">Window start (seconds)</label>
        <input id="song-time" type="number" min={0} max={inspection.maxStartSeconds} step="any"
          value={timeText} onChange={event => selectTime(event.currentTarget.value)} aria-describedby="song-time-help" aria-invalid={!!timeError} />
        <label htmlFor="song-position">Inspect recording position</label>
        <input id="song-position" type="range" min={0} max={inspection.maxStartSeconds} step="any"
          value={time} disabled={inspection.maxStartSeconds === 0} onChange={event => selectTime(event.currentTarget.value)} />
      </div>
      <p id="song-time-help">Select a full 8,192-sample window. This is inspection, without playback.</p>
      {timeError && <p role="alert">{timeError}</p>}
      <p>Selected samples start at {window.frameOffset}; window [{window.startTimeSeconds.toFixed(9)}, {window.endTimeSeconds.toFixed(9)}) s (end exclusive).</p>
      <div className="song-table-scroll" role="region" aria-label="Selected-window band power table" tabIndex={0}>
        <table className="song-table">
          <caption>Selected-window band power (squared linear amplitude)</caption>
          <thead><tr><th scope="col">Band</th>{channels.map((_, index) => <th scope="col" key={index}>{channelName(index, channels.length)}</th>)}</tr></thead>
          <tbody>{window.channels[0]!.map((band, bandIndex) => <tr key={band.name}>
            <th scope="row">{band.name}</th>{window.channels.map((bands, index) => <td key={index}>{bands[bandIndex]!.power.toPrecision(7)}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
      <p>These values describe one window, not whole-song averages or mix-quality judgments.</p>
    </> : <p>Too short for this analysis window (8,192 samples). Whole-record measurements are available above.</p>}
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
      return { fileName: imported.fileName, inspection: createSongInspection(imported.pcm) };
    }, setState);
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
    {state.status === 'ready' && <SongResults song={state.value} />}
  </section>;
}
