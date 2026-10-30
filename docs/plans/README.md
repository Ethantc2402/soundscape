# Task plans

Use a separate Markdown file for each substantial task, such as `YYYY-MM-DD-short-task-name.md`. Small fixes can use a short in-chat plan. Read [AGENTS.md](../../AGENTS.md), relevant docs, code, and tests first.

Keep plans short and current. Separate tasks must not share a single rolling plan. Preserve completed plans as context; update progress after meaningful milestones and before ending a work session.

## Suggested format

```markdown
# Task title

Status: planned | in progress | blocked | completed

## Objective
Problem and intended observable outcome.

## Acceptance criteria
- Observable conditions that define completion.

## Scope
Included work and explicit exclusions.

## Affected components
Relevant docs, implementation, tests, and integrations.

## Implementation steps
- [ ] Focused steps in dependency order.

## Risks and decisions
Relevant edge cases, compatibility concerns, assumptions, and open decisions.

## Verification
Commands and manual flows, expected results, and actual outcomes.
Record exact setup/credential blockers and distinguish pre-existing failures.

## Progress
Completed steps, findings, and remaining work.

## Next steps
Immediate resumption instructions, or completion summary and remaining limitations.
```

For planning-only requests, stop before implementation. Otherwise proceed through authorized implementation and QA, then mark the plan completed only when acceptance criteria are met or clearly record remaining work.

## Baseline history

The initial local folder was empty. On October 30, 2026, it was connected to the existing Soundscape repository, preserving its Git history, code, and contributor instructions. Earlier empty-folder observations no longer describe the environment.

Use package.json and README as command configuration sources. No lint script exists. Runtime verification results must be recorded when executed; command availability alone does not establish a pass.

## Local connection verification — October 30, 2026

Completed: repository history and origin connected; upstream guidance preserved and merged with the local workflow. Documentation reflects existing code. Node v24.4.0 and npm 11.4.2.

- `npm ci --cache /private/tmp/soundscape-npm-cache`: passed with network approval after sandbox DNS failures; audit reported zero vulnerabilities.
- `npm test`: passed, 352 tests across two files.
- `npm run build`: passed, including `npm run typecheck`.
- `git diff --check` and documentation local-link checks: passed.
- Browser smoke check, benchmark, and manual UI flows: not run for this repository connection and documentation task. No lint script exists.
- These setup documents are committed locally as part of the setup task; nothing was pushed.

Next: clarify the next product milestone before application changes.
