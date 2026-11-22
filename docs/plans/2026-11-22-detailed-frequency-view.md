# AD-003 — selected-window detailed frequency inspection

Status: in progress — inspection and bounded draft complete; material display
decisions await the owner. No feature implementation yet. November 22, 2026.

## Why now

Seven broad band totals cannot show where a frequency peak lies inside a band.
Expose the existing full spectrum for one selected window before attempting
song-scale rendering. This gives the owner a concrete frequency readout while
keeping analysis and retained data bounded. It does not depend on physical
playback synchronization acceptance.

## Current evidence

- `src/audio/spectrum.ts` already returns independently owned frequency/power
  arrays, window metadata, spacing and per-channel bands. Decision
  [002](../decisions/002-spectral-analysis.md) defines bin-integrated squared
  linear amplitude, not amplitude, PSD or perceptual loudness.
- `src/song-inspection.ts` uses one validated 8192-sample analyzer, clamps the
  last full window and returns only bands. It discards the full spectrum after
  each inspection; no new transform or DSP normalization is needed.
- `src/SongTransport.tsx` owns one selected analysis result and refreshes from
  the recording snapshot at most 15 Hz, with immediate refresh on seek. Its
  existing interval and refresh-age labels must apply to both views together.
- `src/song-session.ts` owns stable PCM/analyzer lifetime. Replacement/unmount
  releases that session. Do not add global caches, transfers or another PCM copy.
- At 48 kHz, 8192 samples give 5.859375 Hz bin spacing and an observed interval
  of 8192/48000 seconds. These are arithmetic properties, not measured response
  times or guarantees that neighboring tones can be resolved.
- Inspected inspection/session source and tests, transport/import UI, spectral
  implementation/tests, import browser assertions and relevant playback harness
  callers. Existing analytic Hann peak/neighbor, silence, DC/Nyquist, two-tone,
  over-range, ownership and frame-selection evidence is reusable. New view
  projection and interaction behavior still require their own verification.

## Small proposed outcome

One selected-window plot with a logarithmic frequency axis, one selected channel
(Mono or Left/Right), and a keyboard-operable bin cursor showing actual bin
center, raw linear power and the agreed logarithmic display value. Keep current
band tables and transport behavior. Label observed duration, bin spacing and
display rules; do not imply interpolated pitch or mix-quality diagnosis.

Approved first frequency range is 20 Hz through min(20 kHz, Nyquist), consistent
with the band view. Raw results still include DC and Nyquist. Explain omitted
frequencies; never take log(0 Hz). Remaining display choices await owner answers
as recorded in the backlog. Later time/frequency zoom and region loops
belong to AD-006; this slice is not milestone 3 completion.

Owner decisions subsequently recorded in chat
`01a203e9-6c76-76a3-9fc7-b4093000e876`: questions **1A, 2A, 3A**, followed by
**4A** after requesting a durable frontend backlog. Approved: −100 to 0 dB with
above-range marker/actual numeric value, distinct silence/below-range labels,
unsmoothed existing-window measurements, and initial 20 Hz–min(20 kHz, Nyquist)
logarithmic frequency range. These answers supersede pending language below.
See [the product backlog](../PRODUCT-BACKLOG.md) for approved policies, questions
5–10 still awaiting answers, and deferred full-range/zoom/comparison alternatives.
No feature code has been implemented by these decision updates.

## Material decisions — discuss in order

1. **Fixed scale approved:** the owner answered “yes let’s proceed with fixed
   scale” in chat `01a203e9-6c76-76a3-9fc7-b4093000e876` on November 22.
   Preserve the same scale while seeking so section levels remain comparable.
   This approves fixed scaling, not every remaining display or implementation
   choice. The owner subsequently approved using the existing power reference
   instead of calibrating a full-level test-tone peak to 0 dB in the same chat.
   Approved convention:
   `10 * log10(P / P_ref)`, where `P_ref = 1` squared linear amplitude, explicitly
   labeled “dB re 1 squared linear amplitude.” This is an approved display contract,
   not an existing engine definition or a generic dBFS/loudness claim. Hann peak
   power for an interior full-length bin-centered unit sine remains 1/3; no
   correction makes its peak zero. Implementation remains pending.
2. **100 dB display range approved:** the owner answered “let’s go 100db” in
   chat `01a203e9-6c76-76a3-9fc7-b4093000e876` on November 22, choosing the
   proposed 100 dB range rather than 120 dB. This is a display choice; preserve
   raw measurements. The reference is now approved; absolute endpoints and
   upper-limit behavior still need agreement. Specify
   exact-zero labeling, below-floor values and positive over-range handling.
   Later question 1A approves −100 to 0 dB with above-range markers and actual
   numeric values; question 2A approves separate Silence/below-range labels.
   Keep raw powers intact;
   no NaN/Infinity in plot coordinates, and distinguish silence from small power.
3. **Approved in question 3A:** retain the existing
   8192-sample observation and plotting raw bin samples without smoothing for
   this slice, with an actual-bin cursor. Narrow plots crowd high-frequency
   bins; reduction would need an explicit max/mean/sum rule with distinct units
   and peak behavior. The owner approved unsmoothed measured points;
   do not silently equate pixel width with measurement resolution.

Silence is not agreement. Ask one material question at a time; do not treat a
pending preference as approved. The owner's later instruction in chat
`01a203e9-6c76-76a3-9fc7-b4093000e876` requires asking and waiting before every
implementation choice, including routine reversible choices. No timeout defaults.

## Proposed implementation boundary

- Add an owned `spectrum: SpectrumResult` field to each fitting inspection result,
  preserving the existing `channels` band projection and time/sample fields for
  current callers. Both come from the same `analyzeFrame` call. Keep the short
  result undefined and existing error classes/bounds. No second analyzer/FFT.
- Add `src/FrequencySpectrum.tsx` for the selected-channel plot and accessible
  bin selection/readout, plus a small pure display projection module if needed.
  Keep display logarithms, coordinates and floor policy outside `src/audio/`.
  Use existing React/SVG/native controls; no dependencies or UI redesign.
- Feed the component the existing selected analysis from `SongTransport.tsx`;
  do not create a competing refresh clock. Retain one current result, no spectrum
  history; replace stale state on song change. Channel/cursor changes reuse it.
- Retaining frequency plus two power arrays at 4097 Float64 entries is 98,328
  nominal bytes for a stereo result, excluding objects/bands/transient results.
  This is storage arithmetic, not a heap/native-memory measurement or budget.
- Extend inspection and display tests plus import/playback browser assertions.
  The import harness currently asserts a total table-row count: scope any new
  assertions to their named region rather than weakening coverage globally.
- Update README, Architecture and Product only when behavior exists. Add a
  display decision record with the actual agreed rules and their rationale.

No playback-adapter change, startup workaround, FFT/dependency change, worker,
full-song cache, metric/detector, smoothing or new input format is in this slice.
Read the complete Task 006 plan before any future playback change.

## Observable acceptance and verification

- [x] Trace existing APIs, ownership, callers and tests; distinguish current and
  proposed behavior; identify material display choices.
- [ ] Record real owner answers to all material display decisions.
- [ ] Selected plot and band table use one identical sample interval, including
  last-fit tail and loop seam. Short recordings have no synthetic padded plot.
- [ ] At fs=48000, N=8192, separated interior tones at 187.5 Hz and 3000 Hz have
  peaks at bins 32 and 512. With amplitudes 0.5 and 0.25, expect respective peak
  powers A²/3 and neighbors A²/12, absolute power tolerance 1e-7 per decision 002.
  Use separate channels and changing windows to reveal channel/stale-data errors.
- [ ] Test the display conversion independently from FFT: exact power ratios,
  zero, floor boundaries, positive over-range and raw-value preservation using
  the agreed convention. Set justified display arithmetic tolerances when its
  formula is agreed; do not reuse absolute linear tolerances as dB tolerances.
- [ ] Old results survive later analysis and caller edits cannot corrupt PCM,
  private scratch or subsequent results. Existing invalid-time/sample error
  classes and no-full-record-rescan contract remain intact.
- [ ] Browser checks exercise known peaks/readouts, channel/cursor controls,
  seek, silence, short input, replacement/unmount, error/retry and 1200/320px
  layout. Inspect screenshots; test keyboard/focus and non-color readouts.
- [ ] Measure a declared five-minute fixture during seek/playback before making
  responsiveness claims. Register a device/workload response budget with owner
  before claiming performance acceptance. Retained history must not grow with
  elapsed playback. Physical/native-memory acceptance remains separate.
- [ ] Run required install, tests, typecheck, build and whitespace checks; review
  final diff and callers using author self-review, then teach one source segment.

Implementation order after decisions: additive inspection output/tests → display
projection/component/tests → shared-state integration/browser checks → docs,
required QA and author self-review. Do not change DSP tolerances or borrowed PCM
ownership to accommodate rendering.

## Task ownership and progress

Activity check: this chat active; setup and predecessor idle. All 14 pre-existing
tracked modifications and existing untracked Task 006/coordination files remain
predecessor work. This task owns only this plan and its ledger update. Unrelated
`soundscape/` is preserved. No production, test, harness, dependency or benchmark
edit is justified before the pending material decisions.

Fresh checks: `npm ci --cache /private/tmp/soundscape-npm-cache` passed (100
packages); `npm test` passed (573 tests/12 files); `npm run typecheck`,
`npm run build` and `git diff --check` passed. Separate whitespace checks for all
22 untracked task files and local links in both written docs passed. No lint
configured. No fresh browser/performance/hardware/memory/listening/accessibility
check for this docs-only task. Author self-review found no actionable issue in
the plan/contract trace; this is not independent review or runtime acceptance.

Planning slice complete; feature remains in progress. The owner has now approved
fixed scale, existing power reference, −100 to 0 dB with above-range readouts,
distinct silence labels, unsmoothed measurements and the focused frequency range.
Next: backlog FE-01 / question 5, channel presentation, then remaining choices
before dependent work. AD-004 has since completed; the next
independent audit is AD-005, subject to the continuation blocker recorded in the
[ledger](2026-11-22-autonomous-delivery.md). Task 006
physical startup/sync/native-memory/listening/accessibility gates remain open;
historical browser checks do not close them.
