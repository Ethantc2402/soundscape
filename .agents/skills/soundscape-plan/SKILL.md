---
name: soundscape-plan
description: Plan Soundscape features, substantial DSP changes, or focused cleanups using the repository's contracts and analytic acceptance criteria. Use for planning requests and the planning phase of substantial authorized implementation. Excludes skill research and unrelated projects; planning-only requests do not authorize implementation.
---

# Plan Soundscape work

Turn the requested outcome into the smallest coherent plan another session can
resume. Keep a small fix proportionate; use a separate docs/plans file for
substantial work, following the [plan convention](../../../docs/plans/README.md).

## Establish context

Read [AGENTS.md](../../../AGENTS.md), [README](../../../README.md),
[architecture](../../../docs/ARCHITECTURE.md), and
[quality guidance](../../../docs/references/code-quality.md). Resolve these links
relative to this skill file; execute project commands from the repository root.
Read [product context](../../../docs/PRODUCT.md) when deciding product scope.
Inspect Git status, affected implementation, callers, tests, and relevant
[decision records](../../../docs/decisions) before proposing edits.

Use the architecture map to follow PCM validation → measurements or spectral
settings/windowing → spectrum/bands → timeline; rendering stays in the React demo.
For shared validation, normalization, or session state, trace every consumer.
Identify state owners, borrowed input buffers, returned arrays, and lifetimes.

## Write an executable plan

- Explain the concrete problem, intended observable outcome, exclusions, and
  current versus proposed behavior. Separate evidence, assumptions, and unknowns.
- Identify affected files and interfaces, callers, and contract impact: units,
  error classes, bounds, channel order, ownership, and numerical tolerances.
  Treat intentional contract changes as explicit scope, never incidental cleanup.
- Prefer the smallest cohesive design. Compare alternatives or propose a bounded
  spike only where a real uncertainty or trade-off changes the decision.
- Order independently verifiable slices with dependencies, tests, and docs.
  Specify interfaces and expected behavior without writing unnecessary code bodies.
- Connect each acceptance criterion to an observable check. Mathematical changes
  need independent analytic expectations and explicit, justified tolerances;
  API-to-API agreement alone is insufficient. Select relevant invalid, boundary,
  finite over-range, stereo, ownership, and lifecycle cases from the decisions.
- Name the required verification commands from repository guidance; explain when
  browser or benchmark evidence is needed. Mark proposed results as unexecuted.
- Self-check coverage and interface consistency. Record decisions, progress,
  blockers, and next steps so another session can resume from local files.

Ask only about missing information that materially changes correctness, scope,
architecture, or user experience. State reasonable routine assumptions. For
planning-only, save the plan and stop. When implementation is already authorized,
continue into implementation without inventing another confirmation gate.

## Deliver

Link the plan and state its scope, material decisions, and unresolved questions.
A finished plan is not an implemented or verified feature.

Design provenance: [research assessment](../../../docs/references/skill-research.md).
Read it only when revising this workflow or investigating its rationale.
