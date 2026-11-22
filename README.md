# Soundscape 3D — Audio measurement foundation

Minimal Vite + React + strict TypeScript application with pure time-domain and
single-frame and time-indexed FFT measurements. The React demo shows
time-domain measurements for a synthetic sine and a band-power heatmap for a
separate mono recording.

Task 005 also adds local WAV import, independent mono/stereo whole-record
measurements, and seven-band inspection of a selected 8,192-sample window.

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
- `src/demo-band-timeline.ts`: builds a mono fixture and projects its spectra to band names, powers, and time intervals.
- `src/main.tsx`: renders the time-domain measurements and band-power heatmap.

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
See [the time-indexed decision](docs/decisions/004-time-indexed-analysis.md).

Current limitations: full buffers reside in memory. The pure engine does not
identify instruments, separate sources, or decode files; the browser adapter
handles local WAV decoding separately.

## Inspecting a local song (Task 005)

Choose a mono/stereo PCM WAV in **Inspect a local song**. Files stay on the device;
there is no upload. Limits are 64 MiB encoded and five decoded minutes. PCM16 and
PCM24 are browser-tested; other WAV encodings are not guaranteed. Import uses a
48 kHz offline decoding context and displays the actual decoded sample rate.
This may differ from the source rate. Browser PCM conversion can also affect
sample values; Soundscape does not normalize or clip decoded PCM.

Whole-record sample peak/RMS use linear amplitude; mean-square and band power use
squared linear amplitude. Select a window start with the number input or slider.
The view shows actual sample offset and end-exclusive window times. The final
window clamps to fit; short recordings retain whole-record results without a
spectral window. Values describe measurements, not mix-quality judgments.
On narrow screens the named table regions can be focused and scrolled.

Cancel/replacement discards stale results. Native decoding cannot be interrupted;
one read/decode pipeline runs at a time, with only the latest pending selection.
Decoded duration/channel guards apply after browser allocation, so the file cap
is not a hard bound on decoder memory. Decoded copying and full-record validation
remain synchronous. Import measurement
arithmetic is processed incrementally with task yields and generation checks;
phase updates paint before preparation.

New modules: `src/browser/import-audio.ts` owns decoding and fresh PCM copies;
`src/import-session.ts` serializes requests; `src/song-inspection.ts` reuses one
spectral analyzer; `src/ImportedSong.tsx` owns the React UI lifecycle.

Run real decoding, UI, and five-minute workload checks with:

```sh
SMOKE_ENTRY=import npm run test:browser
```

Use `CHROMIUM` to select Chrome/Chromium as with the existing engine check.
The check writes desktop/narrow screenshots to the system temporary directory
and reports measured timings; those are environment-specific, not guarantees.
See [the import decision](docs/decisions/005-local-song-import.md) and
[Task 005 results](docs/plans/2026-11-16-task-005-local-song-inspection.md).

## Frequency-band power over time (Task 004)

The heatmap shows six adjacent 0.1-second windows of a built-in mono recording.
The first two windows contain a 150 Hz tone (Bass), the middle two are silent,
and the last two contain a 3,000 Hz tone (High mids). A shared linear color
scale runs from 0 to 0.5 in squared linear amplitude. Cell values are shown
to three decimal places. On narrow screens, Tab focuses the heatmap region
and the arrow keys scroll through the time columns.

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

## Local playback and shared inspection (Task 006)

Imported songs now have Play/pause, whole-record loop, a per-channel waveform,
and numeric/range/waveform seeking over the full decoded duration. Play requires
a user gesture. Pause keeps position; seeking to exact end stops, and Play at
end replays from zero. Short audio is playable even without a spectral window.
Hidden tabs and audio interruptions pause; press Play explicitly to resume.

Waveform and selected-window analysis follow one recording-relative snapshot.
The table shows its full interval, center and refresh age, and updates at most
15 Hz during ordinary playback. Tail windows clamp backwards and loop windows
never wrap. Whole-record measurements stay static. Numeric text shows the requested
seek; queued output can briefly retain its preceding playhead/analysis position.

Timing is labeled **output estimate**, **uncompensated**, or **unconfirmed**.
Physical output synchronization is unverified. Playback copies decoded PCM once
into native audio storage; device-rate conversion/output clipping does not change
the PCM measurements. Import preparation and first-Play copying provide task yields; some synchronous
scans and native startup remain. See the plan for measured costs and pending acceptance.

```sh
SMOKE_ENTRY=playback npm run test:browser
```

This entry checks the actual offline source graph and real React UI with trusted
pointer/keyboard events, without an autoplay bypass. It includes a bounded
five-minute workload and writes viewport screenshots to the system temp directory.
Headless browser success does not verify physical output, manual listening,
native-memory reclamation or five-minute drift. See [decision 006](docs/decisions/006-playback-shared-clock.md)
and the [Task 006 plan](docs/plans/2026-11-18-task-006-playback-shared-clock.md).

### Task 006 foreground responsiveness probe

Run `CHROMIUM_HEADLESS=0 SMOKE_ENTRY=responsiveness npm run test:browser` with
`CHROMIUM` set to the installed Chrome executable. This opens headed Chrome,
brings the probe to the foreground, and measures trusted pointer delay, timer
and animation-frame gaps during five-minute import and first Play. Fixture
creation is excluded. First Play uses the probe's transient user activation;
the playback suite separately verifies a direct trusted Play click. Raw measured
results and limitations are in [Task 006](docs/plans/2026-11-18-task-006-playback-shared-clock.md).

Playback validation/copy yields in chunks into one unpublished native buffer.
Pause cancels playback intent; subsequent Play shares/reuses preparation. Disposal
stops further chunks. This trades longer preparation for interaction opportunities.
Import validation now uses indexed scans; measurement arithmetic runs in bounded
chunks with a soft 4 ms task budget. On the measured five-minute fixture this
reduced foreground click delays and total import time. Copying, validation, analyzer
setup and waveform generation still contain synchronous work. Native context
startup remains a separate unresolved stall; physical synchronization, memory and
manual/device acceptance remain open. See the plan for raw trials and tradeoffs.


For native first-Play startup diagnostics, the same foreground probe additionally
records constructor/resume timings and context state changes. `STARTUP_VARIANT`
can select `rate`, `playback-latency`, or `silent-switch` experiments; these affect
only the harness, never production playback. None resolved the measured native
stall; the silent-switch experiment currently cancels Play and fails the probe.
The current test machine reports no audio output devices. A run with a known
built-in/wired output is the next acceptance step; see the Task 006 plan and
[native startup evidence](docs/benchmarks/task-006-context-startup.json).
