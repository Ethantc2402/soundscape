import { createRoot } from 'react-dom/client';
import { sineWave } from './audio/fixtures';
import { measureAudio } from './audio/measurements';
import { createDemoBandTimeline } from './demo-band-timeline';
import './demo.css';

const result = measureAudio({
  sampleRate: 48000,
  channels: [sineWave({ sampleRate: 48000, frameCount: 48000, frequencyHz: 1000 })],
});
const bandTimeline = createDemoBandTimeline();
const maxDisplayPower = 0.5;

function BandPowerHeatmap() {
  return (
    <section>
      <h2 id="band-power-title">Frequency-band power over time</h2>
      <p>A 150 Hz tone, silence, then a 3,000 Hz tone in one mono recording.</p>
      <p className="power-legend">
        <span>Linear scale</span>
        <span>0</span>
        <span className="power-ramp" aria-hidden="true" />
        <span>{maxDisplayPower}</span>
      </p>
      <div className="heatmap-scroll" role="region" aria-labelledby="band-power-title" tabIndex={0}>
        <table className="heatmap">
          <caption>Band power in squared linear amplitude by time window (seconds)</caption>
          <thead>
            <tr>
              <th scope="col">Band</th>
              {bandTimeline.map(({ startTimeSeconds, endTimeSeconds }) => (
                <th scope="col" key={startTimeSeconds}>
                  {startTimeSeconds.toFixed(1)}–{endTimeSeconds.toFixed(1)} s
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bandTimeline[0]!.bands.map(({ name }, bandIndex) => (
              <tr key={name}>
                <th scope="row">{name}</th>
                {bandTimeline.map(({ startTimeSeconds, bands }) => {
                  const { power } = bands[bandIndex]!;
                  const intensity = Math.min(power / maxDisplayPower, 1);
                  return (
                    <td
                      key={startTimeSeconds}
                      style={{
                        backgroundColor: `color-mix(in srgb, var(--power-high) ${intensity * 100}%, var(--power-low))`,
                        color: intensity >= 0.68 ? '#fff' : '#000',
                      }}
                    >
                      {power.toFixed(3)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function App() {
  return (
    <main>
      <h1>Soundscape 3D</h1>
      <p>Mono sine fixture: 1 kHz, 48 kHz sample rate, one second.</p>
      <pre>{JSON.stringify(result, null, 2)}</pre>
      <BandPowerHeatmap />
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing React root element.');
createRoot(root).render(<App />);
