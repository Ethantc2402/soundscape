# Task 005 — Import and inspect a local song

Status: completed — November 18, 2026. Implementation and automated QA passed;
the owner confirmed the remaining manual interaction checklist.

## Objective

Connect a user-selected finished song to the existing measurement engine. A user
can choose a local WAV, see its decoded metadata and independent channel
measurements, and inspect seven-band power at a selected recording position.
This is the first bounded slice of the stereo-mix visualizer roadmap.

Current behavior is a synthetic sine summary and static synthetic mono heatmap.
Keep those examples, clearly separated from the imported-song section. This task
adds real input and a small inspection UI; it does not implement playback,
full-song spectral storage, issue detection, workers, or 3D.

## Proposed product decisions

- Local-only, one file at a time. No uploads, services, dependencies, persistence,
  or changes to existing DSP APIs. Launch format is WAV; verify PCM16 and PCM24
  WAV in target browsers. Do not advertise every WAV encoding as supported.
  Filename/MIME filtering is a convenience, not proof of decodability.
- Provisional limits: 64 MiB encoded input, at most 300 decoded seconds, mono or
  stereo. Reject empty files before reading; reject size above the limit before
  allocation. Check decoded duration/channel count before copying channel data.
  These are product limits, not measured performance guarantees.
- Decode with a 48,000 Hz `OfflineAudioContext`; read the actual returned rate
  and use it as the single PCM time/frequency reference. Display "decoded sample
  rate" and explain that import may resample. Do not claim to report the original
  source sample rate. Fail clearly if the target browser cannot supply this path.
- Duration and channel limits are post-decode guards, not a hard cap on decoder
  memory. Native decode may temporarily allocate more; record this limitation.
  Do not add a WAV parser solely to claim a hard memory bound in this task.
- Cancellation invalidates the current request immediately; it does not promise
  to interrupt native decoding. Serialize decode work: one active operation and
  at most one latest pending selection, replacing earlier pending selections.
  Stale success/failure must never update the current UI.
- Selecting a replacement clears the previous song/result and starts loading.
  Cancel returns to empty; failure shows a recoverable error. Disable inspection
  until ready. Selecting the same file again must work.

## Interfaces, ownership, and affected components

- Proposed `src/browser/import-audio.ts`: browser file/decode boundary returning
  `{ fileName, pcm: PcmAudio }`. Browser errors are mapped to useful UI messages;
  existing DSP TypeError/RangeError contracts remain unchanged.
- Copy decoded channels into session-owned Float32Arrays, preserving mono or
  stereo left/right order. Release encoded data and AudioBuffer references when
  possible after conversion. Session PCM is borrowed read-only by measurements
  and the analyzer; never mutate, clip, normalize, or transfer its buffers.
- Proposed `src/song-inspection.ts`: browser-independent projection using
  `measureAudio` once and `createSpectrumAnalyzer` once per imported recording.
  Return whole-record peak/RMS/mean-square results plus selected-window bands;
  do not run full-record validation on every cursor change.
- Fixed inspection settings: fftSize 8192, full-length observation, no padding.
  For requested nonnegative recording time t, select
  `min(floor(t * sampleRate), frameCount - 8192)`; constrain UI to valid starts.
  Validate nonfinite/negative requests intentionally. Display actual sample
  offset and start/end-exclusive seconds, not just requested time.
- For recordings shorter than 8192 samples, show metadata and whole-record
  measurements plus "too short for this analysis window"; no analyzer is made.
- Proposed `src/ImportedSong.tsx`: accessible input/status/error/result controls;
  owns request identity, session lifecycle, and latest pending selection.
  `src/main.tsx` mounts it; `src/demo.css` adds focused styling.
- Tests beside new modules; extend the existing browser harness only as needed.
  DSP in `src/audio/` stays independent of React, DOM, and Web Audio.
- Update README, Product, Architecture, and a short browser-import decision when
  implemented. Keep current linear amplitude and squared-amplitude unit labels.

## Acceptance criteria and evidence

1. Import valid mono/stereo WAVs and display filename, decoded duration, sample
   rate, channel labels, and per-channel sample peak, RMS, and mean-square power.
   Duration equals frameCount/sampleRate. No stereo averaging occurs.
2. Numeric time input and a native slider inspect the same selected window;
   show seven band values per channel with actual window times and units.
   Silence displays exact zero; no dB scale or fixed synthetic color ceiling is
   applied to arbitrary imported audio. Selected-window values are not presented
   as full-song band averages or judgments about the mix.
3. Pure projection tests use 48 kHz PCM, independent left/right bin-centered
   tones (bin 32 = 187.5 Hz and bin 512 = 3000 Hz for fftSize 8192), amplitudes
   0.5 and 0.25, and integer-cycle recording lengths. Expected per-channel
   whole-record peak is A, RMS A/sqrt(2), mean square A²/2; selected band totals
   are A²/2. Use existing 1e-6 peak/RMS and 1e-7 mean-square/band absolute
   tolerances. Check other bands near zero, channel isolation, silence, and
   finite over-range PCM without clipping. Check source arrays unchanged.
4. Boundary tests cover zero/final/fractional time, invalid time, exact-fit and
   short audio. A changed-tone fixture proves moving the cursor changes the
   selected content; metadata-only assertions are insufficient.
5. Adapter tests verify fresh channel ownership, malformed decoded data, mono,
   stereo, unsupported layouts, empty input, decode rejection, and exact/over
   resource boundaries. Existing validation rejects nonfinite samples.
6. Controlled async tests cover A→B replacement, cancel during decode, stale
   success and failure, selecting the same file, unmount, and pending-request
   replacement. Assert no more than one active read/decode pipeline. A canceled
   decode may finish, but cannot publish results or leak retained sessions.
7. Real browser decode checks use generated PCM16/PCM24 WAV fixtures, avoiding
   proprietary music. Choose exactly representable amplitudes and integer-cycle
   signals at 48 kHz; compare decoded samples against the quantized fixture and
   measurements using the tolerances above. Verify a 44.1 kHz fixture imports
   into the declared decoded rate, preserving duration to within one decoded
   sample; do not demand bitwise equivalence across resamplers. Include a corrupt
   WAV and greater-than-stereo fixture. Mocks alone cannot establish decoding.
8. At desktop and about 320 CSS px, complete select → load → inspect → replace
   and error → retry using keyboard and pointer. Label controls, announce phase
   changes/errors, retain visible focus, and expose values without color.
   Loading is indeterminate; do not invent percentage progress.
9. Exercise a generated five-minute stereo file on a named browser/device;
   record import/copy/measurement time, cursor response, and observable memory
   behavior. No speed claim is assumed. If synchronous scans cause unusable
   interaction, record the blocker and plan the smallest measured remedy before
   expanding into worker infrastructure. Stages should get a paint opportunity.

## Implementation steps

- [x] Build and test the file/decode/PCM ownership adapter and resource guards.
- [x] Build and analytically test the reusable selected-window inspection model.
- [x] Add the import lifecycle and minimal accessible inspection UI.
- [x] Complete manual interaction checklist through owner-reported testing;
  automated decoding, UI, viewport, and workload checks passed (details below).
- [x] Update implemented-behavior docs and import decision; review the final diff.

## References

- [MDN decodeAudioData](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData):
  decoding uses complete file data and resamples to the context rate.
- [Web Audio Recommendation, decodeAudioData](https://www.w3.org/TR/2021/REC-webaudio-20210617/#dom-baseaudiocontext-decodeaudiodata):
  browser API contract. Request invalidation/serialization above is our proposed
  lifecycle design, not a claim that the decoder exposes an AbortSignal.
- Existing numerical definitions: decisions 001–004 and README. No borrowed
  algorithm implementation is proposed.

## Verification and progress

### Implemented behavior

- Added browser import/copy validation, a serialized generation-based controller,
  a reusable inspection model, and an accessible React import view. The synthetic
  examples remain. No dependencies, DSP public APIs, or source PCM were changed.
- The UI shows metadata, per-channel measurements, and seven-band power for a
  numeric/slider-selected full window. Errors clear old results; short recordings
  show whole-record measurements. File input resets to permit same-file retry.
- Named, focusable table regions scroll internally on narrow screens. Visual
  inspection of the initial 320px screenshot found broken word wrapping; replaced
  it with readable table widths and verified the new screenshot. Page-width
  overflow assertion passes at 320px.
- README, Product, Architecture, and decision 005 describe implemented behavior,
  ownership, decoded timing, cancellation, and memory limits.

### Plan correction from browser evidence

Criterion 7 originally assumed exactly representable encoded samples would
decode unchanged. macOS Chrome PCM16 positive codes use /32767 while negative
codes use /32768: an encoded half-scale period decodes to
`[0, 0.5000152587890625, 0, -0.5]`. The first real browser check reproduced this
failure. Browser fixtures now use explicit platform-specific decoded expectations
and independent analytic formulas for that asymmetric period; DSP tolerances
remain 1e-6/1e-7. Application PCM is never normalized to fit an oracle. See
decision 005 for derivation and reference conventions. PCM24 passed strict checks.

### Checks executed

- `npm ci --cache /private/tmp/soundscape-npm-cache --offline`: failed because
  `why-is-node-running-2.3.0.tgz` was not cached. Network-approved
  `npm ci --cache /private/tmp/soundscape-npm-cache`: passed; audit reported zero
  vulnerabilities. No lockfile changes.
- `npm test`: passed, 532 tests across eight files. Includes independent tone,
  silence, over-range, frame-boundary, immutability/result-ownership, file/resource
  validation, and controlled async replacement/cancel/dispose/recovery cases.
- `npm run typecheck`: passed. Initial new-test typing errors involving generic
  Float32Array storage and a deliberate readonly-result mutation were corrected;
  no production contract was loosened.
- `npm run build`: passed, including typecheck and Vite production bundling.
- `git diff --check`: passed. Untracked `soundscape/` and the roadmap preserved.
- `SMOKE_ENTRY=import CHROMIUM='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:browser`:
  passed. Actual PCM16/PCM24 mono/stereo sample values and independent analytic
  metrics/band powers; 44.1→48 kHz duration; corrupt container, corrupt WAV payload,
  and three-channel rejection. The actual React app passed programmatic numeric
  and slider changes, cancel, replacement/retry, short recording, and error states.
  Desktop (1200px) and narrow (320px) iframe screenshots were captured and visually
  inspected. These scripted DOM events do not establish a manual keyboard pass.
- Desktop/narrow screenshots are in the system temporary directory as
  `soundscape-task005-desktop.png` and `soundscape-task005-narrow.png`; the test
  prints their absolute paths on each run.
- Existing engine check, `CHROMIUM='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:browser`:
  passed after the shared harness changes; spectral/timeline behavior retained.
- Author self-review used soundscape-review: inspected tracked diff and all new
  modules/tests, caller boundaries, stale request publication, source/result
  ownership, units, and validation. Fixed the narrow-table issue found during QA.
  This is self-review, not independent review.

### Five-minute workload (latest run, November 16, 2026)

Environment: macOS, HeadlessChrome 157.0.0.0, `MacIntel`, eight reported logical
processors. This is one local run, not a cross-device performance guarantee.

- Generated five-minute 48 kHz stereo PCM16 WAV: 57,600,044 encoded bytes;
  115,200,000 copied PCM bytes.
- Read reached decode at 20.8 ms; decode reached preparation at 140.5 ms.
- Read/decode/copy/validation combined: 313.8 ms; whole-record measurement and
  reusable analyzer setup: 489.4 ms. The latter remains synchronous.
- 100 direct cursor inspections: 24.5 ms total.
- Actual React five-minute import through rendered results: 819.1 ms.
- Reported JS heap before direct import: 63,348,466 bytes; after measurement and
  cursor loop: 248,074,247 bytes. These observations include test-held data and
  are neither a reliable native-decoder accounting nor peak/released-memory proof.
- No worker was introduced. Synchronous setup can pause interaction for roughly
  half a second on this workload; slower devices need separate measurement.

### Owner-reported manual verification — November 18, 2026

The owner performed the guided checks locally and reported:

- Moving the position slider updates the measurements and table values across
  different moments of the recording.
- The file picker filters non-WAV files. Files larger than 64 MiB show a refusal
  to load; a correct file can be loaded afterward. Picker filtering is not evidence
  of corrupt-WAV rejection; that has separate automated browser coverage.
- Keyboard navigation moves between the interface controls.
- Cancel during loading works, and replacement during loading works, in response
  to the corresponding guided test steps.
- Horizontal table scrolling works after enabling the responsive device toolbar
  and setting the instructed width to 320px.

These confirmations close the outstanding manual checklist for Task 005. They
are owner-reported evidence, not agent-observed interactions. Exact browser/version
and individual key presses were not captured; screen-reader announcements were
not tested. This does not establish a comprehensive accessibility certification.

### Remaining limitations

- Agent-operated manual verification was unavailable: in-app browser
  creation returned "The browser access host is unavailable"; native Chrome
  access timed out and reset its runtime. Automated UI checks and screenshots
  completed through the existing browser test harness. Focus styles, labels,
  native controls, status/alert semantics, and scroll-region tab stops are present,
  and owner-reported manual results above supply the task-level evidence.
- Browser compatibility evidence is macOS Chrome only; Safari/Firefox and slower
  devices are unverified. The native decode allocation limit remains documented.

## Next steps

Task 005 is complete within its stated browser/resource scope. The next product
milestone is playback with a shared recording-relative clock; it needs a separate
plan and implementation request. Cross-browser, screen-reader, and slower-device
verification remain future release coverage, not results claimed by this task.

This closeout changed documentation only. Runtime checks above were not rerun;
`git diff --check` passed after the closeout edit.
