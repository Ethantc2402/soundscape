# Soundscape 3D — Audio measurement foundation

Minimal Vite + React + strict TypeScript application with pure time-domain and
single-frame and time-indexed FFT measurements. The React page remains a
time-domain synthetic sine demonstration; spectral analysis is available as a tested TypeScript API.
No graphics, AI, network services, uploads, or audio playback are implemented.

## Development

Requires Node.js >=22.12.0 and npm. From the repository root:

```sh
npm ci
npm test
npm run typecheck
npm run build
git diff --check
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
- `src/audio/measurements.ts`: pure measurements; the combined API validates once
  and computes peak and mean square together in one measurement pass per channel.
- `src/audio/audio.test.ts`: numerical fixtures and invalid-input tests.
- `src/audio/windowing.ts`: periodic Hann coefficients and gain factors.
- `src/audio/spectrum.ts`: selected-frame one-sided FFT power and reusable validated sessions, independent per channel.
- `src/audio/timeline.ts`: lazy successive-window spectra with sample offsets and recording-relative times.
- `src/audio/bands.ts`: deterministic bin-center power aggregation into seven bands.
- `src/audio/spectral.test.ts`: spectral mathematics, validation, and boundary tests.
- `src/main.tsx`: constructs a mono fixture, measures it, and renders the result.

`PcmAudio` carries a finite positive sample rate in samples/second (Hz) and a
tuple containing one mono `Float32Array` or two arrays in left/right order.
Channels must contain equal, nonzero frame counts and only finite samples.
Samples use normalized linear amplitude, where 1 denotes nominal full scale;
finite values outside [-1, 1] are allowed and never clipped. Arrays are not mutated.
Tuple types enforce channel count statically; runtime validation also protects
JavaScript callers. Validation checks the input object and channels container
before dereferencing them, and each channel's type before accessing its length.
Malformed input objects, missing properties, nonnumeric sample rates, non-array
containers, and non-Float32 channels throw intentional `TypeError`s. Numeric
rates that are nonfinite or nonpositive, unsupported counts, empty/mismatched
lengths, and nonfinite samples throw `RangeError`s. Sparse channels are invalid
storage (`TypeError`). Finite samples outside ±1 remain supported.

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
| Mean-square signal power (API: meanSquareEnergy) | (1/N) Σ x[n]² | Squared linear amplitude |
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
and invalid PCM/fixture options. Malformed PCM cases check intentional error
classes and messages; combined measurements are compared with the standalone
functions for mono, stereo, silence, and signed over-range data.

## Single-frame spectral analysis (Task 002)

```ts
import { sineWave } from './src/audio/fixtures';
import { analyzeSpectrum } from './src/audio/spectrum';

const result = analyzeSpectrum({
  sampleRate: 48000,
  channels: [sineWave({ sampleRate: 48000, frameCount: 32768, frequencyHz: 60 })],
}, { frameOffset: 0, fftSize: 32768 });
// result.frequencyHz[k]: bin center; result.channels[0].power[k]: bin power.
// Stereo input returns channels[0] = left, channels[1] = right.
```

Supported FFT sizes: 1024, 2048, 4096, 8192, 16384, 32768, 65536. An explicit
`frameLength` from 4 through `fftSize` selects a shorter observation to zero-pad;
otherwise it defaults to `fftSize`. The selected frame must fit in PCM. Padding
is never inferred from short input. Frame offsets count samples per channel.

The selected frame receives a **periodic Hann** window, then padding, then an
unscaled `fft.js@4.0.4` transform (MIT; no runtime dependencies). Bin spacing is
`sampleRate / fftSize`, and output includes DC through Nyquist. Reported duration
excludes padding. Padding creates a denser frequency grid, not better intrinsic
resolution. Neither source PCM nor time-domain APIs are changed.

One-sided power is `d[k] |X[k]|² / (fftSize × Σw²)`, with d=1 at DC/Nyquist,
otherwise 2. Units are squared linear amplitude, **not PSD, dB, or amplitude**.
Summed power equals `Σ(xw)² / Σw²`, which may differ from unwindowed mean square.
An isolated, bin-aligned sine of amplitude A gives peak-bin power A²/3 and total
power A²/2 under full-length Hann. Coherent gain is 1/2; mean-square gain is 3/8.

Seven fixed bands cover 20 Hz through 20 kHz. Power is assigned by bin centers,
with shared boundaries belonging to the higher band and limits clipped to
Nyquist. Empty bands return zero. The spectral decision below lists exact ranges,
endpoint rules, and limitations; no interpolation or per-band normalization occurs.

To run only the spectral tests (full validation commands are above):

```sh
npm test -- src/audio/spectral.test.ts
```

See [the spectral decision](docs/decisions/002-spectral-analysis.md) for derivations,
executed fixture results, dependency evaluation, and numerical tolerances. Exactly
1 kHz at 48 kHz cannot be bin-aligned with a power-of-two FFT; tests explicitly
handle leakage and also verify exact 1 kHz alignment at 51.2 kHz. A 60 Hz signal
uses a longer window and can legitimately spread power across Sub-bass and Bass.

See [the time-domain decision](docs/decisions/001-audio-measurement.md) for PCM
choices, [AGENTS.md](AGENTS.md) for contributor requirements, and
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the added FFT license notice.

## Repeated spectral analysis (Task 002.5)

```ts
import { createSpectrumAnalyzer } from './src/audio/spectrum';

const analyzer = createSpectrumAnalyzer(pcm, { fftSize: 4096, frameLength: 4096 });
const first = analyzer.analyzeFrame(0);
const second = analyzer.analyzeFrame(2048); // Only if the full frame fits in PCM.
```

The factory validates the entire recording once and retains private FFT/Hann
workspaces for fixed settings. Do not mutate or transfer PCM buffers during a
session. Each call validates its offset/bounds and selected samples; returned
arrays and metadata belong to the caller and cannot corrupt later results.
`analyzeSpectrum` retains full-recording validation on every call.

```sh
npm run test:browser
npm run benchmark:spectrum
```

The browser check requires a locally installed Chromium (`CHROMIUM` can select
its executable), Node >=22.12, and no backend or audio permissions. It loads the
real engine through Vite in a separate development-only entry and checks both
APIs. This cloud container has a misconfigured Chromium sandbox helper; use
`CHROMIUM_NO_SANDBOX=1 npm run test:browser` here. The override is explicit and
should only be used in an isolated container where the browser sandbox is
unavailable. Neither command runs in the normal test suite or modifies the UI.

The benchmark defaults to three-minute, 48 kHz stereo PCM, FFT sizes 4096/8192,
and hop 2048. It times 24 public calls and reusable calls at the same offsets,
then reusable processing of every frame, with three trials. For a smaller run:
`BENCH_SECONDS=10 BENCH_PUBLIC_FRAMES=4 npm run benchmark:spectrum`.
See [the hardening decision](docs/decisions/003-spectral-engine-hardening.md)
for measured results, browser evidence, ownership rules, and Task 003 guidance.

## Time-indexed spectral analysis (Task 003)

```ts
import { createSpectrumTimeline } from './src/audio/timeline';

const frames = createSpectrumTimeline(pcm, { fftSize: 4096, hopSize: 2048 });
for (const frame of frames) {
  // frame.index, frame.frameOffset, frame.startTimeSeconds, frame.endTimeSeconds
  // frame.spectrum is the existing independent mono/stereo SpectrumResult.
  console.log(frame.startTimeSeconds, frame.spectrum.channels[0]?.totalPower);
}
```

The factory validates the entire PCM and fixed settings eagerly, once; spectra
are computed lazily by a **single-use** synchronous iterator. `hopSize` is an
explicit positive safe integer in samples per channel; overlap, adjacency, and
gaps are allowed. Offsets are exactly `index * hopSize`, starting at zero, while
the full observed frame fits. Incomplete tails are discarded, with no extra
window appended. Valid nonempty recordings shorter than `frameLength` yield no
frames; invalid PCM/settings still throw eagerly. `frameLength` defaults to
`fftSize`; shorter explicit observations retain the existing FFT padding rules.

Start time is `frameOffset / sampleRate`; end-exclusive time is
`(frameOffset + frameLength) / sampleRate`, excluding padding. Nonfinite timeline
times are rejected eagerly. Wrong types throw `TypeError`; invalid numeric values
throw `RangeError`. Power normalization, units, bands, and channel order are unchanged.

Keep source PCM stable for the iterator's lifetime: do not mutate or transfer it.
The iterator retains PCM and one analyzer workspace while active, without storing
previous spectra. Results belong to the caller and are independent of later
frames and caller edits. Use `for...of` with `break` or the iterator's `return()`
to stop early; release references when finished. Collecting all results can use
substantial memory. This is iteration over in-memory audio, without streaming
input, playback, wall-clock scheduling, workers, or a reconstruction STFT pipeline.
The React demonstration is unchanged. See [the time-indexed decision](docs/decisions/004-time-indexed-analysis.md).

Current limitations: full buffers reside in memory. The engine does not identify
instruments, separate sources, decode files, or visualize spectra.

## Code quality context

See [code quality and review context](docs/references/code-quality.md) for the
owner's video reference, its verification status, and a focused cleanup checklist.

## Project skills

Repository-scoped workflows live in `.agents/skills/`:

- `$soundscape-plan`: plan bounded work with contract impact, analytic acceptance
  criteria, and resumable steps; planning-only requests stop before implementation.
- `$soundscape-build`: implement authorized changes, preserve unrelated work, and
  verify the result using the repository's commands and DSP contracts.
- `$soundscape-review`: review changes and callers for demonstrated regressions,
  numerical correctness, and ownership failures; review-only work stays read-only.
- `$soundscape-walkthrough`: after QA, learn how to review the actual code step by
  step, answer one understanding question at a time, and practice on fresh cases.
  Teaching does not modify code or sign off a milestone. For example: "Use
  $soundscape-walkthrough to explain Task 003 and test my understanding."

Mention a skill explicitly or let Codex select it for a matching Soundscape task.
The skills reference existing project guidance and do not add dependencies or
authorize pushes, merges, or external comments. See the
[research](docs/references/skill-research.md) and
[implementation verification](docs/plans/2026-11-01-project-skills.md) for rationale
and evaluation limits.
