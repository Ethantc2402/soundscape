# Soundscape 3D — Task 001

Minimal Vite + React + strict TypeScript application with pure PCM measurements.
The React page displays measurements computed from a synthetic sine wave. No FFT,
graphics, AI, network services, uploads, or audio playback are implemented.

## Development

Requires Node.js >=22.12.0 and npm. From the repository root:

```sh
npm ci
npm test
npm run typecheck
npm run build
npm run dev -- --host 0.0.0.0
```

`npm test` executes Vitest once; `npm run test:watch` watches during development.
`npm run typecheck` runs `tsc --noEmit`. `npm run build` typechecks and creates
the production bundle in `dist/`. `npm run preview` serves that bundle locally.
In this cloud workspace, use `npm ci --cache /tmp/soundscape-npm-cache` because
the default home-directory npm cache is not writable.

## Module boundaries and data flow

- `src/audio/pcm.ts`: typed planar PCM and runtime validation.
- `src/audio/fixtures.ts`: deterministic sine samples, without browser APIs.
- `src/audio/measurements.ts`: pure measurements without React or browser APIs.
- `src/audio/audio.test.ts`: numerical fixtures and invalid-input tests.
- `src/main.tsx`: constructs a mono fixture, measures it, and renders the result.

`PcmAudio` carries a finite positive sample rate in samples/second (Hz) and a
tuple containing one mono `Float32Array` or two arrays in left/right order.
Channels must contain equal, nonzero frame counts and only finite samples.
Samples use normalized linear amplitude, where 1 denotes nominal full scale;
finite values outside [-1, 1] are allowed and never clipped. Arrays are not mutated.
Tuple types enforce channel count statically; runtime validation also protects
JavaScript callers. Invalid rates, counts, lengths, and samples throw `RangeError`;
non-Float32 channel storage throws `TypeError`.

`sineWave` creates a fresh array with
`x[n] = A sin(2π f n / fs + φ)`, for integer `n` from 0 to `frameCount - 1`.
Frequency `f` is in Hz, phase `φ` in radians, and amplitude `A` is finite and
nonnegative. Frame count is a positive safe integer. Frequency must satisfy
`0 <= f < fs/2`; generated samples must fit finite Float32 storage.
Defaults are `A = 1` and `φ = 0`. Identical options produce identical samples
within the same JavaScript runtime; cross-engine bitwise identity is not promised.

## Mathematical definitions and units

For each channel with N samples x[n]:

| Measurement | Definition | Units |
| --- | --- | --- |
| Sample peak | max over n of abs(x[n]) | Linear amplitude |
| Mean-square energy | (1/N) Σ x[n]² | Squared linear amplitude |
| RMS | sqrt((1/N) Σ x[n]²) | Linear amplitude |

The exported `samplePeak`, `rms`, and `perChannelMeanSquareEnergy` functions
return one number per channel in input order. `measureAudio` returns the sample
rate, frame count, and per-channel objects containing all three measurements.
It does not mix channels or sum stereo energy. “Energy” here means mean square,
not a time integral, joules, acoustic power, or calibrated loudness. No dB conversion,
windowing, weighting, DC removal, or sample-rate conversion occurs. Sample rate
provides timing metadata; it does not change these amplitude calculations.

Samples are quantized to Float32; sums use JavaScript Number arithmetic.
Tests explicitly allow absolute error <=1e-6 for peak/RMS and <=1e-7 for mean
square. Silence is checked exactly. Known sine tests use one second at 48 kHz
and 1 kHz: integer cycles and sampled extrema make the expected peak A,
RMS A/√2, and mean square A²/2 valid within those tolerances. These identities
need not hold for an arbitrary short, non-integer-cycle buffer.

The data flow is sine options → Float32 samples → mono/stereo PCM → validation
→ independent per-channel measurements → React display. Tests exercise mono
sines, silence, left-only/right-only stereo, phase, determinism, input preservation,
and invalid PCM/fixture options.

Next milestone limitation: measurements currently require the entire buffer in
memory. Introduce streaming accumulation across chunks with explicit reset and
channel continuity rules before supporting long-running audio analysis.
