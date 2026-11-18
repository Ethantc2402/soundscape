# Finished stereo mix visualizer roadmap

Status: planned — product direction recorded; implementation not authorized here.

## Objective and chosen workflow

The owner selected a finished stereo song as the first usable input on November
16, 2026. Proposed workflow: open a local song → analyze → play/seek/loop →
inspect frequency, level, and stereo behavior → select a potential issue and
listen to that passage. This roadmap describes future work, not current behavior.

The product should accurately track recording position and clearly communicate
measurement resolution. It must not promise perfect instrument attribution or
that every artistic mix decision can be classified as an error.

## Existing foundation

Verified by source inspection of `src/audio/`, `src/main.tsx`, and the demo test:
- Validated mono/stereo PCM and independent peak/RMS/mean-square measurements.
- Hann-windowed FFT power, reusable analysis sessions, seven broad bands.
- Lazy, sample-indexed spectral windows over complete in-memory recordings.
- A static six-column synthetic mono heatmap; no user-file import or playback.

Existing contracts remain authoritative: decisions 001–004, source immutability,
finite over-range samples, left/right ordering, intentional error classes, and
independent caller-owned results. Spectral output contains power, not complex
phase. Existing whole-record measurements are not time-varying level meters.

## Ordered milestones and observable gates

### 1. Import and inspect one real song

Add local file selection and browser decoding outside `src/audio/`. Keep files
local for this version. Display duration, decoded sample rate, channel count,
and progress/error states; permit cancellation or replacement. Define supported
formats and resource limits from tested browser behavior. Explicitly document
decode sample-rate conversion; the decoded PCM is the analysis/playback reference.
Reject unsupported channel layouts rather than silently downmixing them.

Gate: a known stereo fixture imports with correct duration/channel order and
known band activity. Corrupt/unsupported/oversized files fail intelligibly;
replacing a file cannot publish stale results. Original decoded PCM stays intact.

### 2. Playback and one recording-relative clock

Add play/pause, seek, loop, a waveform overview, and a synchronized playhead.
Map output playback position to sample-indexed analysis. Define window start,
center, and end semantics, output latency handling, end behavior, and final
partial-window display policy without silently changing the timeline API.

Gate: a timed impulse/tone recording demonstrates alignment after pause, seek,
loop, and end-of-song. Set a measured synchronization tolerance on target devices
before claiming completion; distinguish analysis-window duration from UI lag.

### 3. An interactive frequency view at song scale

Add a logarithmic frequency axis, a documented logarithmic power display,
time/frequency zoom, cursor readouts, channel selection, and loop selection.
Retain raw linear powers; define the logarithmic reference and silence floor
explicitly. Do not label spectral power as perceptual loudness or true peak.
Use the existing full spectrum for detail rather than only seven band totals.

Process analysis away from the UI thread when necessary, with explicit worker
ownership, bounded compact caches, cancellation, and zoom-dependent display
aggregation. Avoid retaining every full-resolution spectrum. Keep the DSP core
independent of worker/browser APIs. Smoothing is a visible display setting.

Gate: silence renders without invalid numbers; two known tones appear at the
correct frequencies/times. A declared song-length/device workload completes
within an agreed memory and response budget. No performance claim before measurement.

### 4. Explainable measurement overlays

Add windowed level/dynamics summaries, low-frequency balance and persistence,
candidate resonances, and stereo/mono behavior. Define each metric, window,
normalization, units, and silence handling before implementation. Mid/side and
correlation need explicit new contracts; current per-channel power alone is
insufficient for phase-sensitive analysis. Any mono audition is a documented
derived signal; source channels remain unchanged.

Gate: independent synthetic cases cover silence, equal-level tones, changed
levels, resonances, L-only/R-only, identical channels, and opposite-polarity
channels. State analytic expectations and numerical tolerances in each bounded
milestone. Sample peak remains distinct from clipping evidence and true peak.
Add standardized loudness/true-peak only as separately specified, sourced work.

### 5. Potential-issue markers with listening evidence

Start with a small set: sustained low-end concentration, narrow persistent
peaks, and potential mono cancellation. Treat these as observations or
hypotheses, not guaranteed defects. Define duration, thresholds, level dependence,
and silence gating; expose the relevant evidence and frequency/time region.

A selected marker should seek/loop its region and explain what to listen for.
Optional band-limited audition needs its own filter contract and level handling.
Do not infer "kick masks bass" from a stereo spectral overlap score. Do not
invent probability/confidence percentages from uncalibrated heuristics.

Gate: controlled positives and counterexamples exercise each rule, including
intentional bass-heavy passages. Listening review on permitted real mixes records
false positives and missed cases. Musical usefulness requires evidence beyond
analytic tests. No universal "good mix" target is assumed.

### 6. Product validation and final presentation

Validate that users can locate, understand, and audition a suspected problem.
Test responsive layout, keyboard navigation, non-color cues, reduced motion,
loading/cancellation/errors, audio-device interruption, and song replacement.
Add optional user-selected reference comparison with an explicit level-matching
policy. Validate reference usefulness before adding generic genre targets.

Choose the final 2D/3D presentation after the diagnostic interaction is useful.
If 3D remains desired, define frequency/time/power axes and preserve a precise,
accessible inspection alternative. Visual animation must represent measured data.

Gate: representative users complete the inspect → loop → listen workflow;
performance and synchronization budgets pass on a declared browser/device matrix.
Record limitations and reproducible QA evidence before release.

## Architecture and affected components

- `src/audio/`: pure measurement additions with analytic tests; preserve public APIs.
- `src/main.tsx`, `src/demo.css`: current UI entry points; extract cohesive UI
  components only as product responsibilities grow.
- New browser-bound import, transport, analysis orchestration, and rendering
  modules: exact filenames/interfaces belong in their individual milestone plans.
- Session owner holds decoded PCM and cancels obsolete jobs. Workers must not
  detach PCM still used by playback/analyzers; choose and document copy/transfer
  ownership and memory costs before adding workers.
- Derived caches identify recording, channel, settings, and display resolution.
  Rendering reads compact derived data and never mutates source audio.
- Update README, Product, Architecture, and decisions when behavior is implemented.

## Deferred paths

Separate exported tracks/stems would enable track-specific comparisons but need
alignment and session handling. Automatic instrument separation/identification
would require a separate evaluated approach and does not guarantee faithful
stems. A live DAW version needs a separate integration, transport, buffering, and
latency design. None is required for this finished-song first version.

## References and reasoning limits

- [Web Audio specification](https://www.w3.org/TR/webaudio/): browser decode and
  playback boundary; inspect exact API requirements during milestone planning.
- [MDN decodeAudioData](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData):
  decoded audio is resampled to the context sample rate.
- [MDN getOutputTimestamp](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/getOutputTimestamp):
  output/context time mapping informs synchronization design.
- [iZotope on frequency masking](https://www.izotope.com/en/learn/what-is-frequency-masking):
  masking is context-dependent. This is background, not a validated Soundscape
  detector or permission to reuse a proprietary algorithm.

The staged design and acceptance gates above are proposals. No detector thresholds,
performance figures, listening-study results, or implementation estimates are claimed.

## Verification and progress

- Repository status inspected; pre-existing untracked `soundscape/` preserved.
- Relevant docs, implementation, and tests inspected. No application changes made.
- Runtime checks not executed for this planning-only task: `npm ci`, `npm test`,
  `npm run typecheck`, `npm run build`, browser checks, and benchmarks.
- For each implementation milestone run the required repository commands above
  plus `git diff --check`; add browser and performance evidence where specified.

## Next steps

Create a bounded plan for milestone 1: supported formats, decoded-PCM sample-rate
policy, maximum resource budget, import/cancel lifecycle, and fixtures. Implement
only when requested. Revisit later milestone details after real-song import and
synchronized playback supply evidence about performance and user needs.
