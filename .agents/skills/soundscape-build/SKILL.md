---
name: soundscape-build
description: Implement and verify Soundscape features, bug fixes, and focused cleanups while preserving pure TypeScript DSP, numerical contracts, and buffer ownership. Use when code changes are authorized, with or without an existing plan. Excludes planning-only, review-only, and research-only requests.
---

# Build Soundscape changes

Deliver the authorized outcome through implementation and verification. Use an
existing plan when applicable; maintain a separate docs/plans file for substantial
work according to the [plan convention](../../../docs/plans/README.md).

## Establish the boundary

Read [AGENTS.md](../../../AGENTS.md), [README](../../../README.md),
[architecture](../../../docs/ARCHITECTURE.md), and
[quality guidance](../../../docs/references/code-quality.md). Resolve links relative
to this file and run project commands from the repository root. Inspect Git status
and relevant staged, unstaged, and untracked work before edits; preserve unrelated
changes and use the existing checkout.

Read affected implementation, callers, tests, and relevant
[decisions](../../../docs/decisions). Follow shared validation, normalization, and
state through measurements, spectrum, and timeline consumers. Reproduce bugs
when practical; trace causes rather than stacking speculative fixes. Distinguish
observed baseline failures from regressions; do not guess their origin.

## Implement focused changes

- Keep DSP under src/audio independent of React, DOM, Web Audio, and rendering.
  Preserve public behavior, legacy measurement names, units, error classes,
  finite over-range samples, input immutability, and mono/stereo left/right order.
- Prefer precise names, direct control flow, cohesive functions, and explicit
  ownership. Extract a helper for a concrete shared rule; check callers before
  deleting code. Avoid dependencies, restructuring, or product expansion unless
  the task explicitly requires them.
- Inspect analyzer state carefully: borrowed PCM must remain stable, scratch is
  private, metadata is captured, and caller-owned results cannot corrupt later
  calls. Local bounds/finiteness guards do not guarantee concurrent-mutation safety.
- Prefer a failing reproduction before a bug fix. Use independent analytic
  fixtures for mathematical correctness and preserve decision-record tolerances.
  Do not loosen tolerances to hide failures or rely solely on sibling-API agreement.
  For behavior-preserving work, add tests for demonstrated gaps, not implementation
  details or the fact that a variable was renamed.
- Update affected documentation and plan progress. Correct disproven plan
  assumptions with rationale; ask only when the correction changes a material
  contract, scope, architecture, or user experience.

## Verify and finish

Run the commands required by AGENTS.md and configured in package.json: npm ci,
npm test, npm run typecheck, npm run build, and git diff --check. Follow README's
cache/environment guidance if installation needs it. There is no lint script.
Use browser checks when browser flows or compatibility warrant them; measure
performance before making speed claims. Report unavailable tooling accurately.

Review the final diff and relevant callers, using the
[review workflow](../soundscape-review/SKILL.md) for a final self-review. Fix
introduced regressions and rerun affected checks after further edits. Finish
independent authorized work when another part is blocked; keep unresolved
acceptance criteria visible rather than claiming full completion.

Report what changed and why, actual passed/failed/unrun checks, remaining limits,
and plan status. Do not push, merge, or post external feedback without explicit
user authorization. A skill does not grant additional permissions or require
mandatory worktrees, subagents, commits, or approval checkpoints.

Design provenance: [research assessment](../../../docs/references/skill-research.md).
Read it only when revising this workflow or investigating its rationale.
