/** Original test fixture writer: RIFF/WAVE PCM, little endian, interleaved channels.
 * Container reference: https://www.mmsp.ece.mcgill.ca/Documents/AudioFormats/WAVE/WAVE.html
 */
export function wavFixture(options: {
  bits?: 16 | 24; channels?: number; sampleRate?: number; frames?: number;
  sample?: (frame: number, channel: number) => number;
} = {}): ArrayBuffer {
  const { bits = 16, channels = 2, sampleRate = 48000, frames = 16384,
    sample = (frame, channel) => [0, channel === 0 ? 0.5 : 0.25, 0, channel === 0 ? -0.5 : -0.25][frame % 4]!,
  } = options;
  const bytesPerSample = bits / 8;
  const dataSize = frames * channels * bytesPerSample;
  const bytes = new ArrayBuffer(44 + dataSize);
  const view = new DataView(bytes);
  function tag(offset: number, text: string) {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  }
  tag(0, 'RIFF'); view.setUint32(4, 36 + dataSize, true); tag(8, 'WAVE');
  tag(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, channels, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true); view.setUint16(34, bits, true);
  tag(36, 'data'); view.setUint32(40, dataSize, true);
  let offset = 44;
  for (let frame = 0; frame < frames; frame++) {
    for (let channel = 0; channel < channels; channel++) {
      const value = Math.round(sample(frame, channel) * 2 ** (bits - 1));
      if (bits === 16) view.setInt16(offset, value, true);
      else {
        view.setUint8(offset, value & 255);
        view.setUint8(offset + 1, (value >> 8) & 255);
        view.setUint8(offset + 2, (value >> 16) & 255);
      }
      offset += bytesPerSample;
    }
  }
  return bytes;
}
