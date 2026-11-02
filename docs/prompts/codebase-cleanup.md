# Codebase cleanup prompt

Copy the prompt below into a chat working in this repository. Optionally name a
module or milestone to narrow the cleanup. Ongoing coding standards also live in
AGENTS.md and apply without rerunning this prompt.

---

Clean up this codebase and apply the same quality principles to code you write
throughout this task. Implement and verify the cleanup; do not stop at suggestions.

Read AGENTS.md, README.md, relevant architecture and decision records, and
`docs/references/code-quality.md`. The linked video's contents remain unverified:
use the documented project principles without inventing video takeaways.

1. Inspect Git status and preserve unrelated work. Read implementation, callers,
   and tests before editing. Identify concrete correctness or maintainability
   problems, such as unclear units, misleading names, duplicated rules that can
   drift, unnecessary state, or error handling that hides failures. Do not assume
   that every repetition needs an abstraction.
2. Select a bounded set of improvements within the requested scope. Explain each
   problem and observable outcome briefly. For substantial work, maintain a
   separate plan in docs/plans/ with acceptance criteria and progress. Proceed
   using reasonable assumptions; ask only when an answer materially affects
   correctness, scope, architecture, or user experience.
3. Prefer direct control flow, precise names, explicit data ownership, and small
   cohesive functions. Extract helpers when they clarify a real shared rule.
   Remove dead code only after checking references. Write comments explaining
   constraints and reasons rather than restating the code. Avoid speculative
   frameworks, dependencies, unrelated formatting, and repository restructuring.
4. Preserve public behavior, numerical definitions and tolerances, intentional
   error classes, finite over-range samples, input immutability, and mono/stereo
   ordering. Keep DSP pure TypeScript under src/audio/. Review shared validation,
   normalization, and reusable analyzer state more closely because their effects
   reach multiple consumers. Do not change a contract as incidental cleanup.
5. Reproduce bugs when practical and test changed behavior with independent
   analytic fixtures. API-to-API comparisons alone do not prove the mathematics.
   Cover relevant boundaries and ownership failures. Do not add tests solely to
   mirror implementation, or claim speed improvements without measurements.
6. Run npm ci, npm test, npm run typecheck, npm run build, and git diff --check
   from the repository root, following repository cache guidance if necessary.
   Run additional browser or benchmark checks when the changes warrant them.
   Inspect the final diff and fix regressions introduced by the cleanup.
7. Report what changed and why, actual check results, and any remaining risks or
   blockers. Update the plan if used. Distinguish pre-existing failures from new
   failures. Do not push or merge.

Keep the cleanup focused. If inspection finds no justified change in scope,
report that finding rather than manufacturing a refactor. Continue applying these
standards to subsequent implementation in this task.
