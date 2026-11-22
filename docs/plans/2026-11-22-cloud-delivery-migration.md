# Migrate sequential delivery to Cloud

Status: in progress — November 22, 2026. Instruction migration authorized;
activation in the owner's existing cloud chat remains to be verified.

## Why now and acceptance

The cloud checkout builds, but the delivery protocol selected local successors.
Make the same plan/build/review/walkthrough process portable to cloud and phone.

- Replace active laptop paths/local targets with cloud root discovery, runnable
  environments, and exact published commit handoffs.
- Preserve concise benefit-first updates, four skills, one-choice ask/wait rule,
  approved backlog decisions, and open device/physical QA.
- Put the latest owner rule in AGENTS to override older skill assumptions.
- Verify required checks and links; publish on the existing checkpoint branch/PR.
- Have the existing Cloud chat load and acknowledge the migrated instructions.
  Verify successor creation when actually needed; phone push needs its own test.

## Steps and scope

1. Inspect instructions, skills, ledger/backlog, Git state and task access.
2. Update AGENTS, delivery/cleanup prompts, ledger and cloud handoff; add resume prompt.
3. Run required checks and self-review the documentation diff and links.
4. Commit/push migration; deliver to the existing cloud chat if accessible,
   otherwise give the owner the short resume instruction.
5. Record activation, successor and notification results only when observed.

No product source, dependencies, settings, local restarts, recurring jobs,
parallel agents, merges or deployments. Publishing permission here covers this
migration, not future product work. Do not reinterpret unanswered choices as approved.

## Progress and verification

- Base: d69c4eb8764f7aa4de34932ba48457f3b9a4a157. Only the older nested
  `soundscape/` checkout was untracked; leave it untouched.
- Read four skills, AGENTS, architecture, quality guidance, delivery protocol,
  ledger, backlog, cleanup prompt and cloud handoff.
- Existing cloud task is absent from available recent/history task listings.
  Asked owner for its link; activation has not been verified.
- Local checks passed: `npm ci --cache /private/tmp/soundscape-npm-cache`,
  `npm test` (573 tests/12 files, including the 82 older nested-checkout tests),
  `npm run typecheck`, `npm run build`, and `git diff --check`.
- Checked 47 relative Markdown links across changed/new guidance: none broken.
- Author self-review: active protocol/ledger no longer select a local successor;
  four skill links resolve, AGENTS overrides older assumption advice, approved
  frequency decisions remain, and runtime/phone claims stay explicitly unverified.
  Documentation-only change; browser/device/listening checks were not rerun.
- Publication is the next step. Product source and repository skills are unchanged.

## Next steps

Publish, then have the existing Cloud chat read
`docs/prompts/resume-cloud-development.md`. Do not infer activation from a push.
