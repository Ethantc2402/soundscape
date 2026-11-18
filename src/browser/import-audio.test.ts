import { describe, expect, it, vi } from 'vitest';
import { copyDecodedAudio, importAudio, MAX_FILE_BYTES } from './import-audio';
import type { AudioFile, DecodedAudio } from './import-audio';

function decoded(channels: Float32Array[] = [new Float32Array([0, 2, -2])], sampleRate = 48000): DecodedAudio {
  return { sampleRate, length: channels[0]!.length, numberOfChannels: channels.length,
    getChannelData: index => channels[index]! };
}
function file(size = 12): AudioFile {
  return { name: 'test.wav', size, arrayBuffer: vi.fn(async () => {
    const bytes = new Uint8Array(12);
    bytes.set([82, 73, 70, 70], 0);
    bytes.set([87, 65, 86, 69], 8);
    return bytes.buffer;
  }) };
}

describe('decoded PCM boundary', () => {
  it('copies mono and stereo in order, preserving over-range samples without sharing', () => {
    const left = new Float32Array([2, -2, 0]);
    const right = new Float32Array([0, 0.25, -0.25]);
    for (const channels of [[left], [left, right]]) {
      const result = copyDecodedAudio(decoded(channels));
      expect(result.channels).toEqual(channels);
      result.channels.forEach((channel, index) => expect(channel.buffer).not.toBe(channels[index]!.buffer));
      result.channels[0][0] = 9;
      expect(left[0]).toBe(2);
    }
  });
  it.each([0, 3, 6])('rejects %s channels before accessing samples', numberOfChannels => {
    const getChannelData = vi.fn();
    expect(() => copyDecodedAudio({ ...decoded(), numberOfChannels, getChannelData })).toThrow(RangeError);
    expect(getChannelData).not.toHaveBeenCalled();
  });
  it.each([0, -1, NaN, Infinity])('rejects invalid sample rate %s', sampleRate => {
    expect(() => copyDecodedAudio({ ...decoded(), sampleRate })).toThrow(RangeError);
  });
  it.each([0, -1, 1.5, NaN, Infinity])('rejects invalid length %s', length => {
    expect(() => copyDecodedAudio({ ...decoded(), length })).toThrow(RangeError);
  });
  it('checks duration at the exact boundary before accessing oversized data', () => {
    // Tiny sample rate makes the duration-boundary fixture small without mocking storage.
    expect(copyDecodedAudio(decoded([new Float32Array(300)], 1)).channels[0].length).toBe(300);
    const getChannelData = vi.fn();
    expect(() => copyDecodedAudio({ ...decoded(), sampleRate: 1, length: 301, getChannelData })).toThrow(/five minutes/);
    expect(getChannelData).not.toHaveBeenCalled();
  });
  it('rejects nonfinite samples, wrong storage, and mismatched channel lengths', () => {
    expect(() => copyDecodedAudio(decoded([new Float32Array([Infinity])]))).toThrow(RangeError);
    expect(() => copyDecodedAudio({ ...decoded(), getChannelData: () => [] as unknown as Float32Array })).toThrow(TypeError);
    expect(() => copyDecodedAudio({ ...decoded(), length: 4 })).toThrow(RangeError);
    expect(() => copyDecodedAudio(decoded([new Float32Array(3), new Float32Array(2)]))).toThrow(RangeError);
  });
});

describe('WAV import', () => {
  it('accepts the exact byte cap, reports phases, and returns copied PCM', async () => {
    const phases: string[] = [];
    const result = await importAudio(file(MAX_FILE_BYTES), { decode: async () => decoded(), onPhase: phase => phases.push(phase) });
    expect(result!.fileName).toBe('test.wav');
    expect(result!.pcm.channels[0]).toEqual(new Float32Array([0, 2, -2]));
    expect(phases).toEqual(['Reading WAV…', 'Decoding WAV…', 'Preparing audio…']);
  });
  it.each([0, MAX_FILE_BYTES + 1])('rejects file size %s without reading', async size => {
    const input = file(size);
    await expect(importAudio(input)).rejects.toThrow(RangeError);
    expect(input.arrayBuffer).not.toHaveBeenCalled();
  });
  it('propagates read/decode failure and rejects corrupt/non-WAV data', async () => {
    await expect(importAudio({ ...file(), arrayBuffer: async () => { throw new Error('Read failed'); } })).rejects.toThrow('Read failed');
    await expect(importAudio({ ...file(), arrayBuffer: async () => new ArrayBuffer(2) })).rejects.toThrow(/WAV/);
    await expect(importAudio(file(), { decode: async () => { throw new Error('Decode failed'); } })).rejects.toThrow('Decode failed');
  });
  it('does not decode stale reads or copy stale decodes', async () => {
    const decode = vi.fn(async () => decoded());
    expect(await importAudio(file(), { isCurrent: () => false, decode })).toBeUndefined();
    expect(decode).not.toHaveBeenCalled();
    let current = true;
    const getChannelData = vi.fn();
    expect(await importAudio(file(), { isCurrent: () => current, decode: async () => {
      current = false;
      return { ...decoded(), getChannelData };
    } })).toBeUndefined();
    expect(getChannelData).not.toHaveBeenCalled();
  });
  it('checks invalidation again after yielding before copying', async () => {
    let current = true;
    const getChannelData = vi.fn();
    expect(await importAudio(file(), { isCurrent: () => current,
      decode: async () => ({ ...decoded(), getChannelData }),
      yieldToBrowser: async () => { current = false; },
    })).toBeUndefined();
    expect(getChannelData).not.toHaveBeenCalled();
  });
});
