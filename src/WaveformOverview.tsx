import { useMemo } from 'react';
import type { WaveformSummary } from './waveform-overview';

export function WaveformOverview({ summary, seconds, seek }: {
  summary: WaveformSummary; seconds: number; seek: (seconds: number) => void;
}) {
  const duration = summary.frameCount / summary.sampleRate;
  const geometry = useMemo(() => summary.channels.map(channel => {
    let scale = 0;
    for (let b = 0; b < summary.bucketCount; b++) scale = Math.max(scale, Math.abs(channel.min[b]!), Math.abs(channel.max[b]!));
    if (scale === 0) scale = 1;
    let path = '';
    for (let b = 0; b < summary.bucketCount; b++) {
      const x = (b + 0.5) * 1000 / summary.bucketCount;
      path += `M${x},${50 - channel.max[b]! / scale * 45}V${50 - channel.min[b]! / scale * 45}`;
    }
    return { path, scale };
  }), [summary]);
  return <div className="waveform-overview">
    {geometry.map(({ path, scale }, index) => <div key={index}>
      <p>{geometry.length === 1 ? 'Mono' : index === 0 ? 'Left' : 'Right'} · Linear amplitude ±{scale.toPrecision(4)}</p>
      <svg viewBox="0 0 1000 100" preserveAspectRatio="none" role="img"
        aria-label={`${geometry.length === 1 ? 'Mono' : index === 0 ? 'Left' : 'Right'} waveform. Use recording position controls to seek.`}
        onClick={event => {
          const rect = event.currentTarget.getBoundingClientRect();
          seek(Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * duration);
        }}>
        <line x1="0" x2="1000" y1="50" y2="50" stroke="#64748b" />
        <path d={path} stroke="#173b79" strokeWidth="1" />
        <line x1={seconds / duration * 1000} x2={seconds / duration * 1000} y1="0" y2="100" stroke="#b42318" strokeWidth="4" />
      </svg>
    </div>)}
    <p>0 s — {duration.toFixed(6)} s · Vertical line: playhead at {seconds.toFixed(3)} s. Click waveform to seek.</p>
  </div>;
}
