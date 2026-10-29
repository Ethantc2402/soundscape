# 003 — Spectral engine hardening (Task 002.5)

Status: implemented. This ADR number is not implementation of Task 003.
The Hann formula, FFT dependency, supported sizes, one-sided normalization,
PCM interfaces, time-domain measurements, and band definitions remain unchanged.

## Validation boundary and reusable state

`analyzeSpectrum(pcm, options)` keeps its existing signature, error classes,
full-recording validation, and numerical behavior. The new safe public factory
`createSpectrumAnalyzer(pcm, { fftSize, frameLength? })` validates all PCM once,
checks fixed settings and frame fit, and returns only `analyzeFrame(offset)`.
No unvalidated entry point or externally forgeable validation token is exposed.
The common computation and its constructor remain module-private.

One session captures the sample rate and channel references, independent of
subsequent edits to the caller's metadata/container. It owns one fft.js plan,
periodic Hann coefficients/gains, input and interleaved transform workspaces,
normalization denominator, and a private frequency-coordinate template. These
are reused across channels and sequential frames; there is no global cache.
Band aggregation keeps its existing ascending-bin pass. Precomputing another
mapping was unnecessary for this change and would add another ownership path.

Every call validates a numeric safe integer offset, current bounds of every
channel (including detached buffers), and finite selected samples. After the
initial scan, validation scales with the selected frame, not recording length.
Non-null indexed reads in the computation follow explicit validated bounds and
allocated array lengths. Padding remains zero because fft.js reads the windowed
input without modifying it; all observed entries are overwritten each frame.

The caller **must not mutate or transfer PCM storage during a session**, including
through shared memory or another thread. The selected-frame finite check is a
local guard, not whole-recording revalidation or a concurrent mutation guarantee.
Create a new session after edits. There is no snapshot/copy of a whole song.
The session is synchronous and intended for sequential use.

## Output ownership

Each call allocates fresh returned power arrays, frequency array, band results,
and result metadata. Nothing returned aliases private scratch, input PCM, or an
earlier result. Frequency coordinates are computed once then copied per result;
a readonly TypeScript annotation cannot protect a shared typed array at runtime.
Results are caller-owned and mutable at runtime, not frozen. The guarantee is
independence: analyzing another frame or editing one result cannot change another
result or future analyses. No extra copy of newly calculated power is made.

Regression tests preserve earlier spectra across later frames, mutate returned
power/frequencies/bands/window metadata, and compare later calls with pristine
results and a separate session. A spy confirms one full validation per session
versus one per public single-frame call. Invalid samples outside the selected
frame still fail at either public boundary.

## Bands review

No demonstrated defect required changing `bands.ts`. Shared boundaries belong
to the higher band; Air includes 20 kHz. Limits clip to Nyquist. `binCount === 0`
means empty; an endpoint-only band can have identical clipped limits and
`binCount === 1` (Air at 24 kHz sample rate). Summed band power equals power in
included bin centers, not necessarily total spectral power. Hann leakage can
cross boundaries and remains assigned by actual bin center. Existing tests
exercise independent sums, conservation, clipping, empty/endpoint bands,
nonfinite/negative values, and overflow. These bands do not identify instruments.

## Browser evidence

Executed `CHROMIUM_NO_SANDBOX=1 npm run test:browser` in this Linux x64 cloud
container using Chromium **154.0.8037.57** (runtime user agent reports
HeadlessChrome/154.0.0.0), Node **v24.19.0**, Vite **7.3.7**. The separate script
entry imports the real TypeScript engine through Vite and exercises both safe
APIs; no React UI changes, backend, external service, microphone, or audio files.
A deterministic 1 kHz sine at 48 kHz, FFT 4096, produced the same result for both:

- Dominant bin 85, center **996.09375 Hz**, within one bin spacing of 1 kHz.
- Peak power **0.2885278790647461**, total power **0.4999999904833539**.
- All bin powers finite and nonnegative; dominant power positive.

This is actual browser execution, separate from the production app build, whose
entry still does not import FFT. The smoke runner uses Node's built-in WebSocket
and Chromium debugging protocol; no browser package was added. It checks the
visible page status and runtime exceptions, then closes the server/browser.
Module/runtime failures leave a failed or pending page and fail the command.

The initial default Chromium launch failed because its SUID sandbox helper is
misconfigured in this container. The explicit isolated-container override above
was required; default runs retain sandboxing. An initial DOM-dump approach also
failed to return a result; the final runner polls actual page state via the
browser protocol with deadlines instead of depending on virtual-time dumping.
No FFT compatibility error occurred in the successful execution. Other browser
engines and production-bundled spectral execution remain unverified.

## Benchmark methodology and observations

Run `npm run benchmark:spectrum`. The Vite SSR loader executes the real engine
under Node without another TypeScript runner dependency. These observations use
Node v24.19.0, Linux x64, Intel Xeon Platinum 8573C, 5 exposed logical CPUs,
35,743,760,384 bytes OS-reported memory (not a reserved resource guarantee).
Shared cloud load and JIT/GC affect timings; some browser setup ran concurrently.
This is a synthetic observation, not a production latency or real-time guarantee.

PCM: 180 seconds at 48 kHz, stereo Float32, 8,640,000 samples/channel,
69,120,000 input bytes; deterministic 1 kHz left and 187.5 Hz right tones. Hop
2048, full-length Hann, no retained outputs. Generate input before timing; warm
up two public and eight session calls; measure three trials and report median.
Consume one total power per result in a finite positive checksum. Session
construction (including full validation) is timed separately and excluded from
frame throughput. No GC forcing or per-frame logging occurs in timed loops.

The public path uses current `analyzeSpectrum`, which, like the original path,
rescans the full recording and rebuilds FFT state for each call. It is sampled
at 24 evenly spread valid hop offsets per trial to bound runtime; the session
path uses those identical offsets, then separately measures all valid offsets.
The entire public song workload was **not** run or extrapolated as a measurement.

| FFT | Path | Frames/trial | Median total ms | Frames/s | Million observed channel samples/s |
| --- | --- | ---: | ---: | ---: | ---: |
| 4096 | Public, sampled | 24 | 5014.45 | 4.79 | 0.0392 |
| 4096 | Session, same offsets | 24 | 5.85 | 4102.59 | 33.61 |
| 4096 | Session, all offsets | 4217 | 1082.60 | 3895.24 | 31.91 |
| 8192 | Public, sampled | 24 | 4203.95 | 5.71 | 0.0935 |
| 8192 | Session, same offsets | 24 | 13.56 | 1769.52 | 28.99 |
| 8192 | Session, all offsets | 4215 | 2306.49 | 1827.45 | 29.94 |

Session construction took 247.11 ms / 214.21 ms for 4096 / 8192. Throughput
counts FFT size × two channels × frames, so overlapped samples count again;
it is not unique recording bytes decoded per second. Input allocation and Vite
startup are excluded. Memory snapshots are process-wide before/after each path,
not per-path peaks: observed RSS snapshots ranged about 157.7–238.4 MB and heap
used about 12.4–20.2 MB. The retained PCM itself is 69.12 MB; scratch and temporary
outputs add storage. GC timing prevents inferring retained-output memory or a
per-frame allocation rate from these snapshots.

[Raw measured trials and memory snapshots](../benchmarks/task-0025.jsonl) are
retained for audit. `BENCH_SECONDS=10 BENCH_PUBLIC_FRAMES=4` selects a smaller
workload; benchmark commands remain outside the unit suite.

## Numerical verification and next milestone

Baseline: **340 tests passed**, typecheck and build passed at `fe8cb53`.
Final verification: **352 tests passed**, standalone typecheck, production build,
`git diff --check`, and the Chromium smoke command passed. The development
server also served the expected HTML and transformed React entry. No dependency
or lockfile changes were needed.

The expanded suite preserves all existing tests and adds seeded deterministic
mono/stereo comparisons for lengths 4, 997, 1024, 4096; multiple offsets including
last valid frame; repeated inputs; silent/DC/Nyquist frames; zero-padding;
output isolation; invalid settings/PCM/offsets; detached storage; metadata capture;
and validation-call counts. Independent finite-sum DFT and window-weighted
Parseval comparisons use absolute tolerance **1e-12**, preserving the existing
analytic Float32 power tolerance **1e-7** and Hann tolerance **2e-14**.

For Task 003, create one validated session per PCM recording and fixed FFT/window
settings, then call `analyzeFrame(offset)` for each fully fitting selected window.
Keep PCM stable for the entire session and release the analyzer when finished;
it retains the recording and scratch. Recreate it for changed settings or input.
Outputs may safely be retained, but retaining every spectrum has its own memory
cost. Scheduling, tail/overlap policies, time-indexed contracts, workers,
streaming, rendering, and playback remain future work. Task 003 is not started.
