# Requirements: soundscape-plan

Status: design requirements for the implemented
[planning skill](../../.agents/skills/soundscape-plan/SKILL.md).
Executed evaluations and limits are recorded in the
[implementation plan](../plans/2026-11-01-project-skills.md).
Source IDs and shared requirements C1–C6 are defined in
[the research report](skill-research.md).

## Purpose, trigger, and inputs

Produce a bounded, executable plan for a Soundscape feature, substantial cleanup,
or architectural change. Trigger on a request to plan Soundscape work; a build
may use planning when substantial, but must respect the user's requested mode.
Exclude unrelated repositories and requirements research about the skills
themselves. A tiny change can use a short plan in chat.

Inputs: user outcome and scope; Git status; AGENTS.md; README; relevant product,
architecture, decisions, implementation, callers, tests, and active plan if one
exists. Missing material requirements become explicit questions; routine choices
become stated assumptions rather than automatic approval gates.

## Required behavior

- **P1 — Problem and boundaries:** Explain the concrete problem, observable
  outcome, acceptance criteria, and exclusions. Separate current behavior from
  proposed behavior. Do not silently invent users or product requirements.
  Basis: O2, M1, H1; local PRODUCT.md.
- **P2 — Code and dependency map:** Identify affected modules, public interfaces,
  callers, tests, and shared rules before proposing edits. Explain the ownership
  of new state and results. A list of filenames alone is insufficient. Basis:
  S1, A1, G1; local architecture and decisions.
- **P3 — Contract impact:** State which units, validation rules, errors, bounds,
  tolerances, and compatibility promises the work touches. A deliberate contract
  change requires explicit scope and a decision update, never incidental cleanup.
  Basis: local decisions 001–004; M1, H1.
- **P4 — Design decisions:** Prefer the smallest cohesive approach. Compare
  alternatives only when they change correctness, maintainability, cost, or user
  experience. Identify technical unknowns and a bounded investigation when needed.
  Do not prescribe full code bodies where interfaces and expected behavior are
  sufficient. Basis: S1, M1, G2.
- **P5 — Ordered slices:** Break substantial work into verifiable deliverables
  with dependencies, affected files, and expected checks. Include documentation
  and tests with the behavior they support. Avoid arbitrary task durations or
  splits that leave the repository broken. Basis: S1, G2, H1.
- **P6 — Independent test design:** Connect each acceptance criterion to a check.
  For mathematical changes specify an analytic expectation and explicit tolerance,
  not only agreement with a sibling API. Include relevant empty/invalid/boundary,
  over-range, stereo, ownership, and state-lifetime cases. Basis: M1, G3; local
  quality and numerical contracts.
- **P7 — Verification and resumption:** Use docs/plans for substantial tasks and
  keep progress, decisions, blockers, and next steps current. Name actual project
  commands and conditional browser/benchmark needs. Planned results must not be
  presented as executed. Basis: O2, S2, S3, A3; local plan convention.
- **P8 — Mode-aware handoff:** For planning-only, save and stop. If implementation
  is already authorized, proceed without inventing a second confirmation gate.
  Basis: C1 and the owner's workflow; deliberate adaptation of S1/A1.

## Output contract

A short plan for small work, or one maintained docs/plans file containing the
objective, acceptance criteria, scope, affected components, ordered steps,
risks/decisions, verification, progress, and next steps. Each acceptance criterion
must point to an observable check. Link existing authoritative definitions
instead of repeating the entire numerical specification.

Completion means the plan is coherent and usable, not that its proposed feature
has been implemented or validated.

## Future acceptance scenarios — not yet executed

- **Planning only:** Given a request to plan analyzer cleanup, produce a saved
  plan without modifying runtime code or installing tools.
- **Shared validation:** Given a proposed settings-validation change, trace both
  spectrum entry points and timeline, including short-input and intentional-error
  behavior; preserve documented validation costs and boundary guarantees.
- **Units:** Given a request to rename meanSquareEnergy for clarity, identify its
  compatibility contract and propose documentation or an explicitly scoped API
  migration rather than silently renaming it.
- **Numerical correctness:** Given a spectral change, specify independent DC,
  Nyquist, sine, or Parseval evidence as applicable, with decision-record
  tolerances and conditions under which the identities hold.
- **Ambiguity/proportion:** Given a small comment fix, avoid a multi-page plan;
  given unspecified tail behavior for a new scheduling feature, resolve the
  material question before designing that behavior.
- **Resumption:** A fresh session can identify completed steps and the next
  incomplete step from the plan plus referenced local files.

Reject a future skill that expands product scope, claims planned checks passed,
duplicates stale contracts, or adds mandatory frameworks and delegation.
