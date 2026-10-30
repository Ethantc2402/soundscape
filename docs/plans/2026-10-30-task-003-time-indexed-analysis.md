# Task 003 — Successive-window, time-indexed spectral analysis

Status: planned; planning complete, implementation not started.

## Objective

Add a pure TypeScript way to analyze successive fully fitting windows of an in-memory PCM recording, exposing explicit sample offsets and times while reusing one validated spectral session.

This scope is inferred from [README](../../README.md) and the [Task 002.5 handoff](../decisions/003-spectral-engine-hardening.md#numerical-verification-and-next-milestone). Those sources establish the direction and session constraints, but do not specify a complete Task 003 contract. The API and policies below are proposals, not existing behavior or independently supplied product requirements. ADR 003 describes Task 002.5; it is not Task 003 implementation.

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

- Proposed `src/audio/timeline.ts`: iteration contract and implementation; name remains provisional.
- Proposed `src/audio/timeline.test.ts`: scheduling, timing, numerical parity, and invalid-input coverage.
- [spectrum.ts](../../src/audio/spectrum.ts): reuse `createSpectrumAnalyzer`; avoid changing public behavior.
- [pcm.ts](../../src/audio/pcm.ts): reuse validation rules.
- [spectral.test.ts](../../src/audio/spectral.test.ts): retain numerical/ownership baselines and existing independent references.
- [README](../../README.md), [Architecture](../ARCHITECTURE.md), [Product](../PRODUCT.md): describe implemented capability only after implementation.
- Proposed `docs/decisions/004-time-indexed-analysis.md`: record accepted contracts without confusing ADR and task numbers.
- Optional existing `scripts/spectral-browser.ts`: extend engine smoke coverage if practical; no application UI change.

## Implementation steps

- [ ] Finalize the proposed API types and document validation timing. Prefer a factory returning an iterable: validate PCM/settings eagerly, then compute frames lazily; define whether iteration is single-use explicitly.
- [ ] Design the no-fitting-window path before coding. `createSpectrumAnalyzer` currently rejects N < L at construction; do not silently duplicate a full PCM scan or weaken its public behavior. Validate PCM and settings once on this path, using a focused shared internal settings helper only if needed to avoid divergent rules.
- [ ] Add scheduling and validation tests: exact fit, shorter input, incomplete tail, last aligned fit, H < L overlap, H = L adjacency, H > L gaps, H > N, invalid types, zero/negative/fractional/nonfinite/unsafe hop, invalid FFT/frame settings, and malformed PCM.
- [ ] Implement sample-based offsets, bounded frame count, lazy analysis, and start/end times. Do not accumulate floating-point times to derive later offsets.
- [ ] Add mono/stereo parity, silence, deterministic changing-frame fixtures, explicit FFT padding, input preservation, result isolation, early termination, validation-call count, detached-buffer, and nonfinite mutation tests. Preserve existing intentional error classes.
- [ ] Document the API, source-buffer lifetime, tail and hop policies, memory limitations, and a small usage example. Update architecture/product docs and add the decision record.
- [ ] Run relevant checks, review the final diff, and update this plan with actual results and completion or remaining work.

## Risks and proposed decisions

- **Tail:** discard incomplete observation windows. FFT padding remains explicit via `frameLength < fftSize` and never authorizes reading past PCM bounds.
- **Hop:** require it explicitly; permit overlap, adjacency, and gaps. Avoid an arbitrary default overlap or FFT size.
- **Time origin:** use recording-relative window start and end-exclusive time; do not imply wall-clock scheduling, centered timestamps, or padded observation duration.
- **Memory:** do not offer eager collection by default. Lazy output bounds internal accumulation, but callers retaining results can still consume substantial memory; every `SpectrumResult` includes owned frequency/bin arrays.
- **Ownership:** synchronous sequential use only. Existing guards detect some invalid mutations, but do not make concurrent mutation safe.
- **Validation:** separate wrong-type `TypeError` from invalid-value `RangeError`, consistent with existing modules. Invalid configuration must not hide behind zero-frame output or delayed iterator consumption.
- **Compatibility:** preserve all current single-frame/session APIs and numerical contracts. A focused internal refactor requires regression checks, not a broad redesign.
- **Open scope question:** no external Task 003 brief is present. If the intended milestone includes different time-indexed features or rendering, revise this plan before implementation. Otherwise the above is the recommended bounded milestone.

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

- Reviewed contributor guidance, setup docs, README, current PCM/spectral/band implementations, reusable-session tests, and browser entry.
- Committed setup documents as `2b5991c`.
- Defined proposed observable behavior, component changes, risks, and verification.
- No Task 003 source, tests, dependencies, or application behavior changed. Future implementation checks have not run.

## Next steps

Planning-only request fulfilled. Stop here. On a subsequent implementation request, inspect current Git status and this plan, resolve any revised scope, then implement the contract and keep this plan current. This plan is versioned with the project documentation for use in subsequent chats or checkouts.
