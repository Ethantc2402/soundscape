# Requirements: soundscape-review

Status: design requirements for the implemented
[review skill](../../.agents/skills/soundscape-review/SKILL.md).
Executed evaluations and limits are recorded in the
[implementation plan](../plans/2026-11-01-project-skills.md).
Source IDs and shared requirements C1–C6 are defined in
[the research report](skill-research.md).

## Purpose, trigger, and inputs

Review Soundscape changes for demonstrated correctness, contract, ownership,
testing, and maintainability problems. Trigger on an explicit review request or
the final self-review of an authorized build. Identify self-review as such; it
does not become independent review because a skill was used.

Inputs: requested diff or commit range, current worktree status, requirements or
plan, applicable AGENTS.md, decisions, changed code, callers, and relevant tests.
For local changes include relevant staged, unstaged, and untracked content.
Do not assume HEAD~1 includes all work or that every existing edit belongs to the
current task. A review-only request does not authorize code fixes or remote posts.

## Required behavior

- **R1 — Establish scope and intent:** State the files/range reviewed and expected
  behavior. Inspect applicable project rules and requirements. Identify gaps in
  accessible context rather than guessing. Basis: S5, A2, G1; C1.
- **R2 — Review beyond the patch:** Read relevant surrounding code and trace
  callers of shared validation, normalization, and analyzer state. Classify
  pre-existing issues separately from regressions caused by the requested change.
  A demonstrated defect on a specific supported input is valid evidence. Basis:
  G1, A1; local contracts; deliberate adaptation of A2.
- **R3 — Numerical correctness:** Verify units, formulas, window/padding order,
  endpoint weighting, band boundaries, sample-grid bounds, and explicit
  tolerances where affected. Check independent expectations; agreement between
  two APIs or an unchanged test count is insufficient. Preserve the legacy
  measurement names unless a migration is explicitly scoped. Basis: decisions
  001–004; G1, G3, M1.
- **R4 — Ownership and lifecycle:** Check retained input references, captured
  metadata, scratch reuse, detached-buffer guards, finite selected samples,
  returned-array independence, iterator closure, and accidental retention of
  result history where relevant. Do not promise immutable output merely from
  readonly TypeScript types. Basis: decisions 003–004; G1, H2.
- **R5 — Test quality and evidence:** Assess whether tests exercise the claimed
  behavior, error class, boundary, and ownership failure. Identify a concrete
  unsupported case, not a generic request for more tests. Run relevant checks
  when permitted and useful; otherwise state exactly what was inspected and
  what remains unverified. Basis: G1, G3, M1, S3.
- **R6 — Actionable findings:** Each finding names the supported triggering
  condition, observed or demonstrable failure, expected contract, practical
  impact, and smallest useful file/line location. Add a minimal fix direction
  when justified. Deduplicate root causes and distinguish proven issues from
  hypotheses needing investigation. Basis: A2, H2, S5.
- **R7 — Severity by consequence:** Prioritize incorrect results, broken callers,
  data ownership failures, and meaningful validation regressions. Label optional
  readability suggestions separately. No fixed line-count gates, speculative
  optimization, or preference-only blockers. Basis: G1, H2, G2; local quality
  guidance. Project risk and supported inputs determine urgency.
- **R8 — Honest completion and authority:** Report findings first, checks and
  review limits next. A clean review means no actionable issue found within
  stated scope, not proof of correctness. Do not fix, approve, post comments,
  push, or merge unless separately authorized. Basis: A2, S3; C1.

## Output contract

A severity-ordered list of evidence-backed findings, each with location,
trigger, contract/expected result, impact, and remediation direction where useful.
Follow with checks actually run, coverage limits, and unresolved questions.
Report no findings when warranted; never manufacture issues to fill a template.

Fresh-context review can be offered for a substantial or risky change when the
session permits it. The skill must also work as an honest single-agent review
without hardcoded vendor models, mandatory agents, or PR-service assumptions.

## Future acceptance scenarios — not yet executed

Use disposable seeded diffs to evaluate detection and false positives. These are
hypothetical mutations, not findings in the current codebase.

- **Power normalization:** Double DC/Nyquist weights in a seeded change. The
  review should demonstrate the documented constant/alternating-signal power
  mismatch with an independent expected result.
- **Caller-dependent failure:** Seed a validation change that works for one-shot
  analysis but breaks the timeline short-recording path. The review must follow
  callers and report the supported trigger despite a superficially safe diff.
- **Aliasing:** Return a private frequency template directly. Demonstrate that
  editing one result corrupts a later result; do not accept readonly typing as
  runtime ownership protection.
- **Scheduling boundary:** Seed an extra off-grid final frame or accumulated time
  scheduling. Check the documented integer-grid and discarded-tail contracts.
- **No false positive:** Review a valid finite over-range fixture, intentional
  RangeError, and legacy meanSquareEnergy name without flagging them as defects.
- **Clean change:** Review a harmless clarification with adequate existing tests;
  return no actionable findings rather than enforcing arbitrary style limits.
- **Authority and limits:** Given review-only with no browser available, preserve
  files, publish nothing, identify self-review when applicable, and disclose
  unexecuted checks without claiming the entire system is verified.

Reject a future skill that only scans the diff, reports suspicions as facts,
silently posts feedback, or mistakes passing tests for mathematical proof.
