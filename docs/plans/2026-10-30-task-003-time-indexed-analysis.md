# Task 003 — Successive-window, time-indexed spectral analysis

Status: completed.

## Objective

Add a pure TypeScript way to analyze successive fully fitting windows of an in-memory PCM recording, exposing explicit sample offsets and times while reusing one validated spectral session.

This scope is inferred from [README](../../README.md) and the [Task 002.5 handoff](../decisions/003-spectral-engine-hardening.md#numerical-verification-and-next-milestone). Those sources establish the direction and session constraints, but do not specify a complete Task 003 contract. The API and policies below were accepted for implementation by the Task 003 request and are now implemented. ADR 003 describes Task 002.5; it is not Task 003 implementation.

## Acceptance criteria

- A new API accepts the existing `PcmAudio`, fixed `fftSize`/optional `frameLength`, and an explicit positive safe-integer `hopSize` in samples per channel. Existing spectral APIs remain compatible.
- For recording length N, resolved frame length L, and hop H, offsets are exactly `i * H`, starting at zero, while `offset <= N - L`. Frame count is zero when N < L; otherwise `1 + floor((N - L) / H)`. The final fitting grid window is included; no extra off-grid window is appended.
- A valid nonempty recording shorter than L yields zero frames. Empty/malformed PCM remains invalid under the existing PCM contract. Invalid settings are rejected even when no window fits.
- Each frame exposes a zero-based index, start offset, start time `offset / sampleRate`, end-exclusive time `(offset + L) / sampleRate`, and the existing `SpectrumResult`. Times refer to observed samples, excluding FFT padding. Unrepresentable timing is rejected intentionally rather than emitted as infinity.
- Each yielded spectrum matches `analyzeSpectrum` at the same offset/settings, with mono/stereo ordering, current power units, normalization, Hann gains, band rules, and tolerances preserved.
- Full PCM validation occurs once per analysis sequence. Each selected frame retains the existing local bounds/sample checks. Input is not mutated; yielded results remain independent of later frames and caller edits.
- Results are produced lazily without collecting all spectra internally; callers can stop early. Document that the iterator retains PCM and workspace while reachable and that source PCM must remain stable for its lifetime.
- Numerical, boundary, validation, and ownership tests pass alongside the existing suite; type-check and production build pass. Documentation describes the new contract and limits.

## Scope

Include deterministic synchronous iteration, timing metadata, explicit hop/tail policy, tests, and usage documentation. Keep the React demonstration unchanged.

Exclude decoding, uploads, playback, UI visualization, real-time scheduling, workers, asynchronous processing, streaming input, complex-phase STFT output/reconstruction, new features such as onset detection, new dependencies, and changes to existing numerical definitions. A lazy iterator over an already loaded recording is not streaming audio input.

## Affected components

- `src/audio/timeline.ts`: iteration contract and implementation; exports `createSpectrumTimeline`.
- `src/audio/timeline.test.ts`: scheduling, timing, numerical parity, and invalid-input coverage.
- [spectrum.ts](../../src/audio/spectrum.ts): reuse `createSpectrumAnalyzer`; avoid changing public behavior.
- [pcm.ts](../../src/audio/pcm.ts): reuse validation rules.
- [spectral.test.ts](../../src/audio/spectral.test.ts): retain numerical/ownership baselines and existing independent references.
- [README](../../README.md), [Architecture](../ARCHITECTURE.md), [Product](../PRODUCT.md): describe implemented capability only after implementation.
- `docs/decisions/004-time-indexed-analysis.md`: record accepted contracts without confusing ADR and task numbers.
- Optional existing `scripts/spectral-browser.ts`: extend engine smoke coverage if practical; no application UI change.

## Implementation steps

- [x] Finalize the proposed API types and document validation timing. Prefer a factory returning an iterable: validate PCM/settings eagerly, then compute frames lazily; define whether iteration is single-use explicitly.
- [x] Design the no-fitting-window path before coding. `createSpectrumAnalyzer` currently rejects N < L at construction; do not silently duplicate a full PCM scan or weaken its public behavior. Validate PCM and settings once on this path, using a focused shared internal settings helper only if needed to avoid divergent rules.
- [x] Add scheduling and validation tests: exact fit, shorter input, incomplete tail, last aligned fit, H < L overlap, H = L adjacency, H > L gaps, H > N, invalid types, zero/negative/fractional/nonfinite/unsafe hop, invalid FFT/frame settings, and malformed PCM.
- [x] Implement sample-based offsets, bounded frame count, lazy analysis, and start/end times. Do not accumulate floating-point times to derive later offsets.
- [x] Add mono/stereo parity, silence, deterministic changing-frame fixtures, explicit FFT padding, input preservation, result isolation, early termination, validation-call count, detached-buffer, and nonfinite mutation tests. Preserve existing intentional error classes.
- [x] Document the API, source-buffer lifetime, tail and hop policies, memory limitations, and a small usage example. Update architecture/product docs and add the decision record.
- [x] Run relevant checks, review the final diff, and update this plan with actual results and completion or remaining work.

## Risks and decisions

- **Tail:** discard incomplete observation windows. FFT padding remains explicit via `frameLength < fftSize` and never authorizes reading past PCM bounds.
- **Hop:** require it explicitly; permit overlap, adjacency, and gaps. Avoid an arbitrary default overlap or FFT size.
- **Time origin:** use recording-relative window start and end-exclusive time; do not imply wall-clock scheduling, centered timestamps, or padded observation duration.
- **Memory:** do not offer eager collection by default. Lazy output bounds internal accumulation, but callers retaining results can still consume substantial memory; every `SpectrumResult` includes owned frequency/bin arrays.
- **Ownership:** synchronous sequential use only. Existing guards detect some invalid mutations, but do not make concurrent mutation safe.
- **Validation:** separate wrong-type `TypeError` from invalid-value `RangeError`, consistent with existing modules. Invalid configuration must not hide behind zero-frame output or delayed iterator consumption.
- **Compatibility:** preserve all current single-frame/session APIs and numerical contracts. A focused internal refactor requires regression checks, not a broad redesign.
- **Scope:** the implementation request explicitly selected this plan. No additional time-indexed features or rendering were added.

## Verification

Baseline already executed during repository connection on October 30, 2026: 352 tests across two files passed; `npm run build` passed including type-check; documentation links and `git diff --check` passed. These are historical baseline results, not Task 003 verification.

Planned implementation checks:

1. `npm test -- src/audio/timeline.test.ts` — new contract and edge cases.
2. `npm test` — existing numerical contracts plus new coverage.
3. `npm run build` — type-check and production bundling.
4. `git diff --check` and final diff review — scope and formatting.
5. `npm run test:browser` if Chromium is available and smoke coverage is extended; record the exact blocker otherwise. Do not disable the browser sandbox by default.

There is no lint script. Benchmarking is optional only if implementation introduces a performance concern; use no unmeasured performance claims. UI responsive/accessibility testing is not applicable while the UI remains unchanged.

## Progress

- Implemented `createSpectrumTimeline` with eager settings/PCM validation and a
  single-use lazy generator. Settings, recording metadata, and schedule are captured.
- Shared existing FFT/frame validation through internal `spectrum-settings.ts`.
  Short recordings validate once directly and yield no frames; fitting recordings
  validate once via the unchanged public analyzer factory. No unchecked API added.
- Added 52 timeline tests covering scheduling, numeric/structural failures, timing
  overflow, lazy early termination, validation count, changing analytic signals,
  independent Parseval expectations, padding, stereo, metadata and result ownership,
  detached storage, and nonfinite mutation. Existing 352 tests retained.
- Updated README, architecture/product context, ADR 004, and browser smoke entry.
  Preserved pre-existing AGENTS.md edits, README reference section, and untracked
  `docs/references/`. No dependencies, lockfile, or React demonstration changes.

## Executed verification — November 1, 2026

Node v24.4.0, npm 11.4.2, local macOS checkout.

- `npm ci --cache /private/tmp/soundscape-npm-cache`: passed.
- `npm test -- src/audio/timeline.test.ts`: passed initially with 49 tests;
  expanded suite then passed as part of full `npm test`: 404 tests across 3 files
  (52 timeline tests plus 352 existing tests).
- `npm run typecheck`: passed. One intermediate run failed with TS2688 for empty
  duplicate `node_modules/@types/{chai,deep-eql,estree} 2` directories. Removed
  only those empty generated directories; type-check then passed without code or
  dependency configuration changes.
- `npm run build`: passed, including its own type-check.
- `git diff --check`: passed; final diff reviewed for scope and retained contracts.
- Browser smoke: initial sandbox run could not bind localhost (`EPERM`);
  outside the sandbox the default executable was absent (`spawn chromium ENOENT`).
  Retried successfully with installed Chrome using
  `CHROMIUM='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:browser`.
  Browser sandbox remained enabled. HeadlessChrome/156.0.0.0 executed all three
  spectral paths (single call, session, timeline) and timing assertions; each
  reported dominant bin 85 at 996.09375 Hz and total power 0.4999999904833539.
- No lint script exists. Benchmark not run: no throughput claim or performance
  requirement was introduced. UI QA is not applicable because UI is unchanged.

## QA follow-up — November 1, 2026

Applied the repository `soundscape-build` and `soundscape-review` skills. This
was author self-review, not independent review. Reviewed the complete Task 003
implementation, shared spectral settings extraction, PCM/session validation,
normalization/band/window consumers, tests, browser entry, and related docs
against the acceptance criteria. Unrelated measurement cleanup/tests, skills,
AGENTS.md, README additions, prompts, and references were preserved.

Confirmed and fixed one P2 input-dependent defect at the timeline settings
boundary: spreading the settings object discarded inherited/non-enumerable
properties. Valid FFT settings threw TypeError; an inherited `frameLength: 4`
with own `fftSize: 1024` silently yielded zero frames from eight samples instead
of offsets `[0, 4]`. Directly reading the declared properties now matches the
existing analyzer's supported object semantics. Three regression cases failed
before the fix and passed afterward. No additional confirmed in-scope defects
remain after self-review; this is not a proof of correctness.

Actual follow-up checks (Node v24.4.0, npm 11.4.2):

- `npm ci --cache /private/tmp/soundscape-npm-cache`: passed, 100 packages installed.
- Reproduction `npm test -- src/audio/timeline.test.ts`: initially failed exactly
  the three new regression cases (52 existing timeline tests passed).
- After the fix, the same targeted command passed all 55 timeline tests.
- `npm test`: passed all 409 tests across 3 files. This includes 55 timeline
  tests and 354 other tests; two unrelated measurement tests were already present
  at the start of this follow-up and were preserved.
- `npm run typecheck`: passed.
- `npm run build`: passed, including its type-check.
- `git diff --check`: passed after the fix and final plan/documentation update.
- `CHROMIUM='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:browser`:
  passed with browser sandbox enabled, HeadlessChrome/156.0.0.0. The existing
  single-call, session, and timeline smoke paths all produced dominant bin 85,
  996.09375 Hz, and total power 0.4999999904833539; timeline timing assertions passed.
- Final self-review found the fix limited to property capture; no DSP mathematics,
  public spectral validation, ownership, scheduling, or dependency changes.
- No lint script exists. Benchmark and UI testing remain unrun/not applicable:
  no performance claims or UI changes. Browser verification covers this Chrome
  smoke path, not other engines or production-bundled spectral execution.

Task 003 remains completed. No push, merge, or external review comments performed.

## Next steps

Task 003 is complete. No push or merge performed. Future work requires separate
scope; full PCM remains in memory and callers retaining many spectra incur that
memory cost. Source PCM must remain stable for the iterator lifetime.
