# AD-004 — browser adapter cleanup audit

Status: completed — November 22, 2026. Finite audit; no runtime change justified.

## Why now and observable outcome

Richer inspection will expose more session data. Import/playback must preserve
stable analysis PCM across cancellation, asynchronous resume and replacement.
Complete a finite audit of both browser adapters and their actual caller boundaries;
fix demonstrated defects only. A justified no-change result meets this audit's
acceptance, without claiming physical playback or whole-project acceptance.

## Scope and acceptance

- Inspect all implementation and tests in `src/browser/`: `import-audio.ts`,
  `import-audio.test.ts`, `song-playback.ts`, `song-playback.test.ts`.
- Trace import → controller → prepared song → transport, native-buffer ownership,
  validation/errors, failure/retry, stale completion, seek/loop/end and disposal.
- Check each suspected issue against current callers/contracts and deterministic
  or analytic evidence before editing. Preserve error classes, finite over-range
  values, units, L/R order, source immutability and private scratch/native storage.
- Run required repository checks and review this task's final documentation.
  Record limitations and exact next independent task.

Read README, Product, Architecture, quality guidance, the cleanup prompt, plan
conventions, decisions 001/005/006, the full Task 006 plan including rejected
startup experiments, delivery protocol/ledger and pending AD-003 frequency plan.
No external algorithm or advice from the unverified video is introduced.

Boundary coverage: complete `import-session.ts`, `song-session.ts`,
`ImportedSong.tsx`, `SongTransport.tsx`, their controller/session tests,
`playback-clock.ts`, `song-inspection.ts`, `audio/pcm.ts`, and import/playback
browser entries. Repository-wide reference search confirmed all production adapter
callers and offline helper callers. These boundary reads do not complete the
separate session/state, UI/accessibility or tests/scripts/docs audits. AD-002's
DSP audit is not repeated. No browser runner/profiling audit is claimed.

## Steps and findings

- [x] Establish ownership: this chat alone active; setup and predecessor idle.
  Preserve 14 tracked modifications, all predecessor untracked files and unrelated
  `soundscape/`. This task owns only this plan and the ledger update.
- [x] Trace both adapters, tests and consumers; evaluate concrete suspected gaps.
- [x] Decide implementation: no demonstrated defect justified a production edit.
- [x] Complete required checks, author self-review and outgoing handoff.

Import checks file size before reading, signature before decoding, and current
identity after read/decode/pre-copy yield. Channel count/duration reject before
sample copying; native decoding allocation necessarily precedes those guards.
Fresh Float32 copies validate complete samples, preserve over-range values and
L/R order, and do not alias decoder storage. Unit fixtures check exact 300-second
boundary using 300 samples at 1 Hz, byte cap, invalid storage/nonfinite samples,
read/decode failures and stale suppression. Cancellation invalidates publication;
it does not abort a browser decode. The controller serializes the entire pipeline
and releases old/obsolete sessions. These are deliberate resource policies.

Playback receives stable PCM from the already validated song owner. It captures
rate/count for its clock, installs listeners in an effect, and constructs/resumes
the context only on Play. The public synchronous copy helper fully validates;
the private cooperative path checks shape and every chunk before publishing one
native buffer. Its borrowed PCM must remain stable across yields; selected-sample
checks are not concurrent-mutation protection. No extra full-song history exists.

Pause invalidates command identity while allowing shared preparation to finish;
dispose additionally prevents further chunks/publication, stops/disconnects sources,
removes listeners and requests context close. Deferred resume, hidden/interrupted
states and stale ended events cannot restart disposed commands. Seek retains
integer anchors; pending replay/seek survives loop changes. Clock segments retain
preceding output mapping rather than resetting estimated output on an ended event.
Tests cover these races, retry and one allocation across overlapping commands.

Independent ownership examples in existing tests: stereo chunk length 524,289,
left extrema at 262,143/262,144 and the final sample, distinct right values, exact
copied arrays and selected sample 27; an invalid final sample cannot start a
partial buffer. Native graph browser oracles independently schedule sample-index
output for stop/restart/loop, and isolate a 48→44.1 kHz impulse with a one-sample
alignment allowance. Reading those oracles is not a new browser execution.

No malformed-input expansion was added to internal factories that receive
validated session PCM; documented pure PCM validation remains authoritative.
No refactor, dependency, test, source, harness or benchmark change is justified.

## Verification and limits

Fresh checks passed: 573 tests across 12 files, typecheck, build and tracked
whitespace. Separate whitespace checks cover all 23 untracked task files
(excluding unrelated soundscape/); local links in both written documents pass.
Installation passed: `npm ci --cache /private/tmp/soundscape-npm-cache`, 100 packages.
No lint script exists. Browser behavior is unchanged, so this docs-only audit
uses source/test inspection and the required suite rather than repeating native
startup experiments. AD-001 browser results are historical. No fresh browser,
benchmark, foreground, physical-output, native-memory, listening or manual
accessibility check is claimed.

Task 006 remains in progress: default-path startup on known built-in/wired output
with actual route/OS/browser/timings; physical calibration/registered tolerance,
20 timed events and five-minute drift; native peak/reclamation, physical dropped
frames and remaining manual/device checks are open. Rejected fixed-rate,
latency-hint and silent-output experiments stay rejected; moving construction
into import/mount would not resolve the observed stall.

## Next steps

Author self-review found no actionable defect in the audited contracts or these
documents. This is not independent review or proof of correctness. All predecessor
work is preserved; only this plan and ledger were written.

This finite audit is completed. Next independent task
is AD-005 session/state cleanup audit. AD-003 remains unimplemented pending actual
owner reference, floor and display-resolution answers, one question at a time.

Successor creation was rejected by automatic approval review because forwarded
authorization was not accepted as trusted user permission. The prepared AD-005
handoff remains in the ledger; continuation awaits explicit owner authorization.
No successful successor was returned. This does not reopen the completed audit.
