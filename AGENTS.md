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
- Keep planning proportionate for small fixes. Ask only questions that materially affect correctness, scope, architecture, or user experience; otherwise state reasonable assumptions and proceed.
- When asked for planning only, stop before implementation.

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
