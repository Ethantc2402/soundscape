---
name: soundscape-review
description: Review Soundscape diffs, pull requests, and proposed DSP cleanups for numerical correctness, caller compatibility, validation, ownership, and meaningful tests. Use for explicit code reviews and final self-review during an authorized build. Review-only requests do not authorize fixes or remote comments; excludes research about skills.
---

# Review Soundscape changes

Find demonstrated defects and meaningful maintenance risks within the requested
change. A clean review may have no findings. Identify author self-review as such;
using this workflow does not make it independent review.

## Establish scope and context

Inspect Git status and the requested diff or commit range, including relevant
staged, unstaged, and untracked files. Do not assume HEAD~1 covers all work or
that every pre-existing edit belongs to this task. State what was reviewed.

Read [AGENTS.md](../../../AGENTS.md), [README](../../../README.md),
[architecture](../../../docs/ARCHITECTURE.md),
[quality guidance](../../../docs/references/code-quality.md), the task/plan, and
relevant [decisions](../../../docs/decisions). Resolve links relative to this file;
run permitted checks from the repository root. Read surrounding implementation,
callers, and tests, particularly consumers of shared validation and analyzer state.

## Check the affected contracts

- Numerical behavior: units, definitions, window-before-padding order, spectral
  normalization and endpoint weights, band boundaries, sample-grid scheduling,
  representable bounds, and explicit tolerances. Use independent analytic evidence;
  two APIs sharing a calculation cannot establish its correctness by agreement.
- Runtime boundary: malformed input, intentional error classes, frame bounds,
  short recordings, finite over-range samples, and preserved stereo order.
  Do not flag documented legacy measurement names or supported input as defects.
- Ownership/lifetime: borrowed PCM, captured metadata, detached-buffer and finite
  selected-sample guards, reusable scratch, independent returned arrays/metadata,
  iterator closure, and unintended retention. TypeScript readonly is not runtime
  isolation and local mutation guards do not authorize concurrent mutation.
- Maintainability: direct control flow, precise names and units, concrete shared
  rules, appropriate dependencies, and pure DSP/rendering boundaries. Prefer
  evidence of maintenance risk over fixed function lengths or style preferences.
- Test quality: expected results independent of implementation, relevant error and
  boundary cases, ownership failures, and checks that actually support the claims.
  Name the missing supported case rather than requesting generic extra coverage.

Scope findings to the change but trace callers beyond the patch. Demonstrated
input-dependent bugs count. Separate pre-existing issues, hypotheses, and optional
suggestions from introduced regressions. Run relevant checks when permitted and
useful; disclose omissions and blockers rather than implying they passed.

## Report actionable findings

For each unique root cause, provide severity by consequence, the smallest useful
file/line location, supported triggering condition, expected contract, actual or
demonstrable failure, practical impact, and a minimal fix direction when justified.
Validate a suspected finding against callers/tests before reporting it as fact.
Do not block on personal preferences or invent issues to fill a template.

Put findings first, followed by checks actually run, scope limits, and unresolved
questions. With no findings, say so and retain the limits: this is not a proof of
correctness. Review-only work stays read-only; do not fix code, approve a PR,
publish comments, push, or merge without separate authorization. During an
already-authorized build, use findings to fix in-scope regressions and reverify.
No mandatory subagents, vendor models, or service access are required.

Design provenance: [research assessment](../../../docs/references/skill-research.md).
Read it only when revising this workflow or investigating its rationale.
