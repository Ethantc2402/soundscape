# Guided review and understanding skill

Status: completed.

## Objective and scope

Add a repository-scoped skill for the owner's post-QA code walkthrough: explain
the actual code in small steps, teach how to review it, and assess understanding
through answers and transfer exercises. Keep production code and Task 003's QA
record unchanged. Skill creation does not start the lesson or certify learning.

## Acceptance criteria

- Distinct teaching trigger and valid metadata; existing code-review skill keeps
  its defect-review role.
- Read actual source, task/decision records, and QA evidence; distinguish recorded
  checks from newly executed checks and stale or missing QA.
- Explain purpose, data/control flow, contracts, mathematical evidence, ownership,
  and relevant computer-science principles with verified source locations.
- Teach one manageable concept at a time; ask one assessment question, wait for
  the answer, give specific feedback and hints, then reassess with a fresh case.
- No answers revealed in the same turn as assessment, fabricated learner replies,
  unearned understanding scores, mandatory edits, or automatic milestone signoff.
- Validate references/metadata and independently simulate opening and feedback
  turns. Run required project checks and preserve unrelated work.

## Steps

- [x] Inspect existing skills, current QA record, architecture, and authoring guidance.
- [x] Author/install walkthrough skill and document invocation.
- [x] Evaluate pacing, feedback, transfer, and scope in isolated conversations.
- [x] Run checks and record results/limits.

## Verification and next steps

Installed [soundscape-walkthrough](../../.agents/skills/soundscape-walkthrough/SKILL.md)
and added a README invocation example. No scripts, dependencies, global settings,
code changes, or changes to existing skills/Task 003 QA records.

The bundled Skill Creator quick_validate.py passed for the installed skill.
Source links, scope, teaching flow, and final diff were reviewed. Before this
completion update, 18 local links across the skill, README, and this plan resolved;
final documentation checks include the new entrypoint link below.

An independent fresh-context evaluator read the real sources and skill, with a
novice Task 003 learner request. It received no expected lesson or answers. Three
learner-facing turns were inspected:

- Opening: linked current code/tests and recorded QA, distinguished historical
  results from newly executed checks, explained one scheduling concept with an
  example, and ended with one unanswered question.
- Simulated incorrect answer: identified an added off-grid final-window
  misconception, explained the grid/bounds rules, gave specific feedback, and
  asked a focused retry without advancing the lesson or claiming mastery.
- Simulated corrected answer: acknowledged the reasoning and introduced a new
  overlapping-window transfer question. It left transfer understanding unassessed
  and stopped without revealing the answer or inventing a learner response.

The evaluator performed read-only inspection; no real learner was assessed. Later
topics, skipping/pause behavior, the final review exercise, long-session retention,
and desktop automatic selection were not behaviorally tested. These remain limits,
not evidence of learning or universal teaching effectiveness.

Repository checks executed from the root:

- `npm ci --cache /private/tmp/soundscape-npm-cache --offline`: passed, 100 packages
  installed; audit reported zero vulnerabilities.
- `npm test`: passed, 409 tests across three files.
- `npm run typecheck`: passed.
- `npm run build`: passed, including its typecheck.
- `git diff --check`: passed.
- SHA-256 comparison: all 23 pre-existing files except the intentionally extended
  README were unchanged. Task 003's existing implementation and QA work preserved.
- Browser and benchmarks: not run; only a skill and documentation changed.

Use `$soundscape-walkthrough` after QA when the owner wants to begin. No lesson
has started for the owner and no learning result or milestone signoff is recorded.
Nothing committed, pushed, or merged.
