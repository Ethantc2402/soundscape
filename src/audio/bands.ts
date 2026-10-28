import { validateSampleRate } from './pcm';

export const SOUNDSCAPE_BANDS = Object.freeze([
  { name: 'Sub-bass', lowerHz: 20, upperHz: 60 },
  { name: 'Bass', lowerHz: 60, upperHz: 250 },
  { name: 'Low mids', lowerHz: 250, upperHz: 500 },
  { name: 'Mids', lowerHz: 500, upperHz: 2000 },
  { name: 'High mids', lowerHz: 2000, upperHz: 6000 },
  { name: 'Treble', lowerHz: 6000, upperHz: 12000 },
  { name: 'Air', lowerHz: 12000, upperHz: 20000 },
] as const);
for (const band of SOUNDSCAPE_BANDS) Object.freeze(band);

export interface BandPower {
  readonly name: typeof SOUNDSCAPE_BANDS[number]['name'];
  /** Nominal limits clipped to Nyquist; binCount identifies empty bands. */
  readonly lowerHz: number;
  readonly upperHz: number;
  readonly binCount: number;
  readonly power: number;
}

/** Sum bin powers by center: [lower, upper), except Air includes 20 kHz. */
export function aggregateBandPower(
  power: Float64Array, sampleRate: number, fftSize: number,
): BandPower[] {
  validateSampleRate(sampleRate);
  if (!(power instanceof Float64Array)) throw new TypeError('Bin power must be a Float64Array.');
  if (typeof fftSize !== 'number') throw new TypeError('FFT size must be a number.');
  if (!Number.isSafeInteger(fftSize) || fftSize < 2 || fftSize % 2 !== 0 || power.length !== fftSize / 2 + 1) {
    throw new RangeError('Bin power length must match an even FFT size.');
  }
  const spacing = sampleRate / fftSize;
  if (spacing === 0) throw new RangeError('Frequency spacing must be representable.');
  const sums = SOUNDSCAPE_BANDS.map(() => 0);
  const counts = SOUNDSCAPE_BANDS.map(() => 0);
  let index = 0;
  for (let k = 0; k < power.length; k++) {
    const value = power[k]!;
    if (!Number.isFinite(value) || value < 0) throw new RangeError('Bin power must be finite and nonnegative.');
    const frequency = k * spacing;
    // Frequencies ascend, so advance through the fixed bands only once.
    while (index < SOUNDSCAPE_BANDS.length - 1 && frequency >= SOUNDSCAPE_BANDS[index]!.upperHz) index++;
    const band = SOUNDSCAPE_BANDS[index]!;
    if (frequency >= band.lowerHz && (frequency < band.upperHz ||
      (index === SOUNDSCAPE_BANDS.length - 1 && frequency === band.upperHz))) {
      sums[index] = sums[index]! + value;
      if (!Number.isFinite(sums[index])) throw new RangeError('Aggregated band power overflowed.');
      counts[index] = counts[index]! + 1;
    }
  }
  return SOUNDSCAPE_BANDS.map((band, index) => ({
    name: band.name,
    lowerHz: Math.min(band.lowerHz, sampleRate / 2),
    upperHz: Math.min(band.upperHz, sampleRate / 2),
    binCount: counts[index]!,
    power: sums[index]!,
  }));
}
