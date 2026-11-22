# Soundscape development guidance

- Keep DSP in `src/audio/` pure TypeScript, independent of React, DOM, Web Audio,
  and rendering. `src/main.tsx` is the small React demonstration; preserve the
  existing module boundaries and mono/stereo left/right order.
- From the repository root, run `npm ci`, `npm test`, `npm run typecheck`,
  `npm run build`, and `git diff --check`. In the cloud workspace, use
  `npm ci --cache /tmp/soundscape-npm-cache` if the default cache is unwritable.
  Claim checks passed only after executing them; report failures and unrun checks.
- Preserve the definitions in `docs/decisions/001-audio-measurement.md`, input
  immutability, finite over-range samples, intentional error classes, and explicit
  numerical tolerances. Use analytic synthetic fixtures to test DSP correctness.
- Attribute any borrowed code, algorithms, or factual references to their original
  sources; retain license notices. Do not invent citations or numerical results.
- Keep changes focused on the requested milestone. Do not add dependencies,
  restructure the repository, or introduce FFT, streaming, services, uploads,
  integrations, or UI redesign without an explicit task requiring them.
- Inspect Git status before edits and preserve unrelated work. Cloud tasks already
  have isolated checkouts; use the existing checkout and do not create a worktree
  unless requested. Do not push or merge without explicit user approval.

## Project context and workflow

Soundscape is a pure TypeScript audio measurement foundation with a React demo. See [README](README.md) for setup, commands, module boundaries, and numerical contracts; [Product](docs/PRODUCT.md), [Architecture](docs/ARCHITECTURE.md), and [Plans](docs/plans/README.md) for maintained context. No lint script is configured.

## Planning

- Read relevant instructions, docs, implementation, and tests before proposing changes.
- For substantial work, maintain a separate plan in `docs/plans/` with observable acceptance criteria and short implementation and verification steps. Update progress and next steps so another chat can resume.
- Keep planning proportionate for small fixes. The owner's latest rule is to ask and wait before every implementation choice, including routine reversible choices. Present one focused question with a recommendation and short tradeoff; wait for an explicit answer before dependent implementation. No timeout defaults or inferred consent. Read-only inspection and verification may continue. This rule overrides earlier assumption guidance in prompts and skills; choices explicitly settled by the owner do not need reapproval.
- When asked for planning only, stop before implementation.

## Cloud delivery and owner communication

- Ongoing sequential delivery runs in Codex Cloud. Read
  `docs/CLOUD-DEVELOPMENT.md`, `docs/prompts/autonomous-delivery.md`, and the
  current `docs/plans/2026-11-22-autonomous-delivery.md` ledger before resuming.
- Discover the current repository root; do not depend on laptop paths, local
  project IDs, local chat history, or personal skills outside the repository.
  Use the four repository workflows for plan, build, review, and walkthrough.
- Keep phase updates short, explain the user benefit first, and ask one choice
  at a time in the active cloud chat so the owner can respond from a phone.
  In-chat messages do not prove push delivery; notification settings and a real
  phone notification test remain separate checks.
- Successors must run in Cloud and start from the exact published handoff commit.
  Never silently create a local successor. If cloud creation, trusted user
  authorization, or publishing permission is unavailable, save the handoff and
  report the blocker rather than claiming automatic continuation succeeded.

## Implementation

- Follow established strict TypeScript patterns, pure DSP module boundaries, and analytic fixture tests; prefer existing utilities and dependencies.
- Make focused changes, preserve unrelated work, and handle relevant edge cases and failures.
- Update docs when behavior, architecture, or setup changes. Distinguish implemented behavior from proposals.
- Continue through implementation and QA when both are authorized. Avoid unnecessary tooling, dependencies, and process.

## QA and completion

- Reproduce bugs before fixing when practical; add meaningful regression tests for behavior changes.
- Run relevant tests, lint, type-checks, and builds as appropriate. Exercise changed user flows when supported.
- For UI work, check relevant screen sizes, keyboard access, and loading, empty, error, and success states.
- For API/data work, check validation, authorization, failure handling, and compatibility where relevant.
- Review the final diff for unintended changes and correctness; fix failures introduced by the work and distinguish pre-existing failures.
- Never claim a check passed unless it ran and passed. Report exact blockers and anything unverified.
- At completion, summarize changes and reasons, checks and results, limitations, risks, and decisions needed. Update the active plan to completed or record next steps.

## Code quality reference

- Consult [code quality and review context](docs/references/code-quality.md) for
  the owner's video reference and the repository-specific cleanup checklist.
  Preserve its source-verification status; do not attribute unverified advice to
  the video. Base cleanups on concrete problems and the existing DSP contracts.

## Ongoing code quality

- Apply the project-specific principles in
  [code quality context](docs/references/code-quality.md) to all new and changed
  code. Prefer precise names, direct control flow, cohesive functions, explicit
  ownership, and comments that explain constraints or reasons.
- Introduce abstractions for concrete shared rules, not speculative reuse. Check
  callers before removing code; preserve public contracts during cleanup. For
  example, retain documented measurement names even when a different name seems
  clearer, and explain their units rather than silently renaming the API.
- Review shared validation, normalization, and analyzer state in proportion to
  their impact. Use independent analytic evidence for mathematical correctness;
  consistency between APIs alone is insufficient.
- Use [the reusable cleanup prompt](docs/prompts/codebase-cleanup.md) when a
  dedicated cleanup is requested. These standards do not authorize unrelated
  refactoring during other milestones.
