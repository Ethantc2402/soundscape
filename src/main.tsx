import { createRoot } from 'react-dom/client';
import { sineWave } from './audio/fixtures';
import { measureAudio } from './audio/measurements';

const result = measureAudio({
  sampleRate: 48000,
  channels: [sineWave({ sampleRate: 48000, frameCount: 48000, frequencyHz: 1000 })],
});

function App() {
  return (
    <main>
      <h1>Soundscape 3D</h1>
      <p>Mono sine fixture: 1 kHz, 48 kHz sample rate, one second.</p>
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing React root element.');
createRoot(root).render(<App />);
