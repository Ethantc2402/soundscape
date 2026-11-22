# Task 006 — Playback and one recording-relative clock

Status: in progress — reconciled November 22, 2026. Implementation, review fixes and focused first-Play/import-preparation responsiveness work verified automatically;
physical synchronization and full device/performance acceptance remain pending.

## Objective and dependencies

Implement milestone 2 of the [stereo mix visualizer roadmap](2026-11-16-stereo-mix-visualizer-roadmap.md):
play/pause, seek, loop, a waveform overview, and synchronized sample-indexed
inspection of one imported recording. A timed impulse/tone fixture must demonstrate
alignment through pause, seek, loop, and natural end on a declared device/browser.

Depends on completed [Task 005](2026-11-16-task-005-local-song-inspection.md),
decisions 001–005, and the existing reusable spectral analyzer. Later frequency
zoom/loop-region selection, workers/caches, measurement overlays, issue markers,
and final 2D/3D presentation remain separate roadmap milestones.

## Inspected baseline and constraints

- `src/browser/import-audio.ts` accepts local RIFF WAV, caps encoded input at
  64 MiB and decoded duration at 300 seconds, decodes with a 48 kHz offline
  context, and copies mono/stereo channels into validated session-owned PCM.
  Native decoder allocation precedes duration/channel guards. Preserve these limits.
- `src/import-session.ts` serializes read/decode/prepare/measure work, keeps only
  the latest pending request, and suppresses obsolete publication by generation.
  It currently owns no external resource requiring asynchronous disposal.
- `src/ImportedSong.tsx` currently retains only filename and `SongInspection` in
  `LoadedSong`; PCM is borrowed inside the inspection closure. `SongResults`
  owns a separate numeric/slider window-start cursor. There is no playback context,
  transport, waveform, or moving clock. Playback needs an explicit session owner
  that retains PCM, rather than exposing PCM through the measurement results.
- `src/song-inspection.ts` measures once and creates one analyzer when N >= 8192.
  `inspect(t)` uses `min(floor(t * fs), N - 8192)` for finite nonnegative seconds,
  with overflow-safe clamping. Short recordings have measurements but no spectrum.
  Returned bands are independent of source/workspace arrays.
- `src/audio/timeline.ts` emits only fitting hop-grid windows, discards incomplete
  tails, and never appends an off-grid last window. Selected-window inspection
  deliberately has a different, already documented final-window policy.
- Existing tests cover analytic independent stereo tones, silence, over-range
  samples, time boundaries, input/result ownership, malformed inputs, and import
  cancellation/replacement/disposal. The import browser harness exercises actual
  decoding and React at 1200px/320px, but does not establish audible playback sync.
- Task 005 records macOS Chrome automated results and owner-reported manual QA,
  not new evidence from this planning session. Its five-minute workload reported
  roughly half a second of synchronous setup; additional scans/copies need measurement.
  Initial Git status contains pre-existing untracked `soundscape/`; preserve it.

DSP remains pure TypeScript under `src/audio/`. Preserve planar mono/stereo
left/right order, stable borrowed buffers, caller-owned results, finite over-range
samples without normalization/clipping, existing TypeError/RangeError distinctions,
Hann/bin-power definitions, and explicit numerical tolerances. Whole-record
peak/RMS/mean-square values remain static summaries, never labeled live meters.

## Product decisions and exclusions

Routine assumptions below bound this milestone; no owner decision blocks planning.

- One local recording, normal speed (rate 1), no autoplay. Play is an explicit
  user gesture; pause retains position. Seek spans [0, N/fs], snaps down to a
  decoded sample boundary, and retains playing/paused intent. Exact end is a
  sentinel at sample N. Seeking to end stops; Play from end restarts at zero.
- Loop is a labeled whole-record toggle, initially off. Use the audio engine's
  native loop scheduling, never animation callbacks to restart sound. Region
  editing and loop selection belong to roadmap milestone 3. Toggling loop during
  playback preserves position; enabling at end leaves the song stopped until Play.
- Replace Task 005's independent UI cursor with the shared seek position. Paused
  seeking remains useful inspection. A waveform click seeks; a native range and
  numeric seconds control provide equivalent keyboard access. No second advancing
  inspection clock or follow/free mode is introduced.
- Keep the original demos and measurement tables. Add a compact per-channel
  waveform overview with labeled recording-relative seconds and a distinct
  playhead. No frequency view redesign, dB display, new metrics, effects, mono
  audition, source-file changes, dependencies, uploads, persistence, workers,
  streaming, AudioWorklet, or playback-rate control.
- Playback uses copied decoded PCM at its declared rate; a device context may
  render at another rate. That conversion must not redefine recording time or
  modify analysis PCM. Output gain starts at unity; no automatic normalization.
  Document that device reproduction of over-range PCM is not a measurement of
  stored sample peak or a guarantee of unclipped output.
- Pause when the document becomes hidden or the context becomes suspended or
  interrupted; require explicit Play to resume. This bounds background animation
  and stale-clock behavior. Unsupported playback/resume failures leave inspection
  usable with an actionable error, rather than discarding a successfully imported song.

## Proposed components, interfaces, and ownership

Exact exported type names may follow local style; retain these responsibilities.

1. `src/playback-clock.ts` plus tests: browser-independent transport arithmetic.
   Operates on decoded sample rate/count, context-time anchors, and optional
   whole-record wrapping. Computes snapshots containing transport status,
   recording seconds/sample position, and timing quality. Wrong argument types
   throw TypeError; nonfinite, negative, or out-of-bounds numbers throw RangeError.
   UI validation presents errors without invoking the transport with invalid text.
2. `src/browser/song-playback.ts` plus tests: `createSongPlayback(pcm)` exposing
   `play(): Promise<void>`, `pause()`, `seek(seconds)`, `setLoop(enabled)`,
   `snapshot()`, and idempotent `dispose()`. The browser adapter owns context,
   one copied AudioBuffer, source nodes, event listeners, and async command identity.
   Create/resume the context in the Play gesture; allocate/copy the playback buffer
   once per recording, not once per seek. Each restart uses a fresh one-shot source;
   stop/disconnect the old one and ignore its stale `ended` event. Never transfer,
   mutate, or expose session PCM or playback buffer channel storage.
3. `src/song-session.ts` plus focused lifecycle tests: cohesive owner of filename,
   stable PCM, inspection, waveform summary, and lazily initialized playback.
   Dispose invalidates pending Play/resume work, stops sound, cancels subscriptions,
   disconnects sources, closes its context, and drops references. Resource creation
   must not happen in React render. Keep at most one live playback session during
   replacement, including React effect setup/cleanup replay.
4. `src/waveform-overview.ts` plus tests: pure PCM-to-min/max projection, outside
   DSP APIs. For B=min(N,2048), bucket b is
   `[floor(b*N/B), floor((b+1)*N/B))`; scan each channel independently. Return
   caller-owned min/max arrays with sample extents, retaining no source references.
   Covers every sample including the final tail. At stereo Float32 min/max storage
   is at most 32,768 bytes. Silence is exact zero; preserve over-range extrema.
   The React renderer uses a labeled amplitude scale accommodating actual extrema.
5. `src/ImportedSong.tsx`, optional cohesive `src/SongTransport.tsx` and
   `src/WaveformOverview.tsx`, `src/demo.css`: session-owned controls, responsive
   overview, visible time/playhead and current analysis interval. Each UI tick
   reads one snapshot for all displays. Use requestAnimationFrame for painting,
   not audio scheduling; bound spectral table refresh to at most 15 Hz, skipping
   duplicate offsets and recomputing immediately for settled seeks. Label analysis
   interval/update age so a throttled table cannot imply sample-instant measurement.
6. Keep `createSongInspection`'s public behavior and all audio APIs unchanged.
   Pass the shared time to `inspect`; do not consume the timeline iterator to seek.
   Extend `src/import-session.ts` only if needed to dispose a constructed obsolete
   result before publication. Preserve its existing serialized import semantics.

An explicit session owner disposes old playback immediately when replacement
starts, before waiting for decode. Unmount and cancel invalidate queued resume
promises as well as imports. An obsolete session constructed during preparation
must be disposed even when the import controller suppresses publication. Source
callbacks and async failures carry session/command identity and cannot publish
into a new song. Closed/disposed transports never restart.

The existing PCM copy can occupy 115,200,000 bytes for five-minute 48 kHz stereo;
one playback copy adds the same nominal channel storage. This is arithmetic, not
a measured native-memory ceiling. Release decode intermediates; do not retain a
second playback copy or full-spectrum history. Keep summary preparation within
the serialized import pipeline with a paint opportunity and generation checks.

## Clock, latency, and analysis semantics

- For a source starting at context time c0 and decoded offset p0 seconds, the
  unlooped position is `p0 + (c-c0)` at rate 1, clamped to [0,N/fs]. Before c0
  hold p0. In loop mode wrap elapsed recording time modulo N/fs; do not accumulate
  animation deltas. Quantize derived sample positions only after bounding time.
- Prefer valid `getOutputTimestamp()` mapping: extrapolate its contextTime using
  `(performance.now()-performanceTime)/1000` while running, bounded by current
  context time and active segment boundaries. Reject initial zero/unusable or
  stale timestamps; do not extrapolate a suspended context. No latency subtraction
  is added to this output-device estimate. See the specification below.
- When unavailable/unusable, use context time and clearly identify timing as
  uncompensated. Do not silently claim output synchronization or guess a device
  delay from currentTime minus timestamp. Show timing quality in the UI/QA record.
- Pause/seek/restart/loop changes are context-time segment boundaries. Account for
  the old audio still queued to the output: retain the preceding mapping until
  the estimated output time crosses the boundary, then adopt the new anchor.
  Requested seek values may show as pending controls, but waveform playhead and
  analysis use the same output snapshot. Coalesce rapid pending edits and bound
  retained segments; if timing history is lost, mark timing unconfirmed until a
  fresh anchor is established rather than extrapolating across a discontinuity.
  On pause, settle at the stopped source position after output drainage; on end,
  settle at N rather than letting `ended` event timing reset the playhead early.
- Playback position is distinct from analysis support. For L=8192 and N>=L,
  display the existing full window starting at
  `s=min(floor(t*fs),N-L)`: start s/fs, center (s+L/2)/fs, end-exclusive (s+L)/fs.
  Show all three semantics or explicit interval plus center. At 48 kHz its
  duration is 8192/48000 seconds (about 170.667 ms), not a synchronization error.
  Near end the start clamps backwards; at end display [N-L,N), without padding
  or claiming a partial frame. Loop windows never wrap across the seam. N<L
  remains playable with waveform/metadata but no spectral window. N=L always
  shows the same full window. Timeline hop/tail semantics remain unchanged.

## Acceptance criteria and meaningful tests

1. **Transport arithmetic:** deterministic injected clock tests cover start,
   pause/resume, fractional sample seek, exact end/replay, loop boundary and many
   wraps, loop toggles, different device/PCM rates, invalid input, stale timestamps,
   and queued transitions. Integer command sample indices are exact; derived
   continuous times use absolute tolerance 1e-9 seconds for bounded test fixtures.
   Tests derive positions from known anchors, not another transport API.
2. **Resource/lifecycle:** controlled deferred resume and source-ended tests cover
   rapid Play/pause/seek, A→B replacement, cancellation, failed resume/retry,
   interruption, hidden tab, and unmount/effect replay. No duplicate audible source,
   stale UI publication, restarted disposed context, or surviving animation/listener.
   Copy tests preserve source bytes, channel order, and finite values outside ±1.
3. **Waveform:** analytically specified silence, signed extrema, L-only/R-only,
   unequal channels, single-sample input, N<B, nondivisible buckets, and impulses
   exactly on bucket boundaries/final sample prove full coverage with no omissions
   or channel mixing. Compare stored extrema exactly to selected Float32 values;
   returned-summary mutation cannot affect PCM or later results.
4. **Analysis mapping:** verify time zero, fractional time, N=L, N<L, final tail,
   end, seek, and loop seam against explicit sample indices. Changing bin-aligned
   tones at known boundaries proves content follows the selected window. Retain
   existing independent expectations (A²/2 band power, zero in other bands),
   1e-7 absolute power and 1e-6 peak/RMS fixture tolerances; silence is exact zero.
   At transition-crossing windows use independent window-weighted expectations
   or test fully contained windows; do not apply full-tone identities blindly.
5. **Actual browser audio:** generated low-level timed impulses and tone bursts
   with distinct left/right activity exercise the real source graph. Offline
   rendering checks start offsets, channel order, loop seam, stop and restart
   samples at matched rate (within one sample for scheduling; amplitude <=1e-7
   absolute for representable direct-copy fixtures). A different context rate
   checks duration/alignment without demanding bitwise resampler identity.
   Real-time UI checks require a genuine activation path; do not enable autoplay
   bypass and count it as gesture-policy evidence. Mocks/offline rendering alone
   cannot establish audible-output-to-screen synchronization.
6. **Measured synchronization gate:** first run a bounded foreground desktop
   calibration on named macOS Chrome/version, OS/device, refresh rate, and built-in
   or wired output. Record timestamp availability, device context rate, and output
   route. Proposed target: absolute playhead-to-audible-event error <=50 ms for
   each of at least 20 timed events across ordinary play, resume, seek, loop, and
   end; no cumulative drift in a five-minute run. Measure using synchronized
   audio/visual capture or loopback plus frame timestamps, stating instrument
   uncertainty and reporting max/median error and dropped frames. Register the
   final tolerance from calibration before completion QA; do not relax it after
   a failing run without recording the reason and scope decision. If measurement
   is unavailable, the sync gate stays unverified. Uncompensated fallback and
   Bluetooth/device changes need separate evidence and cannot inherit this claim.
7. **Usable UI:** desktop and 320 CSS px, pointer and keyboard: import → Play →
   pause → seek by input/range/waveform → loop → end/replay → replace. Verify
   invalid/empty numeric text, short audio, loading/cancel, playback error/retry,
   focus retention, reduced motion, and interruption/hidden-tab resume. Controls
   are labeled/disabled appropriately; waveform has non-color time/channel cues
   and equivalent native controls. Announce status/errors, not every clock tick.
8. **Bounded workload:** repeat Task 005's generated five-minute stereo workload
   on the named target. Record waveform build, first Play allocation/copy, seek
   response, analysis/update cost, frames dropped, and observable memory before,
   during, after replacement/disposal. Verify one playback copy and compact
   summaries; distinguish JS heap from native allocations. If added synchronous
   work blocks controls or fails synchronization, record a blocker and evaluate
   the smallest remedy; workers are a separate scope decision, not implicit work.

## Implementation steps

- [ ] Establish real-time timestamp/capture feasibility and calibrate the sync
  budget on the declared target; record evidence and any measurement blocker.
- [x] Implement/test pure clock mapping and waveform summary independently.
- [x] Implement/test the browser playback adapter, one-buffer ownership, command
  invalidation, interruption policy, and output-transition handling.
- [x] Introduce the session owner and integrate import/replacement/disposal;
  preserve existing import regressions and short-audio inspection behavior.
- [x] Connect accessible transport, overview, and band table to one snapshot;
  verify sample-window mapping and bounded analysis refresh.
- [ ] Extend browser fixtures/harness; execute audio graph, UI, synchronization,
  viewport/keyboard, and five-minute workload checks. Automated graph/UI/workload
  checks delivered; physical capture and remaining device gates stay open below.
- [x] Update README, Product, Architecture, and decision 006; perform author self-review.
- [ ] Complete physical synchronization and remaining device/performance acceptance.

## Verification commands and evidence status

Run from repository root during implementation:

```sh
npm ci
npm test
npm run typecheck
npm run build
git diff --check
npm run test:browser
SMOKE_ENTRY=import npm run test:browser
SMOKE_ENTRY=playback npm run test:browser
```

Use `npm ci --cache /tmp/soundscape-npm-cache` if the default cache is unwritable;
set `CHROMIUM` to the installed executable when needed. The implemented
`scripts/browser-smoke.mjs` selector runs `scripts/playback-browser.ts` with
`SMOKE_ENTRY=playback npm run test:browser`; spectral/import entries remain available.
No lint script exists. Browser automation must record whether it used a real
audio device or virtual sink; neither automated DOM checks nor screenshots prove
physical output sync. Use `npm run dev` for manual listening/capture and keyboard
QA. No spectral-engine benchmark is required when its implementation is unchanged.

Planning-session baseline results below predate implementation and cannot establish
feature correctness. Implementation-session results follow separately.

Planning-session baseline checks (November 18, 2026):

- `npm ci --cache /private/tmp/soundscape-npm-cache --offline`: passed,
  100 packages installed; audit reported zero vulnerabilities.
- `npm test`: passed, 532 tests across eight files.
- `npm run typecheck`: passed.
- `npm run build`: passed, including typecheck and Vite bundling.
- `git diff --check`: passed; checked the new untracked plan separately with
  `git diff --no-index --check /dev/null docs/plans/2026-11-18-task-006-playback-shared-clock.md`.
- Local Markdown link existence check: passed. Source inspection and plan
  consistency review completed; no application code changed.
- Browser, manual listening/keyboard, synchronization capture, and workload
  checks were not run for this planning-only task.

## Sources and reasoning limits

- [Web Audio Recommendation, AudioBufferSourceNode](https://www.w3.org/TR/2021/REC-webaudio-20210617/#AudioBufferSourceNode):
  source start/stop, offset, rate, and loop contracts; fresh nodes for restarts.
- [Web Audio 1.1, getOutputTimestamp](https://www.w3.org/TR/webaudio/#dom-audiocontext-getoutputtimestamp):
  output context/performance time pairing, initial zero timestamps, and warning
  against treating currentTime minus contextTime as a reliable latency estimate.
  The extrapolation/segment policy above is proposed application logic.
- [Web Audio Recommendation, AudioBuffer](https://www.w3.org/TR/2021/REC-webaudio-20210617/#AudioBuffer):
  copied channel storage and sample-rate metadata at the playback boundary.
- Existing decisions [001](../decisions/001-audio-measurement.md),
  [002](../decisions/002-spectral-analysis.md),
  [003](../decisions/003-spectral-engine-hardening.md),
  [004](../decisions/004-time-indexed-analysis.md), and
  [005](../decisions/005-local-song-import.md) remain authoritative.

No borrowed implementation, new DSP algorithm, measured synchronization result,
or cross-device performance guarantee is claimed by this plan.

## Progress and next steps

- [x] Read roadmap, Task 005 plan, maintained context, decisions, implementation,
  callers, and tests. Confirmed milestone scope and identified session ownership gap.
- [x] Save separate Task 006 plan with contracts, acceptance gates, and ordered slices.
- [x] Implementation authorized and delivered; clock, waveform, playback adapter and session/UI integration verified automatically.
- Calibration blocker: this session has no synchronized physical audio/visual capture or
  verified built-in/wired output route and refresh rate. Do not infer physical sync
  from browser timestamps. Proposed 50 ms budget remains provisional/unverified.
- `npm ci --cache /private/tmp/soundscape-npm-cache --offline`: passed (100 packages, zero audit vulnerabilities).
- Initial implementation tests: 547 passed in 11 files. Further QA pending.

## Implementation results — November 18, 2026

Implemented `playback-clock.ts`, independent waveform summaries, the browser adapter,
explicit song-session ownership, import release callbacks, transport/overview UI and
one-snapshot analysis selection. Native sources loop without animation scheduling;
one playback buffer is copied lazily. Disposed/pending commands cannot start stale
sources. Queued transitions retain old output mappings, and ended events do not
reset output position. Timing quality, window interval/center/age and static
whole-record measurements are explicit.

One justified interface addition: `SongInspection.inspectSample(sample)` preserves
exact transport sample anchors without a floating-point seconds round trip.
For example, `(27 / 48000) * 48000` falls just below 27. The existing public
`inspect(seconds)` behavior and all DSP APIs/definitions remain unchanged.

### Actual commands and checks

- `npm ci --cache /private/tmp/soundscape-npm-cache --offline`: passed, 100 packages,
  zero audit vulnerabilities. No dependencies/lockfile changes.
- Final `npm test`: passed, **555 tests in 12 files**.
- Final `npm run typecheck`: passed.
- Final `npm run build`: passed (typecheck and Vite production bundle).
- `git diff --check`: passed. New untracked task files also checked separately.
- `CHROMIUM='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:browser`:
  passed, existing spectral/timeline regression entry.
- Same Chrome with `SMOKE_ENTRY=import`: passed, PCM16/24 mono/stereo, resampling,
  corrupt/unsupported files, real UI numeric/range, cancel/retry, short audio and
  320px checks. Five-minute UI import observed 1154.5 ms in that run.
- Same Chrome with `SMOKE_ENTRY=playback`: passed after final source changes.
  Matched-rate actual offline graph verified every output sample for offset, stop,
  restart, loop seams and independent L/R impulses/burst, absolute amplitude error
  <=1e-7. Resampled impulse alignment and duration edges at 44.1 kHz were
  within one sample; native copies preserved finite over-range PCM.
  Trusted CDP pointer activation exercised Play without an autoplay bypass.
  Numeric/range/waveform seek, loop, natural/exact end/replay, injected resume
  error/retry, keyboard range/loop, focus retention, short audio, replacement while
  playing, and 1200px/320px page bounds passed. Screenshots visually inspected.
  Instrumented actual React StrictMode replay/unmount left one adapter/context,
  no surviving visibility listener or animation; late resume created no source/UI.
- Deterministic tests cover deferred resume, pause/dispose/hidden invalidation,
  interruption, rapid Play/pause/Play, stale ended callbacks, queued output seek/
  pause drainage, end-before-ended replay, exact sample anchors, history loss,
  timestamp fallbacks, many loop wraps, extreme representability, waveform
  ownership/extrema/tails, obsolete import release, and analytic selected content.
- No lint script exists. Spectral benchmark not run (DSP unchanged).

The initial sandboxed browser launch failed with localhost `listen EPERM`;
checks succeeded with reviewed permission to run the local server/Chrome.
During harness development, the resampling oracle incorrectly compared the global
peak of multiple impulses (resampling splits the central peak across samples);
an isolated-impulse oracle fixed that without loosening tolerance. Driver viewport,
trusted-event observation order, cross-realm injected Error and moving-window seek
assertions were corrected. An intermittent driver timeout occurred during early
runs; four complete playback runs subsequently passed, including final lifecycle/duration checks. These failures are not
claimed as passing checks.

### Measured workload and limits

Target observed: MacBook Air Mac15,12 / Apple M3 / 8 cores / 8 GB, macOS 14.5
(23F79), Chrome 157.0.8103.79, Node v24.4.0. Runs were **headless**, not a calibrated
foreground physical display. Device context reported 48000 Hz and nonzero output
timestamps. OS-reported output devices were absent from this session's inventory;
physical route and refresh rate are unverified. Neither timestamps nor successful
trusted activation establish audible output or a genuine physical-device sync gate.

[Raw workload observations](../benchmarks/task-006-playback.json) retain four passing
runs. Final isolated five-minute zero-filled stereo preparation measured waveform
200.8 ms, playback validation/allocation/copy 171.1 ms, inspection setup 501.2 ms,
and 100 analysis calls 27.5 ms. The final UI low-level burst fixture import measured
1303.5 ms, first Play through driver 293.7 ms, and seek through DOM observation
86.1 ms. The first passing run observed 1281 / 312.2 / 87.3 ms respectively.
One earlier browser startup overlapped unit/typecheck/build commands; host load/JIT/GC and
polling affect results. No throughput, latency ceiling or performance gate is claimed.

Nominal PCM and playback storage are each 115,200,000 bytes, with 32,768 extrema
bytes. Final process-wide JS heap observations were 14,537,141 before the synthetic
workload, 134,249,232 during, 355,596,967 during UI playback and 356,170,221 after
replacement. Synthetic fixtures still existed during this observation and GC was
not forced. These numbers do not measure native audio storage, reclamation, peak
memory or per-session retention. One-copy reuse is covered by controlled tests,
not inferred from heap snapshots.

Added synchronous summary/copy work occupies the main thread for roughly 0.17–0.20
seconds on this workload; this is a responsiveness blocker to close before claiming
full bounded-workload acceptance. The smallest candidate remedy is incremental
summary/validation/copy preparation with task yields and command invalidation,
retaining one buffer and serialized import semantics. Evaluate that against actual
foreground interaction measurements; workers remain a separate scope decision.
Existing whole-record measurement/analyzer setup also stays synchronous.

### Author self-review

Reviewed tracked diff and every new source/test/harness/doc file, with surrounding
import, inspection, analyzer, PCM, bands and timeline consumers. Found/fixed ended
intent restarting a seek, replay before delayed ended notification, loss of snapped
sample indices, stale Play UI completion, and overflow before clamp/wrap. Regression
checks passed after fixes. No remaining demonstrated numerical/ownership regression
was found. This is author self-review, not independent review or proof of correctness.
No unrelated `soundscape/` files changed; no push or merge occurred.

### Remaining work / resumption

- Calibrate the proposed <=50 ms budget on a verified built-in/wired route and
  foreground physical display, register tolerance, then capture >=20 events across
  play/resume/seek/loop/end with uncertainty/max/median and five-minute drift.
  Calibration is unavailable here; the sync gate remains **unverified**, not passed.
- Measure dropped frames, foreground interaction during long preparation/first Play,
  and native memory before/during/after disposal. Evaluate incremental preparation
  for the observed synchronous stalls. The bounded-workload gate remains open.
- Finish manual listening, full keyboard/screen-reader and reduced-motion QA, actual
  hidden-tab/device interruption behavior. Controlled/instrumented lifecycle tests do not
  substitute for all real device/browser lifecycle checks.
- Bluetooth, other browsers, device changes and uncompensated fallback need separate
  evidence. No scope decision or permission is needed for the implemented code;
  remaining empirical gates require capture/device access. Do not mark Task 006
  completed or claim synchronization/performance acceptance from automated success.

## Review fixes — November 20, 2026

Addressed the four findings from the Task 006 build review:

- Retire the previous source before awaiting replay resume. A saved delayed
  `ended` callback can no longer clear the newer replay's intent.
- Loop changes preserve a pending Play's prepared position/sample anchor while
  updating the clock's existing segment separately. Replay from end stays at zero;
  a seek during pending resume keeps its selected sample.
- The pointer smoke check now starts at sample 12,000 and clicks the midpoint of
  the two-second, 48 kHz fixture. Both playhead and analysis offset must change to
  independently expected sample 48,000.
- Corrected the verification instructions to use the implemented playback selector.

Verification:

- Added regression tests first; both reported replay cases failed against the
  prior adapter. All three added cases pass after the fixes, including pending seek.
  The delayed-ended test observes the new clock boundary after queued output drains.
- `npm ci --cache /private/tmp/soundscape-npm-cache --offline`: passed, 100 packages,
  zero reported vulnerabilities; dependencies and lockfile unchanged.
- `npm test`: passed, **558 tests across 12 files**.
- `npm run typecheck`, `npm run build`, and `git diff --check`: passed.
  The four changed untracked files were also checked separately for whitespace.
- `CHROMIUM='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' SMOKE_ENTRY=playback npm run test:browser`:
  passed in HeadlessChrome 157, including the corrected pointer assertion and
  existing offline audio, UI, keyboard, replacement and StrictMode checks.
  The initial sandboxed attempt failed with localhost `listen EPERM`; the permitted
  run outside that restriction passed.
- Negative control: temporarily blocking waveform click propagation caused the
  corrected assertion to fail, with playhead and analysis remaining at 12,000.
  The temporary harness change was restored byte-for-byte afterward.
- Author self-review covered these four changed files and surrounding clock,
  transport, waveform and session callers; no additional demonstrated defect found.
  Existing unrelated working-tree changes and `soundscape/` were preserved.

These fixes close the reported replay and pointer-evidence defects. Task 006 remains
in progress: physical synchronization, foreground responsiveness/dropped frames,
native memory/reclamation, and the remaining manual/device checks above are still
open. Spectral/import browser entries were not rerun in this focused follow-up;
their earlier results remain historical. No new physical or manual QA is claimed.

## Foreground responsiveness follow-up — November 20, 2026

Preserved the existing working tree, including prior Task 006 implementation/review
fixes and the unrelated `soundscape/` directory. The scoped application change is
in the playback adapter; DSP, import preparation, waveform and public inspection
behavior are unchanged. Updated this plan, decision 006, README and Architecture.

### Reproduction and focused remedy

Added `scripts/responsiveness-browser.ts` and the `responsiveness` smoke selector.
Run with installed Chrome and `CHROMIUM_HEADLESS=0`. Headed Chrome is brought to
front; the final run asserts both documents visible and transient activation at
Play, and records focus. A separate driver dispatches trusted probe clicks every
20 ms while app JavaScript may be blocked. It records click timestamp-to-handler
delay, 10 ms timer gaps and requestAnimationFrame gaps. Five-minute stereo WAV
fixture generation occurs before observation. First Play is invoked by button.click()
inside the trusted probe handler; direct trusted Play is independently checked by
the playback suite. No autoplay-policy bypass is enabled.

Initial foreground reproduction: import/preparation took 1027.9 ms, with maximum
click delay 645.1 ms, timer gap 667.5 ms and frame-callback gap 633.3 ms. First Play
took 365.3 ms, with maximum click delay 326.7 ms and frame gap 332.4 ms. These
measurements confirmed the documented interaction blocker before changing app code.

Implemented the smallest isolated remedy for the added playback-copy work:
validate/copy 262,144 frames per channel per task, with task yields between chunks,
into one unpublished AudioBuffer. Initial shape and all sample finiteness checks
remain intentional validation; samples/order/over-range values are preserved.
A partially filled buffer never starts. Pending Play commands share preparation;
pause/hidden invalidate start while preparation may finish for reuse. Seek/loop
commands retain the latest intent. Disposal stops further chunks at the next task
boundary and prevents publication. No dependency, worker, new PCM copy or DSP
change was introduced. Native context construction/allocation remain synchronous.

An exploratory 65,536-frame version increased total first Play to 3176.9 ms and
observed a 1287.3 ms click delay; this is retained as an unsuccessful observation,
not omitted or claimed as a pass. Subsequent instrumentation separated native
context construction/allocation/copy/start. The larger final chunk size reduces
yield overhead while still providing interaction opportunities.

[Raw observations and method limits](../benchmarks/task-006-responsiveness.json)
retain all eight runs, including exploratory results and the synchronous control.
In the instrumented control, clicks timestamped **after context construction**
were delayed by up to 149.8 ms. Final chunked runs observed 6.6 ms and 5.2 ms for
that subset. Maximum post-context frame gaps were 17.7 ms in both final runs;
timer gaps were 28.0 / 42.9 ms. Post-context frame/timer subsets exclude intervals
starting before constructor return; overall first-Play gaps retain that stall.

The tradeoff is longer time until playback: control first Play 398.8 ms versus
835.9 / 950.4 ms in the two final chunked runs (10 ms polling applies). Overall
first-Play click delays were still 255.8 / 196.8 ms, and native AudioContext
construction occupied 266.6 / 211.7 ms. Native buffer allocation measured 0.1 ms
and source start rounded to 0 ms in these runs. Import/preparation still delayed
clicks by 657.6 / 630.5 ms. This supports the **post-context copy responsiveness
improvement only**; it does not close full foreground responsiveness acceptance
or establish a latency ceiling. Runs are small, sequential, environment-specific
samples with variable startup/JIT/GC/host load.

Target: headed Google Chrome 157.0.8103.79, macOS 14.5 (23F79), Node v24.4.0;
Chrome version and OS rechecked. Earlier device inventory is MacBook Air Mac15,12,
M3/8 GB (not re-inventoried). Final run reported visible documents, active focus
and active transient user activation. Physical refresh rate/output route remain
unverified. Callback gaps are **not** measured physical dropped frames.

### Verification and author self-review

- `npm ci --cache /private/tmp/soundscape-npm-cache --offline`: passed, 100 packages,
  zero reported vulnerabilities; no dependency/lockfile changes.
- Final `npm test`: passed, **564 tests across 12 files**. New tests cover chunk
  boundaries/final sample, stereo/over-range preservation, one allocation across
  overlapping Play commands, seek/loop during preparation, pause/hidden/disposal,
  invalid late samples and interruption during preparation.
- Author self-review using soundscape-review found that suspension followed by
  running while copying could otherwise start audio without another Play. Added
  a regression that failed first (source creation was observed), then made context
  state changes invalidate pending Play as well as active sources. The full suite
  passed after that fix. No remaining demonstrated regression found in the
  changed adapter, tests, driver, probe and their session/transport callers.
- `npm run typecheck`: passed; final `npm run build` also passed with typecheck.
- Headed responsiveness entry: passed initial reproduction and follow-up runs;
  final probe confirms visibility/focus/activation. The synchronous control
  temporarily used the original copy call; chunked source was restored afterward.
- `CHROMIUM='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' SMOKE_ENTRY=playback npm run test:browser`:
  passed again after the final interruption guard, including actual offline graph,
  direct trusted Play, numeric/range/waveform seek, loop/end/replay, error/retry,
  keyboard controls, 1200/320px bounds, replacement and StrictMode/unmount checks.
  This run is headless and does not establish physical output or manual acceptance.
- `git diff --check`: passed; all 16 untracked task files were separately checked
  for whitespace (unrelated `soundscape/` excluded). Relative links in the four
  updated documents were checked and exist.
- The first sandboxed responsiveness launch failed with localhost `listen EPERM`;
  reviewed local-server/Chrome runs succeeded. The exploratory slow chunk result
  and intentional failing regression are reported above, not counted as passes.
- No lint script exists. Spectral/import browser entries were not rerun in this
  focused adapter change; earlier evidence remains historical. Manual/device QA,
  native-memory measurements and physical synchronization were not performed.

### Remaining gates after the first-Play follow-up

Task 006 stays **in progress**. Do not infer full acceptance from these checks.

- **Foreground responsiveness:** profile the remaining import copy/validation,
  measurement/analyzer and waveform passes independently before the next bounded
  remedy. Native gesture-time context startup remains an observed first-Play stall.
  The cooperative playback copy is one addressed contributor, not the whole gate.
- **Physical synchronization:** verify built-in/wired route and foreground display,
  calibrate/register the provisional <=50 ms tolerance, capture >=20 timed events
  across play/resume/seek/loop/end with instrument uncertainty/max/median, and
  check five-minute drift. No calibrated tolerance or physical sync evidence exists.
- **Memory:** measure native storage and peak/reclamation before/during/after
  replacement/disposal. Nominal one-copy arithmetic and process-wide JS heap are
  insufficient; no new memory acceptance claim is made here.
- **Manual/device:** finish listening, full keyboard/screen-reader/reduced-motion,
  actual hidden-tab/interruption and device-route checks. Callback gaps do not
  close dropped-frame acceptance. Bluetooth/other browsers/fallback need separate
  evidence. Workers remain a separate scope decision. No push or merge occurred.


## November 20 follow-up — import-preparation responsiveness

Status: focused build verified automatically; **Task 006 remains in progress**.
All pre-existing tracked/untracked work, including unrelated `soundscape/`, was
preserved. No workers, dependencies, extra PCM copies, push or merge were added.

### Reproduction and separate phase measurements

Ran the existing headed foreground harness on macOS 14.5 (23F79), arm64,
Chrome 157.0.0.0, with the same generated five-minute 48 kHz stereo PCM16 WAV
(57,600,044 encoded bytes). Fixture generation is excluded. CDP pointer events
arrive every 20 ms, timers every 10 ms; rAF gaps are callback observations.
Visibility, focus and transient activation were present in the recorded runs.
Physical output route, refresh rate, audible alignment and native memory were
not measured. Local Vite/Chrome needed sandbox escalation after `listen EPERM`;
the reviewed runs succeeded. This was a sandbox restriction, not a test failure.

Added responsiveness-only Vite profiling transforms; production code contains no
profiling hooks. They time decoded channel copying, each full validation call,
whole-record measurement, analyzer factory and waveform factory independently.
Nested validation is subtracted from enclosing totals to isolate arithmetic/setup;
these nested timings must not be added twice. Incremental measurement timing sums
active `next()` calls, excluding task waits. The first run includes initial demo
marks before the copy; those are excluded from phase comparisons. Later runs
clear marks before import.

Across three baseline trials, import elapsed 1,075.5–1,094.5 ms (median 1,075.8),
maximum click delay 632.3–667.9 ms (median 639.7), maximum timer gap median
667.1 ms and maximum rAF gap median 633.4 ms. Each had two rAF gaps >50 ms.
The foreground stall was reproduced before changing preparation behavior.

Baseline phase medians, in milliseconds:

- Decoded channel copying: 17.3 total for both channels.
- Full validation: copy boundary 162.1, measurement boundary 148.7, analyzer
  boundary 147.5, waveform boundary 146.6. Repeated validation was largest.
- Whole-record measurement: 332.9 including validation; arithmetic alone 184.2.
- Analyzer construction: 149.0 including validation; workspace setup alone 1.5.
- Waveform: 164.7 including validation; extrema generation alone 18.1.

### Bounded remedy and experiments

1. Replaced typed-array iterator traversal in shared validation with indexed
   traversal. All boundary checks/error classes and finiteness scans remain.
   Validation-only experiment: 583.1 ms import, 260.5 ms maximum click delay.
   This reduced the largest contributor but left an unacceptable visible stall.
2. Added pure `measureAudioSteps`: validates on first advancement, captures
   metadata/channel references, accumulates peak/sum of squares in original sample
   order in <=262,144-sample arithmetic chunks, and returns only completed results.
   `measureAudio` and `createSongInspection` synchronously drain the same steps,
   preserving their APIs. No per-chunk partial sums, tolerance changes, validation
   bypass, normalization, input mutation or additional PCM copy.
3. Tried yielding a timer after every arithmetic step: max click delay 33.9 ms,
   but import took 1,208.5 ms, worse than baseline. Rejected that scheduling policy
   because timer overhead dominated despite lower active arithmetic cost.
4. Final session preparation batches arithmetic steps under a soft 4 ms budget,
   then yields a browser task. Generation is checked before advancing and after
   every task yield; abandoned iterators close. Analyzer completion yields before
   waveform generation. Existing controller still serializes decode/preparation,
   coalesces pending replacements, releases obsolete/ready sessions, and publishes
   only a complete current session. Stable session-owned PCM stays private.
5. Evaluated the smaller alternative with both optimized loops but fully
   synchronous session preparation: 366.6 ms import, 82.4 ms max click delay,
   105.2 ms timer gap, 68.1 ms rAF gap. Cooperative preparation costs about 36 ms
   against this single-trial alternative (using final median), while giving more
   frequent interaction opportunities. The loop changes account for much of the
   total speed improvement; yields alone do not make the arithmetic faster.

Final three trials: import 395.5 / 408.4 / 402.1 ms (median 402.1); max click
32.1 / 39.4 / 40.5 ms (median 39.4). Maximum timer gap median 57.3 ms and maximum
rAF gap median 33.3 ms; no observed rAF gaps >50 ms in these import trials.
These are small sequential local samples, not a randomized study, hard latency
bound, physical dropped-frame measurement or device-wide acceptance guarantee.

Final phase medians in milliseconds: copying 18.0; copy validation 26.3;
measurement validation 17.3; measurement active total 41.9 (arithmetic 24.4);
analyzer total 18.4 (validation 16.9, workspace 1.3); waveform total 36.0
(validation 16.9, extrema 19.1). Copying, full validation, analyzer setup and
waveform generation remain indivisible synchronous work. The 4 ms budget is
checked between arithmetic chunks, not a maximum duration for those phases.
A cold headless playback-suite waveform build also took 86.5 ms; remaining
phase costs can vary with JIT/workload and still need broader device acceptance.

Raw observations for every experiment and all six comparison trials:
[import-preparation evidence](../benchmarks/task-006-import-preparation.json).
The two additional baseline trials temporarily restored only this session's
changes, with automatic restoration afterward. Final source was restored before
repository/browser checks; the final synchronous experiment also restored it.

### Verification and author self-review

- `npm ci --cache /private/tmp/soundscape-npm-cache --offline`: passed, 100
  packages installed, zero audit vulnerabilities.
- `npm test`: passed, **573 tests across 12 files**. New independent fixtures
  cover chunk-boundary/final-tail extrema, stereo mean square/RMS, exact silence
  through existing tests, over-range values, unchanged source storage, invalid
  inputs, obsolete preparation and task failure. Real preparation/controller tests
  cover serialized replacement, cancel/reselect and disposal with no stale result.
- `npm run typecheck`, `npm run build`, `git diff --check`: passed. No lint script.
- Headed responsiveness: initial baseline, two repeated baselines, three final
  trials and the documented experiments passed harness checks. They establish
  foreground interaction observations, not all Task 006 acceptance criteria.
- Spectral browser entry: passed against final indexed validation/measurement.
- Import browser entry: passed actual PCM16/PCM24 mono/stereo decoding,
  resampling/rejection, React numeric/range inspection, desktop/320px, corrupt/
  retry, short audio and cancel. Five-minute real UI import measured 340.4 ms
  in that separate headless workload (not the foreground comparison fixture).
- Playback browser entry: passed real offline source graph, matched/resampled
  impulse/tone checks, trusted Play/keyboard, seek/loop/end/replay, replacement,
  short/error flows, desktop/320px and StrictMode/unmount/deferred-resume checks.
- Untracked task-file whitespace checks passed for 17 files (unrelated
  `soundscape/` excluded); changed-document local links passed and the production
  bundle contains no profiling helper. The auxiliary whitespace script initially
  treated expected `git diff --no-index` exit 1 as failure; corrected exit handling
  confirmed no whitespace errors.
- Final author self-review used `soundscape-review`: reviewed this session's
  validation/measurement/preparation diff, controller and playback callers,
  generator closure, metadata/PCM ownership, unchanged sum order, error classes,
  numerical fixtures and development-only profiling. No introduced defect found;
  this is self-review, not independent review or proof of physical acceptance.

### Remaining gates and next work

- **Native AudioContext startup is a separate unresolved issue.** Final foreground
  trials measured constructor costs 155.4 / 168.4 / 175.7 ms and first-Play max
  click delays 141.0 / 155.1 / 156.9 ms (see raw results). This import change does
  not resolve or hide that stall. First-Play latency still includes task waits.
- Import preparation is substantially improved on this fixture, but synchronous
  copying/validation/analyzer/waveform phases and cold/device variability remain.
  Recalibrate responsiveness on the declared acceptance devices before closing
  the overall performance gate. Any workers or architecture changes need a
  separate scope decision.
- Physical synchronization calibration/capture, >=20 timed events, five-minute
  drift, native-memory peak/reclamation, manual listening/accessibility/device
  routes and fallback/Bluetooth/browser acceptance remain open exactly as above.
  No tolerance was registered or acceptance inferred from automation.


## November 20 follow-up — native first-Play startup investigation

Status: diagnostic work verified; **native startup remains unresolved**. No
production playback change was justified by the measured alternatives. Task 006
remains in progress; this section does not close device acceptance.

### Scope and measured result

Investigated the brief first-Play freeze separately from the delivered import
fix. Preserved all pre-existing changes. Extended only the responsiveness harness
and its browser runner: optional constructor variants, effective context rate/
latency/output metadata, state transitions, synchronous resume-call timing,
asynchronous resume readiness, and output-switch timing. Production still creates
and resumes the default AudioContext in Play, uses the same graph, and preserves
one-copy ownership and interruption/cancellation behavior. No dependency, worker,
prewarming, routing feature, changed context rate or speculative fix was shipped.

On the same macOS 14.5 arm64 / headed Chrome 157.0.0.0 five-minute workload:

- Default constructor, three fresh-browser trials: 206.9 / 277.2 / 148.8 ms.
  First-Play maximum click delays: 191.1 / 262.5 / 132.9 ms; elapsed time until
  Playing: 622.4 / 751.9 / 633.7 ms. Each run observed one rAF gap >50 ms.
  Synchronous `resume()` calls returned in 0 ms at the timer's resolution;
  asynchronous resume readiness took 1.6 ms in the first trial. The dominant
  indivisible startup delay is inside the native constructor boundary.
- Explicit 48 kHz constructor option: 157.8 / 344.5 / 167.7 ms; maximum click
  delays 144.9 / 328.9 / 153.6 ms. It did not eliminate the stall. Both default
  and requested-rate contexts reported 48 kHz here, so fixing the rate did not
  change that measured operating rate.
- `latencyHint: 'playback'`, one exploratory trial: constructor 145.9 ms and
  max click delay 129.7 ms. Reported baseLatency increased from 5.333 to 21.333 ms.
  Rejected as a remedy: it still stalls and changes buffering without demonstrated
  responsiveness acceptance. These baseLatency values are browser metadata,
  not measurements of physical speaker delay.
- Silent-output construction plus asynchronous default-output attachment: first
  attempt timed out; instrumented repeat still took 170.8 ms in construction.
  Default attachment's call returned in 0 ms at timer resolution and its promise
  resolved in 30.9 ms. Native states were running → suspended → running. The
  existing statechange interruption policy correctly invalidated Play; no buffer
  was allocated and no source started. Rejected: it does not fix the constructor
  and adds routing/interruption behavior. The timeout is an unsuccessful
  diagnostic experiment, not a passing playback regression.

These are small local diagnostic samples, not a randomized A/B study. Repository
verification overlapped the second default/rate pair; no configuration speedup is
claimed. All successful runs recorded foreground visibility/focus/activation.
The two silent-output failures are retained, not counted as successful runs.
Raw timings, transitions and failure output are in
[native startup evidence](../benchmarks/task-006-context-startup.json).

`system_profiler SPAudioDataType` completed and reported an empty audio device
list. The harness therefore cannot establish a physical output route here.
This does **not** prove that missing devices caused the delay or that a normal
Mac has the same startup cost. It limits how far these measurements should drive
production changes. Native construction has no task-yield point in the current
adapter; moving it into import/mount would move the foreground stall and change
the Play-only resource policy, rather than demonstrate its removal.

The diagnostic output-switch experiment follows the documented empty-string
(default output), silent sink, and asynchronous routing semantics in
[Chrome's Web Audio output-device documentation](https://developer.chrome.com/blog/audiocontext-setsinkid).
No external implementation was copied. The harness keeps these overrides out of
production and makes no unsupported cross-browser routing claim.

### Reproduction and next acceptance step

On a machine with a known built-in or wired output, run:

```sh
CHROMIUM='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' CHROMIUM_HEADLESS=0 SMOKE_ENTRY=responsiveness npm run test:browser
```

The default path remains the production path. `STARTUP_VARIANT=rate`,
`STARTUP_VARIANT=playback-latency`, or `STARTUP_VARIANT=silent-switch` select
**diagnostic-only** overrides; the last currently times out because Play is
cancelled by the measured output transition. Do not treat it as a product option.
Record OS/browser version, actual output route, context constructor timing,
trusted click gaps, and first-Play total time. If the default path still stalls
on real output, investigate that browser/device startup before proposing a
separate context-lifecycle or output-routing scope change. No such change was
made here and no unsupported alternative is required for inspection/playback.

Physical audio/display synchronization, the calibrated event/drift test,
native-memory peak/reclamation, manual accessibility/listening, and other device/
browser routes remain unverified. A hardware run is the next missing evidence;
other project development can continue while this Task 006 acceptance gate stays
open.

### Verification and final review

- `npm ci --cache /private/tmp/soundscape-npm-cache --offline`: passed, 100
  packages, zero audit vulnerabilities.
- `npm test`: passed, 573 tests across 12 files.
- `npm run typecheck`, `npm run build`, `git diff --check`: passed.
- Successful headed startup diagnostics: default x3, explicit rate x3, latency
  hint x1. Silent switch failed twice as described above. No autoplay bypass.
- Final spectral, import and playback browser entries: passed. Actual decoding,
  React desktop/320px flows, cancel/retry/short input, trusted Play/keyboard,
  offline graph, replacement and StrictMode/unmount/deferred-resume checks remain
  working. These run headless and do not establish physical output acceptance.
- Final author self-review used `soundscape-review`: reviewed the diagnostic
  constructor/resume wrappers, option isolation, output-switch state transitions,
  URL parameter plumbing and production playback/controller callers. No introduced
  production defect found; unsuccessful experiments remain rejected. The browser
  wrapper adds promise reactions for timing observations, so no sub-millisecond
  resume-overhead or configuration speedup claim is made. Review is by the author,
  not independent QA.
- Local documentation links, final tracked/untracked task-file whitespace and
  production-bundle exclusion of diagnostic variants checked after documentation.
  Unrelated `soundscape/` remains excluded from task-file checks.

## November 22 — delivery reconciliation

**Why now:** establish which Task 006 findings are fixed and which acceptance
gates still need evidence, so independent roadmap work can proceed without
repeating rejected native-startup experiments.

The later owner authorization covers planning, implementation and self-review
of the roadmap and justified cleanup. Its historical planning-only status records
the original session; it does not prohibit this authorized sequence or establish
that future features exist. See the [delivery ledger](2026-11-22-autonomous-delivery.md)
and [continuation protocol](../prompts/autonomous-delivery.md).

Read this entire plan, including the native-startup investigation. Compared the
original review's four findings with current source and focused tests: old sources
are retired before replay resume, loop changes preserve pending replay/seek,
waveform smoke begins at sample 12,000 before expecting 48,000, and the playback
selector instructions describe the implemented command. No additional production
fix was justified by this reconciliation; existing tracked/untracked work and the
unrelated `soundscape/` directory were preserved.

Fresh November 22 verification: approved `npm ci` passed (100 packages, zero
reported vulnerabilities), all 573 tests in 12 files passed, typecheck and build
passed, and headless Chrome 157 spectral/import/playback entries passed. The initial
offline install lacked a cached package; a restricted online retry was interrupted.
Initial browser localhost bind was denied; reviewed browser execution passed.
Tracked and all 20 untracked task-file whitespace checks and changed-document
local links passed; unrelated `soundscape/` was excluded. See the ledger for scope.
Earlier benchmark numbers remain historical; no benchmark files were changed.

Author self-review covered the current fixes, regression expectations and
adapter/clock/session/controller/UI/inspection/measurement/validation ownership
boundaries. No new demonstrated defect found within this bounded reconciliation.
This is author self-review, not independent review or acceptance of all Task 006
criteria. No production or test changes were made in this task.

Task 006 remains **in progress**. Next native-startup evidence is a default-path
hardware run with a verified built-in/wired output; repeating rejected rate,
latency or silent-routing variants is not a next code task. Physical sync
calibration/event capture/drift, native-memory peak/reclamation, physical dropped
frames and remaining listening/accessibility/device acceptance are still open.
No new physical/manual/foreground-performance evidence was obtained here.
Independent DSP cleanup auditing is ready; a specified frequency-inspection slice
can follow without claiming that the shared clock has passed physical acceptance.
