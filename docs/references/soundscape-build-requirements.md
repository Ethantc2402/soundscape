# Requirements: soundscape-build

Status: design requirements for the implemented
[build skill](../../.agents/skills/soundscape-build/SKILL.md).
Executed evaluations and limits are recorded in the
[implementation plan](../plans/2026-11-01-project-skills.md).
Source IDs and shared requirements C1–C6 are defined in
[the research report](skill-research.md).

## Purpose, trigger, and inputs

Implement and verify authorized Soundscape work, including focused fixes and
cleanups. Accept a bounded request directly or an existing plan. Do not require a
formal plan for trivial work. Do not activate implementation for planning-only,
review-only, or research-only requests.

Inputs: user request, existing authorization, current Git status, applicable
guidance and decision records, affected code/callers/tests, and plan when used.
The current checkout may contain unrelated uncommitted or untracked work.

## Required behavior

- **B1 — Establish the starting state:** Inspect status and relevant diffs before
  edits. Preserve unrelated work, use the existing checkout, and distinguish
  observed baseline failures from newly introduced failures. Never infer a
  pre-existing failure without evidence. Basis: C1; local AGENTS.md; S2, A3.
- **B2 — Read before changing:** Trace the affected behavior through its callers
  and validation boundary. Reproduce reported bugs when practical; document the
  actual cause or remaining uncertainty. Do not stack speculative fixes. Basis:
  A1, S4, G1.
- **B3 — Focused implementation:** Use precise units/names, direct control flow,
  cohesive functions, and explicit ownership. Extract a shared helper only for
  a concrete common rule. Check callers before deleting code. Keep DSP pure
  TypeScript under src/audio; preserve the React boundary and public contracts.
  Basis: G1, G2; local quality guidance and decisions.
- **B4 — Validation and state:** Preserve intentional TypeError/RangeError
  behavior, finite over-range input, immutability, and channel order. Shared
  validation or normalization changes require checking all consumers. Analyzer
  scratch remains private; result edits and later calls must not corrupt other
  results. Do not turn local mutation guards into a promise of concurrent safety.
  Basis: local decisions 001–004; G1, H2.
- **B5 — Meaningful regression evidence:** Prefer a failing reproduction before
  a bug fix and verify it afterward. For behavior-preserving edits use relevant
  existing coverage and add tests only for real gaps. Mathematical expectations
  must be independent; preserve explicit tolerances rather than relaxing them
  to hide a regression. Basis: S4, G3, M1; local numerical contracts.
- **B6 — Complete verification:** From the repository root run npm ci, npm test,
  npm run typecheck, npm run build, and git diff --check. Use the documented
  writable cache when necessary; report network/cache/tool failures accurately.
  There is no configured lint script. Add browser checks for changed browser
  flows/compatibility and benchmarks for performance claims when warranted.
  Basis: local AGENTS.md/README/package.json; S3, A3, M2.
- **B7 — Review and recover:** Inspect the final diff for scope and correctness,
  fix introduced regressions, and rerun affected verification after further
  edits. Record unrelated blockers without expanding the assignment. Do not
  force an arbitrary fixed number of repair passes. Basis: G1, S3, H1.
- **B8 — Durable completion:** Update affected documentation and the active plan.
  Report changed behavior, reasons, actual checks, limitations, and unfinished
  work. No speed claims without measurements and no push/merge without explicit
  approval. Basis: S2, S3, A3; local instructions.

## Output contract

Focused implementation and meaningful tests, maintained docs/plan where relevant,
and a concise completion report. Report passed, failed, and unrun checks
separately. A tool failure or unresolved acceptance criterion prevents an
unqualified completion claim; finish independent authorized work where possible.

Skill instructions should refer to package.json and repository guidance as the
command source of truth so future command changes do not create competing rules.

## Future acceptance scenarios — not yet executed

- **Dirty checkout:** Start with unrelated tracked/untracked edits; implement a
  small measurement change while retaining those edits and avoiding new worktrees.
- **Reproducible defect:** Use a disposable known-bad implementation; demonstrate
  an analytic test fails for the intended reason, apply a minimal fix, and verify
  both the test and required suite. This tests the workflow, not a current bug claim.
- **Ownership:** For a reusable analyzer change, retain an earlier result, edit
  returned arrays/metadata, analyze later frames, and verify independence and
  unchanged PCM using existing ownership contracts.
- **Independent mathematics:** For constant stereo amplitudes -2 and 0.5, require
  per-channel mean square 4 and 0.25 and RMS 2 and 0.5, without clipping or mixing.
  For spectral work use the separately documented window-weighted definitions.
- **Failed tooling:** Simulate an unavailable browser or install failure. Report
  the precise unverified area; never substitute unit tests for a browser claim.
- **Scope and proportion:** A naming/comment cleanup adds no dependency, UI
  redesign, speculative helper, benchmark claim, or ritual implementation test.
- **Plan correction:** If inspection disproves a planned interface assumption,
  update the plan and rationale while preserving scope; ask only if the correction
  materially changes the user's contract or outcome.

Reject a future skill that hides failures, mutates unrelated work, skips required
checks without disclosure, or adopts upstream commit/posting behavior implicitly.
