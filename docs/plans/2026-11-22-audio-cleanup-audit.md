# AD-002 — finite audio-core cleanup audit

Status: completed — November 22, 2026. Documentation-only, justified no-change audit.

## Why now

Detailed frequency views will expose more analyzer results. Audit their numerical
and ownership foundation first so new presentation work can rely on established
contracts. This is the next independent slice while physical playback acceptance
requires hardware evidence.

## Outcome and scope

Inspect every implementation module in `src/audio/`, its three analytic test
files, public consumers and decisions 001–004. Fix only demonstrated gaps that
preserve supported behavior; a justified no-change audit is acceptable. Preserve
units, errors, tolerances, finite over-range values, input immutability, stereo
order, private scratch and independent returned results. No new feature,
dependency, abstraction, performance claim or playback startup experiment.

Existing dirty source/test/docs and untracked Task 006 files are predecessor work;
this task owns this plan, its ledger update and the later owner-requested
four-skill protocol correction, unless an issue warrants a
documented fix. Unrelated `soundscape/` remains excluded. App activity showed only
this chat active, with setup and predecessor idle.

## Acceptance and steps

- [x] Read protocol, ledger, AGENTS, all three repository workflow skills, README,
  Architecture, Product, quality guidance, cleanup prompt and decisions 001–004.
- [x] Inspect all eight audio implementation modules and all three audio test
  files; trace imports/callers and record concrete evidence below.
- [x] Select only demonstrated issues; record a no-change outcome if none found.
- [x] Execute required installation, test, typecheck, build and whitespace checks.
- [x] Perform explicitly identified author self-review; record limits and handoff.

## Inspection evidence

- `pcm.ts`: intentional type/range validation precedes dereferences; sparse
  channels fail storage checks, full finite scans accept over-range Float32.
  `audio.test.ts` exercises malformed containers, rates/storage, lengths, samples
  and error messages across all measurement entry points.
- `measurements.ts`: standalone and combined calculations preserve channel order
  and include DC. Incremental arithmetic captures channel references/metadata on
  first advance, uses the original summation order across chunks and publishes
  only on completion. Existing analytic chunk-boundary/tail test uses exact
  quarter-amplitude baselines and signed extrema, beyond sibling-API agreement.
  Stable borrowed storage until completion is an explicit contract; mutation or
  transfer during yields is unsupported, not a new guard requirement.
- `fixtures.ts`: deterministic fresh Float32 storage, Nyquist/rate/frame bounds,
  phase/amplitude validation and finite-storage guard. Existing sine, DC, silence,
  phase and overflow fixtures support its documented contracts.
- `windowing.ts`, `spectrum-settings.ts`: periodic rather than symmetric Hann,
  observed-length gains before padding, bounded FFT/frame sizes and intentional
  option errors. Published size and band definitions are frozen.
- `spectrum.ts`: full-record validation at safe public boundaries; captured
  references and private FFT/Hann/scratch; each selected frame checks current
  bounds and finite values. Zero padding remains untouched, endpoint weights are
  one, interior weights two, denominator is FFT size times sum of squared window
  coefficients. Returned frequency/power/band/window data are independently owned.
- `bands.ts`: ascending bin-center assignment, higher-band shared boundaries,
  inclusive 20 kHz endpoint, clipped limits, empty counts, finite nonnegative input
  and summed overflow checks. Existing independent band sums and endpoint tests
  distinguish included-center conservation from total spectral power.
- `timeline.ts`: eager settings/PCM validation including the short path; fitting
  integer-grid schedule, discarded tails, finite final time, lazy private analyzer
  and generator closure. No accumulated floating-time scheduling or result history.
- `spectral.test.ts`: independent finite-sum DFT and weighted Parseval references;
  analytic Hann/sine/DC/Nyquist, padding, stereo, leakage and extreme finite input;
  result mutation, metadata capture, selected-sample and detached-buffer guards.
  Existing absolute tolerances remain 1e-7 analytic power, 1e-12 same-input
  DFT/Parseval, 2e-14 Hann; no tolerance changes proposed.
- `timeline.test.ts`: independent changing sine/silence/DC totals and overlapping
  padded Parseval checks, schedule/short/tail/large-hop/time-overflow cases,
  eager rejection, metadata capture, detached storage and output isolation.

Public caller trace: `main.tsx` consumes fresh fixture/measurement data;
`demo-band-timeline.ts` consumes the iterator into compact band columns;
`song-inspection.ts` drains or delegates incremental measurement, then retains
one analyzer and projects only bands; `song-session.ts` drives preparation with
generation checks and closes abandoned generators in `finally`. `waveform-overview.ts`
validates and creates independent extrema. `browser/import-audio.ts` validates
fresh decoded copies; `browser/song-playback.ts` validates/copies stable PCM into
private native storage; `playback-clock.ts` consumes sample-rate validation.
`scripts/spectral-browser.ts` and `scripts/benchmark-spectrum.mjs` use safe spectral
entry points. Repository import search found no other production DSP consumers.
Adapter/session correctness beyond this boundary trace remains AD-004/005 scope.

## Decision

No demonstrated in-scope correctness or maintenance defect found. Preserve the
existing code and tests. Repeated short guards protect distinct public boundaries;
unifying them would add coupling without a demonstrated drifting rule. The
documented borrowed-storage contract does not promise concurrent mutation safety.
No borrowed implementation or new external factual reference was introduced;
the owner's video remains unverified.

## Verification and review

Fresh November 22 checks: `npm ci --cache /private/tmp/soundscape-npm-cache`
passed (100 packages); `npm test` passed (573 tests / 12 files);
`npm run typecheck`, `npm run build` and `git diff --check` passed.
Separate untracked-task-file whitespace and this task's Markdown local-link
checks passed. No dependencies or lockfile changes. No lint script exists.
No browser/benchmark rerun is required for this documentation-only audit; runtime
behavior and performance are unchanged. Task 006 hardware/manual gates remain open.

Author self-review using `soundscape-review`: no actionable findings. Rechecked
the boundary trace, independent mathematical expectations, supported error cases,
output independence and the predecessor's incremental measurement diff. Reviewed
this plan and ledger for finite coverage, preserved scope and accurate evidence.
This is author self-review, not independent review or proof of correctness.
Source/test/harness/benchmark files were preserved; this plan, the ledger and the owner-requested four-skill
protocol correction were written by AD-002. No speed or hardware acceptance claims are made.

## Next step

AD-002 is complete. Hand off AD-003: inspect and plan the first detailed frequency
view at `docs/plans/2026-11-22-detailed-frequency-view.md`, discussing material
reference/floor/display choices with the owner before dependent implementation.
The complete protocol and precise outgoing task are in the
[delivery ledger](2026-11-22-autonomous-delivery.md). Task 006 remains in progress;
physical output/startup, synchronization, native memory, listening and manual
accessibility/device evidence remain external and were not rerun here.
