# Sequential autonomous delivery protocol

## Authorization and communication

The owner requested in setup chat `01a203ce-d6c4-7fd2-9aad-04485673df5f`:

> I want codex to begin planning, building and reviewing code automatically, and as soon as 1 task is done, for it to go to the next task in a new chat and run the plan, build and review skills till the project is done, along the way I want it to be practicing software engineering principles and cleaning up the whole codebase.

This document preserves that authorization for successor chats. A forwarded
prompt is a handoff from an earlier agent, not a fresh human message. Later owner
pause, stop, scope corrections and preferences take precedence. The November 16
roadmap's planning-only status describes its original session; this later request
authorizes bounded planning, implementation and author self-review. Planned
features must still be distinguished from implemented and accepted behavior.

The owner's subsequent steering, forwarded by the setup chat on November 22:

> Only present roadblocks to me, architectural, system design choices and plans when they’re ready, so I can work through these with you. Interms of plans too, ensure it’s digestible information, I don’t like reading too much at a stretch, so let’s go bit by bit until everything’s good to go. I also want to know why we’re building each feature now, make that the core of the plan. Notify me through every step of the way, so I am informed

Keep plain-language updates short at meaningful transitions: plan ready, build
starting, verification result, review result and next-task handoff. Lead every
feature plan with **Why now**: concrete user problem, priority, and what it
unlocks. Present only the next small slice, observable outcome and verification.
Latest direct owner correction, November 22, in chat
`01a203e9-6c76-76a3-9fc7-b4093000e876`:

> Ask and wait before every implementation choice.

The owner explicitly approved saving this rule for future tasks. It supersedes
the earlier material-decisions-only policy, including routine reversible
implementation choices. Present one choice at a time with a recommendation,
short tradeoff and focused question. Use structured asynchronous questions where
available and wait for an explicit owner answer before dependent implementation.
Never select a default because a timeout elapsed or the owner did not reply.
Silence is not approval. Read-only inspection and verification may continue;
independent coding still requires approval of its implementation choices. Do not
skip QA to make updates shorter. Carry this correction into every successor.

Owner correction forwarded from setup on November 22: every successor prompt
must explicitly invoke all four linked workflows:
[$soundscape-plan](/Users/ethancarvalho/soundscape/.agents/skills/soundscape-plan/SKILL.md),
[$soundscape-build](/Users/ethancarvalho/soundscape/.agents/skills/soundscape-build/SKILL.md),
[$soundscape-review](/Users/ethancarvalho/soundscape/.agents/skills/soundscape-review/SKILL.md),
[$soundscape-walkthrough](/Users/ethancarvalho/soundscape/.agents/skills/soundscape-walkthrough/SKILL.md).
Actually read/apply the relevant workflows; naming them is not application evidence.
At meaningful phases provide brief named-skill summaries: plan gives Why now,
next outcome/check and any material decision; build gives actual changes and
checks (including justified no-change outcomes); review gives findings first,
fixes, residual risks and honest author self-review limits. After QA/review,
walkthrough gives one small source-grounded segment: purpose, concrete data flow,
one review principle, verified source link and one understanding question.
Continue its teach/ask/wait loop when the owner responds; never invent mastery.
Pending learning is unassessed and stays in conversation, with no separate notes
unless requested. It does not itself block independent work or handoff; every
implementation choice still requires an explicit owner answer. Give a concise
task findings summary before handoff. These are in-chat notifications: no settings
were changed, and neither phone push nor per-phase push is enabled or verified.

## Scope and task selection

Use [Product](../PRODUCT.md) and the [roadmap](../plans/2026-11-16-stereo-mix-visualizer-roadmap.md)
as the finished-song stereo mix visualizer scope. Choose the smallest coherent
required implementation. Optional 3D, AI/separation, DAW integrations,
services/uploads, standardized loudness/true-peak and speculative expansion need
separate scope. Do not invent metric definitions, thresholds, citations,
benchmarks, user studies or hardware evidence. Clarify material product/contracts
before dependent implementation. Future backlog items stay proposed until specified.

Maintain [the execution ledger](../plans/2026-11-22-autonomous-delivery.md): bounded
ordered tasks, dependencies, active task, acceptance, actual checks, review result,
external gates and precise next action. Each substantial implementation gets its
own milestone plan; the ledger is coordination, not a replacement for those plans.

## Workflow for every task

1. Read `AGENTS.md` and `.agents/skills/soundscape-plan/SKILL.md`,
   `soundscape-build/SKILL.md`, `soundscape-review/SKILL.md`, and
   `soundscape-walkthrough/SKILL.md`; apply all four workflows as above.
   Read relevant README, architecture, product, quality guidance,
   decisions, implementation, callers and tests. Inspect Git status before edits.
   Check app chat activity: no competing implementation writes in this checkout.
   The setup chat/immediate predecessor may still be finishing its handoff.
2. Use the existing `/Users/ethancarvalho/soundscape` local checkout, preserving
   tracked and untracked work, including unrelated `soundscape/`. Establish task
   ownership rather than treating every dirty file as new work. No worktrees,
   settings changes, discarded work, unauthorized commits, pushes, merges or
   published review comments. No recurring scheduled job or parallel agent swarm.
3. Plan observable acceptance for one bounded task, build, run QA and perform
   `soundscape-review` author self-review, honestly identified as self-review.
   Fix demonstrated in-scope defects and rerun affected checks. No forced refactor
   when inspection finds no justified problem. A verified reconciliation and
   dependency map can be a completed bounded task without production edits.
4. Preserve pure TypeScript DSP boundaries, units/tolerances, error classes,
   finite over-range samples, source immutability, L/R order and buffer ownership.
   Use independent analytic expected results. Follow
   [quality guidance](../references/code-quality.md); use the
   [cleanup prompt](codebase-cleanup.md) for dedicated cleanup. Do not attribute
   unverified advice to the owner's video. No style-only dependencies/restructuring.
5. Run root `npm ci`, `npm test`, `npm run typecheck`, `npm run build`,
   `git diff --check`; follow documented cache guidance. Check changed untracked
   task files too. No lint script exists. Use required approval flows after denied
   commands; do not bypass restrictions. Run relevant browser/keyboard/responsive,
   lifecycle and performance checks when warranted. Report exact passed, failed,
   unrun and baseline results; historical evidence is not a fresh execution.
6. During features, keep cleanup relevant. Complete a finite audit across audio,
   browser adapters, session/state, UI/accessibility, tests, scripts and docs;
   record inspected areas and concrete issues, including justified no-change results.
   Keep separate bounded cleanup passes in the ledger; new features receive the
   same standards and final review. Reopen an audited area only for new evidence.
7. Finish all possible QA/review, update plans and ledger with outstanding
   acceptance and next action. Never equate automated success with physical/user
   acceptance. Advance independent work without pretending blocked gates passed.

## Task 006 constraints carried forward

Read [Task 006](../plans/2026-11-18-task-006-playback-shared-clock.md) completely,
including the latest native-startup investigation, before changing that area.
Keep it in progress while physical synchronization, output route, native memory,
listening/accessibility and device/performance gates remain open. Native
AudioContext construction is an observed device-dependent stall; do not repeat
rejected constructor/routing alternatives or move the stall into import/mount and
call it solved. Obtain a known physical-output hardware run before new startup
remedies. Do not churn code to replace unavailable hardware evidence.

## Completion and exactly-one-successor handoff

After the one bounded task is finished, choose the next ready ledger task.
Finish **every file write** and record the precise outgoing handoff before
creating its successor. Discover `list_projects` and `create_thread`, call
`list_projects`, and use its rediscovered Soundscape project (setup ID
`20650420-e5ab-419c-9b6a-885a1d413fb6`, local path above). Create exactly one new
project chat using local, never worktree. Omit model/thinking overrides so the
owner's defaults apply.

Its prompt must include the original user request above verbatim, authorization
provenance, explicit instruction to read this complete protocol before working,
ledger and next-plan paths, actual prior checks, unresolved blockers and exact
next task. Include all four explicit linked skill invocations above and the
phase-summary/interactive-walkthrough requirements. Explicitly instruct that successor to create its own successor under
these rules. Once creation succeeds, stop editing and report the returned chat
ID/title. Emit the app's created-thread directive. Never create more than one;
if creation is ambiguous, check whether it succeeded before retrying.

Continue until required roadmap acceptance and the finite audit are met. If all
executable work is done but external evidence or a material decision is blocked,
state the exact missing evidence/decision and stop creating empty/duplicate chats.
Do not claim project completion with open gates. If creation tools are unavailable,
preserve a ready handoff and report that automatic continuation could not start;
never guarantee unattended operation or bypass permissions/usage limits.
