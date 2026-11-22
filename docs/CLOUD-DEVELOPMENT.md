# Cloud development handoff

## Shared source of truth

Use [Ethantc2402/soundscape](https://github.com/Ethantc2402/soundscape) for source,
project instructions, repository skills, plans, and reviewable changes. Cloud
tasks use their own checkout; a local conversation and uncommitted laptop files
do not automatically move there. Commit and push work before switching hosts.

The November 22, 2026 migration checkpoint preserves the laptop's in-progress
work on `checkpoint/cloud-handoff-2026-11-22`. It is a continuation point, not
acceptance of the unfinished milestones. The older nested `soundscape/` checkout
is separate, has its own local edit, and is excluded from this checkpoint.

## Environment setup

Connect the repository to Codex Cloud under the same ChatGPT account/workspace
used on your phone. Use Node >=22.12.0 and npm; install from the lockfile:

```sh
npm ci --cache /tmp/soundscape-npm-cache
npm test
npm run typecheck
npm run build
git diff --check
```

The application needs no credentials, database, or backend. Repository access
and package downloads must be available during setup. Keep credentials in the
environment's secret controls rather than source files. Optional browser checks
require Chrome/Chromium, as described in the repository README.

Read `AGENTS.md` and the relevant `.agents/skills/` workflow in each task. Start
with the checkpoint branch until its work has been reviewed and merged; starting
from `main` alone omits that work. Use one branch per bounded follow-up change.
Push or open pull requests only when authorized; never merge automatically.

## Continue from a phone

For migrated sequential delivery, use
[the resume prompt](prompts/resume-cloud-development.md) and
[delivery protocol](prompts/autonomous-delivery.md). In the existing clean cloud
checkout, fetch and fast-forward `checkpoint/cloud-handoff-2026-11-22` to the
latest published commit first. Preserve new work and report divergence instead
of resetting it. A push alone neither updates an active task nor starts its loop.

In the ChatGPT mobile app, use the same account/workspace, open Codex, choose
Cloud, and reopen the same cloud task to retain its working state. Review changed
files, test results, and open decisions there. Starting another task creates a
separate workspace; name the repository, branch, and relevant plan explicitly.
Cloud work does not require the laptop to remain online. Important work still
needs source control; saved task state is not a permanent backup.

## Current product handoff

- Playback/shared clock: see
  [Task 006](plans/2026-11-18-task-006-playback-shared-clock.md). Physical audio
  synchronization, native startup, and device/performance acceptance remain open.
- Follow-up delivery and decisions: see
  [the coordination ledger](plans/2026-11-22-autonomous-delivery.md) and
  [detailed frequency view](plans/2026-11-22-detailed-frequency-view.md).
  Read their current decisions before choosing implementation work.
- Keep local listening and physical-output checks on a device with real audio
  output. Cloud unit tests and builds cannot establish those acceptance criteria.

## Reusable Soundscape environment

On web or desktop, choose **Work in > Cloud > Select environment > Create
environment**, or **Settings > Codex Cloud > Environments > Create environment**.
Connect `Ethantc2402/soundscape`, name the environment Soundscape, and use Node
>=22.12.0 plus the installation/check commands above. Until reviewed and merged,
select `checkpoint/cloud-handoff-2026-11-22` if a branch selector is available;
otherwise explicitly check out that branch during setup. Review the setup report
and publish the environment. On mobile select it for new tasks. The existing
verified default-environment chat can continue without another environment.

The environment supplies code/tools; AGENTS and the delivery protocol supply
project rules. Every new task must verify the handoff branch and commit. Local
chat history and personal skills are not automatically copied. All four
Soundscape skills are committed under `.agents/skills/`.

## Migration verification

Record local checkpoint checks and the cloud task's actual checkout and checks
in the migration conversation. A saved environment listed as non-runnable is not
evidence of a working cloud checkout. Phone access must be confirmed on the phone.

Sources: official [cloud environment documentation](https://learn.chatgpt.com/docs/environments/cloud-environments)
and [mobile documentation](https://learn.chatgpt.com/docs/mobile), checked November
22, 2026. Mobile availability depends on account rollout and workspace settings.
