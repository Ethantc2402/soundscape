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
