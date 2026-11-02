# Research for Soundscape planning, build, and review skills

Research date: November 1, 2026 (America/Toronto).
Status: requirements research completed. The repository-scoped skills are now
implemented; see [implementation and evaluation](../plans/2026-11-01-project-skills.md).
The source assessment below records the research stage, not a comparative
effectiveness benchmark.

## Findings and scope

There is no verified set of skills or requirements used by every major developer
or company. This research compares public source instructions and engineering
guidance from OpenAI, Anthropic, Google, Microsoft, GitHub, and the independent
Superpowers project. Public guidance establishes what those sources recommend,
not universal internal adoption or measured superiority.

The strongest fit is three small Soundscape workflows, sharing existing project
contracts rather than installing an entire methodology:

- [Planning requirements](soundscape-plan-requirements.md).
- [Build requirements](soundscape-build-requirements.md).
- [Review requirements](soundscape-review-requirements.md).

The requirements are this project's synthesis. Source IDs identify their basis;
they do not imply that a source endorses Soundscape or every adaptation here.
No marketplace packages, scripts, or remote instructions were executed.

## Selection method

Candidates were assessed for inspectable primary-source content, clear inputs
and outputs, caller/architecture awareness, verifiable results, handling of
failures, proportionality, and compatibility with Soundscape. Marketplace install
counts, stars, marketing claims, and search snippets were not quality evidence.
No comparative execution benchmark or skill effectiveness evaluation was run.

This is a purposeful shortlist, not an exhaustive survey. Related execution,
testing, debugging, and verification skills were inspected to understand the
dependencies behind the three proposed workflows. Generic vendor documentation
and project-specific templates are distinguished from actual skill files.

## Source register and assessment

Sources below were fetched and inspected. GitHub blob SHAs identify retrieved
file content, not commits. Branch URLs can change; re-fetch and compare the SHA
before copying or building from an upstream file. This report contains original
requirements and attributed paraphrases, not copied skill implementations.

### O1 — OpenAI skill authoring

[Build skills](https://learn.chatgpt.com/docs/build-skills) describes focused
workflows, required name/description metadata, optional resources, progressive
loading, and trigger testing. Use as the packaging reference.

[Skill Creator](https://github.com/openai/skills/blob/main/skills/.system/skill-creator/SKILL.md)
was inspected through line 105, blob
`72bc0b97e7a6476254a9d5c424c9971748402ec3`. Its opening guidance supports concise
instructions, risk-appropriate specificity, and references instead of duplicated
content. This was a partial-file review, not an audit of its supporting scripts.

### O2 — OpenAI planning and repository context

[Best practices](https://learn.chatgpt.com/docs/learn/best-practices) connects goals,
context, constraints, completion criteria, and durable AGENTS.md guidance.
[Execution plans recipe](https://learn.chatgpt.com/cookbook/articles/codex_exec_plans)
offers living plans with observable outcomes and restart context. The recipe is
explicitly archived: use its planning ideas, not its model/API recommendations
or its exact document format as a current platform requirement.

### S1 — Superpowers planning

[writing-plans](https://github.com/obra/superpowers/blob/main/skills/writing-plans/SKILL.md),
blob `4cf0275d88d67aa4ef09f4bbca9970ed6ff74a00`, is the most directly relevant
planning skill inspected. It makes file responsibilities, interfaces, test
expectations, dependencies, and plan self-review explicit. Adapt those decisions;
do not import its mandatory approval handoff or prescribed workflow dependencies.

### S2 — Superpowers execution

[executing-plans](https://github.com/obra/superpowers/blob/main/skills/executing-plans/SKILL.md),
blob `ac77129d7c695734105004b6da10169de8d13df3`, provides task-by-task execution,
progress records, and recorded deviations. Useful for resumption; its worktree,
commit, model-selection, delegation, and one-fix-pass rules are methodology
choices, not Soundscape requirements.

### S3 — Superpowers evidence before completion

[verification-before-completion](https://github.com/obra/superpowers/blob/main/skills/verification-before-completion/SKILL.md),
blob `7d45333cc4a49c57a80df6c1fe2fa777a207afbc`, ties claims to executed checks
and distinguishes tests from builds. Adopt evidence-backed reporting; avoid
requiring reruns merely because a new message was written when relevant files
and environment have not changed.

### S4 — Superpowers debugging and test-first development

[systematic-debugging](https://github.com/obra/superpowers/blob/main/skills/systematic-debugging/SKILL.md),
blob `62fc752aaef59a8bbed5d305f4cadc60f8ae07ed`, emphasizes reproduction, tracing,
hypotheses, and focused fixes. Its numerical claims about diagnostic failure
rates were not verified and are not adopted.

[test-driven-development](https://github.com/obra/superpowers/blob/main/skills/test-driven-development/SKILL.md)
at blob `46838cc9e893c06259e3bdad0fc2425b36242f15`
was inspected for its failing-test/minimal-fix/refactor cycle. Prefer that cycle
for reproducible bugs; reject blanket deletion of already-written code and
ritual tests for documentation or naming changes.

### S5 — Superpowers review handoff

[requesting-code-review](https://github.com/obra/superpowers/blob/main/skills/requesting-code-review/SKILL.md),
blob `68d338a58ecdd8b77bfbb519b781ef223dbbb842`, packages requirements and a base/head
range for a fresh reviewer. Adopt explicit review scope and verification of
feedback. Independent review is valuable when authorized; do not silently
require subagents or assume the last commit represents the whole change.

### A1 — Anthropic feature development

[feature-dev command](https://github.com/anthropics/claude-plugins-official/blob/main/plugins/feature-dev/commands/feature-dev.md),
blob `8bdeda3430e43afddbee79830db0f6ea9dfbf36a`, is a command workflow, not a
portable SKILL.md. It traces execution paths, explores architecture, considers
trade-offs, implements, and reviews. Preserve discovery and architectural
reasoning; its repeated confirmation and multi-agent stages do not fit the
owner's preferred autonomous workflow by default.

### A2 — Anthropic review command

[code-review command](https://github.com/anthropics/claude-plugins-official/blob/main/plugins/code-review/commands/code-review.md),
blob `8d1533fa424c89a2790541fd7687270be3993397`, stresses validated findings,
deduplication, scoped project rules, and explicit permission to post comments.
Its restrictive diff-only/input-independent filters would miss important DSP
boundary defects. Keep high evidence standards while tracing real callers and
reporting demonstrated input-dependent bugs.

### A3 — Anthropic long-running work

[Effective harnesses for long-running agents](https://www.anthropic.com/research/effective-harnesses-for-long-running-agents)
describes incremental progress, artifacts for resumption, and verification of
actual workflows. Adapt progress recording; browser checks apply when a browser
flow changes, not to every pure DSP edit. Its experiments do not establish the
best workflow for this repository.

### G1 — Google review scope and substance

[What to look for in a code review](https://google.github.io/eng-practices/review/reviewer/looking-for.html)
covers design, functionality, complexity, tests, names, comments, documentation,
and wider system context. This is the strongest inspected general review
checklist for Soundscape. Translate it into observable failures and contracts;
personal style preferences should remain nonblocking.

### G2 — Google bounded changes

[Small CLs](https://google.github.io/eng-practices/review/developer/small-cls.html)
supports self-contained changes, associated tests, working intermediate states,
and separation of broad refactoring from feature work. Smallness is conceptual;
do not turn illustrative line counts into a gate.

### G3 — Google behavior-focused tests

[Test Behavior, Not Implementation](https://testing.googleblog.com/2013/08/testing-on-toilet-test-behavior-not.html),
by Andrew Trenk, supports testing public behavior while allowing justified
implementation checks. For Soundscape, mathematical expectations must also be
independent of the implementation; that extra requirement comes from this repo.

### M1 — Microsoft design and test planning

[Design Reviews](https://microsoft.github.io/code-with-engineering-playbook/design/design-reviews/)
supports early decisions, alternatives, architecture documentation, and decision
logs. [Test planning](https://microsoft.github.io/code-with-engineering-playbook/automated-testing/test-planning/)
connects acceptance criteria to positive/negative cases, setup, expected results,
and risk-based test selection. Adapt to a small library; do not require enterprise
ceremonies or a separate document for every test.

### M2 — Microsoft engineering checklist

[Engineering Fundamentals Checklist](https://microsoft.github.io/code-with-engineering-playbook/engineering-fundamentals-checklist/)
connects documented design, review, automated tests, builds, and clear completion
practices. It is Microsoft's ISE guidance, not a survey of all Microsoft teams.
Its suggested coverage percentage, reviewer counts, staging, and observability
requirements are not automatically suitable for this project.

### H1 — GitHub Spec Kit

[Spec Kit README](https://github.com/github/spec-kit/blob/main/README.md), blob
`0d6d47f276feeda1afc2fe98b3ae653cd4b40fb4`, separates specification, planning,
tasks, implementation, and verification, with independent bug-fix entry points.
Useful for traceability; adopting its CLI, extensions, directories, or full
process is unnecessary. README review does not validate every bundled skill.

### H2 — GitHub-hosted community instruction templates

[Generic code review](https://github.com/github/awesome-copilot/blob/main/instructions/code-review-generic.instructions.md),
blob `bcd7365da44cc7d50507fdbe86508649cf62ef04`, offers severity, concrete impact,
specific locations, testing, errors, and architecture checks. Its function-length
limits and broad no-duplication rules are not adopted.

[Spec-driven workflow](https://github.com/github/awesome-copilot/blob/main/instructions/spec-driven-workflow-v1.instructions.md),
blob `2a4cc882738f241bdfd7bbd46a25264d070e720f`, demonstrates requirement-to-design-
to-validation traceability. Reject arbitrary confidence percentages, exhaustive
action logs, automatic issue creation, and mandatory document proliferation.
These are community templates hosted by GitHub, not company-wide policies.

## Shared proposed requirements

The following apply to all three future skills. Local rules are already binding;
online sources help shape workflow, not replace repository contracts.

- **C1 — Scope and authority:** Respect the user's mode and authorized scope;
  read AGENTS.md and relevant contracts first. Planning-only stays planning-only;
  review-only stays read-only. No implicit push, merge, installation, posting,
  worktree creation, dependency addition, or product expansion. Basis: local
  [AGENTS.md](../../AGENTS.md); O1, A2.
- **C2 — Grounded context:** Inspect implementation, callers, tests, and affected
  decisions. Identify observed facts, assumptions, and unknowns separately. Basis:
  A1, G1, O2; [architecture](../ARCHITECTURE.md).
- **C3 — Proportionate process:** Prefer independently understandable changes;
  justify helpers by a real shared rule. Scale planning and tests to risk. Basis:
  G2, O1, S1; [quality guidance](code-quality.md).
- **C4 — Evidence:** Every completion or defect claim has an observable basis.
  Record actual commands/results and limits; passing tests do not prove all
  requirements. Basis: S3, M1, G3; local QA instructions.
- **C5 — Resumption:** Substantial plans record progress, decisions, verification,
  and next steps without depending on chat memory. Basis: O2, S2, A3;
  [plan convention](../plans/README.md).
- **C6 — Maintainable packaging:** Concise SKILL.md with distinct trigger, inputs,
  outcomes, and relevant references. Test correct activation and non-activation
  before rollout. No duplicated numerical specification or unnecessary scripts.
  Basis: O1 and the locally available Skill Creator guidance.

## Soundscape foundation to reference in every workflow

This is a navigation map, not a replacement numerical specification:

- [PCM validation](../../src/audio/pcm.ts): shared data boundary and error classes;
  [decision 001](../decisions/001-audio-measurement.md).
- [Fixtures](../../src/audio/fixtures.ts) and
  [measurements](../../src/audio/measurements.ts): deterministic inputs, peak,
  RMS, and legacy mean-square names; [audio tests](../../src/audio/audio.test.ts).
- [Windowing](../../src/audio/windowing.ts),
  [spectral settings](../../src/audio/spectrum-settings.ts),
  [spectrum](../../src/audio/spectrum.ts), and [bands](../../src/audio/bands.ts):
  normalization, validation, workspace ownership, and frequency boundaries;
  decisions [002](../decisions/002-spectral-analysis.md) and
  [003](../decisions/003-spectral-engine-hardening.md),
  [spectral tests](../../src/audio/spectral.test.ts).
- [Timeline](../../src/audio/timeline.ts): sample-grid scheduling, eager
  validation, lazy computation, and iterator lifetime;
  [decision 004](../decisions/004-time-indexed-analysis.md) and
  [timeline tests](../../src/audio/timeline.test.ts).
- [React demo](../../src/main.tsx) and [scripts](../../scripts): rendering and
  development verification stay outside pure DSP.

Computer-science reasoning should be practical: contracts and invariants,
separation of concerns, dependency direction, ownership/aliasing, state lifetime,
integer bounds, and time/space complexity. Numerical analysis additionally
requires units, finite arithmetic, normalization, and justified tolerances.
No formal proof, performance improvement, or production readiness follows merely
from applying these principles or installing a skill.

## Disagreements and adoption decisions

- **TDD:** Use failing regression tests when practical. Existing meaningful tests
  may be sufficient for a behavior-preserving cleanup. No forced deletion of
  working code to satisfy a methodology. S4 versus local proportionality.
- **Approvals:** Ask only when a missing answer materially changes the result or
  authorization is required. Do not import A1/S1's repeated handoffs when the
  user already authorized implementation.
- **Delegation:** Fresh review can help, but no mandatory model choices or agent
  counts. Follow actual session authorization and available tools. S2/S5/A1/A2
  differ from local execution rules.
- **Review boundaries:** Scope findings to the requested change, but inspect
  surrounding code and callers. Do not suppress reproducible input-dependent
  bugs merely because A2 uses a narrow filter.
- **Metrics:** No invented confidence scores, fixed function sizes, test-count
  targets, or universal coverage thresholds. Measure performance when relevant;
  use coverage to find gaps rather than prove correctness. H2/M2 need adaptation.
- **Process/tooling:** Keep existing docs/plans and decision records. No new CLI,
  dependencies, staging system, or auto-created remote issues. H1/H2 are optional
  examples rather than installation recommendations.

## Limitations and next step

The old OpenAI `skills/.experimental/create-plan/SKILL.md` path returned 404;
the inspected top-level skills directory has no `.experimental` entry. It is
not used as evidence for a current available skill. O2 supplies accessible
planning guidance instead. No claim is made about its historical removal date.

The owner's linked video remains unverified, as recorded in
[code-quality.md](code-quality.md); no video-specific advice is attributed here.
No external skill was installed or behaviorally evaluated during research. The
evaluation cases in the three briefs were proposed acceptance tests; later
executed cases and remaining limits belong to the implementation plan above.

The research handoff was to author three small skills referencing local
contracts, validate metadata and links, then exercise realistic tasks and negative
activation cases in disposable fixtures. Implementation uses repository-scoped
discovery; no extra skills or CORE-CONTRACTS.md were created by the research task.
