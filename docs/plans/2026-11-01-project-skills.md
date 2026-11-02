# Soundscape project skills

Status: completed.

## Objective

Implement the researched planning, build, and review requirements as focused,
repository-scoped skills. Optimize for Soundscape's contracts and the owner's
workflow; make no unmeasured claim of universal optimality.

## Acceptance criteria

- Three distinct skills under .agents/skills have valid metadata and resolve
  references to the existing project instructions and contracts.
- Planning-only and review-only preserve their boundaries; authorized build work
  proceeds through verification without an invented approval gate.
- Shared DSP validation, normalization, ownership, and analytic testing receive
  explicit attention; source specifications remain in existing decision records.
- Independent behavioral checks exercise planning, a small build, a seeded review
  defect, and activation boundaries in disposable fixtures.
- Existing work is preserved; required repository checks run and actual results
  and any limits are reported.

## Scope and decisions

Use .agents/skills, the current documented Codex repository discovery location,
with automatic selection enabled by default. Each skill is instruction-only and
links to repository docs rather than copying formulas or installing a framework.
No runtime changes, dependencies, global skills, remote actions, or worktrees.
The research briefs are design inputs, not runtime instructions to load wholesale.

## Steps

- [x] Read authoring guidance, research requirements, and repository instructions.
- [x] Author and install three focused skills with project references.
- [x] Validate metadata, references, and independent behavior in temporary copies.
- [x] Document usage, run project checks, and review the final changes.

## Verification and progress

Installed instruction-only entrypoints:

- [soundscape-plan](../../.agents/skills/soundscape-plan/SKILL.md): 58 lines.
- [soundscape-build](../../.agents/skills/soundscape-build/SKILL.md): 68 lines.
- [soundscape-review](../../.agents/skills/soundscape-review/SKILL.md): 66 lines.

The bundled Skill Creator quick_validate.py passed for all three. Reviewed all
entrypoints, metadata boundaries, links, and the README usage addition. No scripts,
tool dependencies, global configuration, or explicit-only invocation policy were
added; automatic selection remains the default.

### Independent behavioral evaluation

Three fresh-context evaluators used separate disposable copies under /private/tmp.
They received realistic requests and the skill paths, without intended answers or
the review mutation's identity. Scratch repositories used local baseline commits
only for reproducible diff review; the real repository has no new commits.

- **Planning:** A planning-only shared-settings cleanup request produced only a
  plan. It traced one-shot/session/timeline callers, identified error-order drift
  as a risk, specified characterization and independent numerical evidence, and
  left implementation unexecuted. Inspected the resulting plan and fixture status.
- **Build:** An authorized analytic-test request added one focused combined
  measurement test for stereo constants -0.25 and 3. It asserted exact analytic
  peak/RMS/mean square, metadata, channel identity, and sample preservation.
  Inspected the test diff and confirmed unrelated owner-note.txt survived. The
  evaluator ran fixture-local offline npm ci, 407 tests, typecheck, build, and
  diff checks successfully, followed by an explicitly identified self-review.
  The extra fixture test was not copied into the real codebase.
- **Review:** A one-line mutation exposing the analyzer's private frequency array
  was detected and reproduced without editing the fixture. Editing one result
  corrupted existing/future analyzer and timeline results: bin 1 became -1 rather
  than the independent expected 48000 / 1024 = 46.875 Hz. The reviewer located the
  alias and cited the ownership contract. The seeded defect exists only in scratch.
- **Selection boundaries:** A metadata-only evaluator matched planning, build,
  review-only, and implement-plus-review requests to the intended skills; public
  skill research and unrelated-repository UI work matched none. These six cases
  are simulated judgments, not measurements of desktop automatic selection.

The review evaluator's first in-memory harness needed esModuleInterop; its corrected
reproduction succeeded. Its initial typecheck was blocked by duplicate installed
type-definition names. That run was reported as a failure, not evidence of a code
regression. The real repository's fresh offline install and standalone typecheck
passed. Review-fixture typecheck also passed on retry after that install. No claim
is made about the installation issue's original cause.

### Repository verification

- `npm ci --cache /private/tmp/soundscape-npm-cache --offline`: passed, 100
  packages installed; audit reported zero vulnerabilities.
- `npm test`: passed, 406 tests across three files.
- `npm run typecheck`: passed.
- `npm run build`: passed, including its typecheck.
- `git diff --check`: passed.
- Local references and whitespace: 69 links across nine changed documents passed.
- SHA-256 comparison: 15 pre-existing files outside the intended documentation
  changes were unchanged. No real DSP implementation/test files changed in this task.
- Browser, benchmarks, exhaustive skill scenarios, and live desktop discovery:
  not run. The task changes skills/docs; no comparative optimality claim is made.

## Next steps

Use the skills on real project tasks and refine only when a demonstrated failure
justifies it. Mention `$soundscape-plan`, `$soundscape-build`, or
`$soundscape-review` explicitly when a particular mode is wanted. Runtime skill
selection remains host-dependent; if a new entry does not appear, consult the
[current discovery guidance](https://learn.chatgpt.com/docs/build-skills).
No skill-specific runtime or deployment work remains. Nothing pushed or merged.
