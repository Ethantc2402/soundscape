import { useEffect, useRef, useState } from 'react';
import type { SongSession } from './song-session';
import type { SongPlayback } from './browser/song-playback';
import type { PlaybackSnapshot } from './playback-clock';
import { WaveformOverview } from './WaveformOverview';

export function SongTransport({ song }: { song: SongSession }) {
  const { inspection, waveform } = song;
  const playback = useRef<SongPlayback | undefined>(undefined);
  const [snapshot, setSnapshot] = useState<PlaybackSnapshot & { pending: boolean; error: string }>({
    seconds: 0, sample: 0, playing: false, loop: false, timing: 'uncompensated', pending: false, error: '',
  });
  const [analysis, setAnalysis] = useState(() => ({ window: inspection.inspect(0), at: performance.now() }));
  const [timeText, setTimeText] = useState('0');
  const [timeError, setTimeError] = useState('');
  const [loop, setLoop] = useState(false);
  const [starting, setStarting] = useState(false);
  const playCommand = useRef(0);
  const refresh = useRef<() => void>(() => {});
  useEffect(() => {
    const transport = song.playback();
    playback.current = transport;
    let frame = 0;
    let disposed = false;
    let lastAnalysisAt = -Infinity;
    let lastOffset = -1;
    function update(immediate = false) {
      if (disposed) return;
      const next = transport.snapshot();
      const now = performance.now();
      setSnapshot(next);
      setStarting(next.pending);
      const offset = Math.min(next.sample, Math.max(0, waveform.frameCount - 8192));
      if (offset !== lastOffset && (immediate || now - lastAnalysisAt >= 1000 / 15)) {
        setAnalysis({ window: inspection.inspectSample(next.sample), at: now });
        lastAnalysisAt = now; lastOffset = offset;
      }
    }
    refresh.current = () => update(true);
    function tick() { update(); frame = requestAnimationFrame(tick); }
    function visibility() {
      cancelAnimationFrame(frame);
      if (!document.hidden) { update(true); frame = requestAnimationFrame(tick); }
    }
    document.addEventListener('visibilitychange', visibility);
    visibility();
    return () => {
      disposed = true; playCommand.current++; cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', visibility);
      transport.pause(); playback.current = undefined;
    };
  }, [song, inspection, waveform]);
  function selectTime(text: string) {
    setTimeText(text);
    const seconds = text.trim() === '' ? NaN : Number(text);
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > inspection.durationSeconds) {
      setTimeError(`Enter a time from 0 to ${inspection.durationSeconds} seconds.`);
      return;
    }
    setTimeError(''); playback.current?.seek(seconds); refresh.current();
  }
  const window = analysis.window;
  const channels = inspection.measurements.channels;
  return <>
    <div className="transport-buttons">
      <button type="button" onClick={() => {
        const identity = ++playCommand.current;
        if (starting || snapshot.playing) { playback.current?.pause(); setStarting(false); refresh.current(); }
        else {
          setStarting(true);
          void playback.current?.play().finally(() => {
            if (identity === playCommand.current) { setStarting(false); refresh.current(); }
          });
        }
      }}>{starting || snapshot.playing ? 'Pause' : 'Play'}</button>
      <label><input type="checkbox" checked={loop} onChange={event => {
        setLoop(event.currentTarget.checked); playback.current?.setLoop(event.currentTarget.checked); refresh.current();
      }} /> Loop whole recording</label>
    </div>
    <p role="status">{snapshot.error || (starting ? 'Starting playback…' : snapshot.playing ? 'Playing.' : 'Paused. Press Play to begin or resume.')}</p>
    <p>Playhead: {snapshot.seconds.toFixed(6)} s · Sample {snapshot.sample} · Timing: {snapshot.timing} (physical synchronization unverified).</p>
    <WaveformOverview summary={waveform} seconds={snapshot.seconds} seek={seconds => selectTime(String(seconds))} />
    <div className="song-controls">
      <label htmlFor="song-time">Seek position (seconds)</label>
      <input id="song-time" type="number" min={0} max={inspection.durationSeconds} step="any"
        value={timeText} onChange={event => selectTime(event.currentTarget.value)} aria-describedby="song-time-help" aria-invalid={!!timeError} />
      <label htmlFor="song-position">Recording position</label>
      <input id="song-position" type="range" min={0} max={inspection.durationSeconds} step="any"
        value={snapshot.seconds} onChange={event => selectTime(event.currentTarget.value)} />
    </div>
    <p id="song-time-help">Seek snaps down to a decoded sample. Numeric text is the requested seek; the playhead follows estimated output. Whole-record measurements remain static.</p>
    {timeError && <p role="alert">{timeError}</p>}
    {window ? <>
      <p>Selected samples start at {window.frameOffset}; window [{window.startTimeSeconds.toFixed(9)}, {window.endTimeSeconds.toFixed(9)}) s (end exclusive). Center: {((window.startTimeSeconds + window.endTimeSeconds) / 2).toFixed(9)} s.</p>
      <p>Analysis refresh: at most 15 Hz during playback; age {Math.max(0, performance.now() - analysis.at).toFixed(0)} ms. Full windows clamp at the tail and never wrap across a loop seam.</p>
      <div className="song-table-scroll" role="region" aria-label="Selected-window band power table" tabIndex={0}>
        <table className="song-table">
          <caption>Selected-window band power (squared linear amplitude)</caption>
          <thead><tr><th scope="col">Band</th>{channels.map((_, index) => <th scope="col" key={index}>{channels.length === 1 ? 'Mono' : index === 0 ? 'Left' : 'Right'}</th>)}</tr></thead>
          <tbody>{window.channels[0]!.map((band, bandIndex) => <tr key={band.name}>
            <th scope="row">{band.name}</th>{window.channels.map((bands, index) => <td key={index}>{bands[bandIndex]!.power.toPrecision(7)}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
      <p>These values describe one window, not whole-song averages or mix-quality judgments.</p>
    </> : <p>Too short for this analysis window (8,192 samples). Whole-record measurements are available above.</p>}
  </>;
}
