# Code quality and review context

## User-selected reference

[Video supplied by the project owner](https://www.youtube.com/watch?v=b2QkhmQ0sT0).
Added November 1, 2026 to inform future code cleanup and development.

Source status: the video and transcript could not be retrieved in this session.
No summary, quotations, timestamps, or speaker recommendations have been verified.
Read the video or a supplied transcript before attributing specific advice to it.
The practices below are project-specific guidance drawn from the existing repository
contracts, not a summary of the video. The reference does not override those contracts.

## Applying this context to Soundscape

For each cleanup, identify a concrete problem and an observable improvement before
editing. Prefer a small change that a reviewer can understand and revert. Avoid
rewrites motivated only by style, speculative abstractions, or reducing line count.

Review shared DSP and validation carefully: changes can affect every consumer.
Check units, normalization, error classes, channel order, input ownership, and
numerical tolerances against the decision records. Check reusable analyzer state
and returned-array ownership when touching spectral sessions. Keep rendering
changes inside the demonstration boundary.

Use independent analytic expectations to validate mathematics. Comparing two APIs
is useful for consistency but cannot establish correctness if both share the same
mistake. Preserve meaningful edge cases such as silence, signed over-range input,
malformed PCM, frame boundaries, and stereo isolation. Add regression coverage for
changed behavior; do not add tests that merely repeat implementation details.

Before calling a cleanup complete, review the diff, run the required repository
checks, and report their actual results. Explain the concrete improvement, retained
contracts, and remaining limits. Do not infer performance improvements from shorter
code; benchmark when performance is the stated objective.

## Next cleanup pass

Once the source is available, record verified takeaways with timestamps or short
attributed excerpts, then inspect implementation and tests for specific gaps.
Select a bounded cleanup, document acceptance criteria for substantial work, and
implement and verify it. No runtime refactor has been justified by this unverified
reference alone.

## Reusable prompt and ongoing use

Use [the codebase cleanup prompt](../prompts/codebase-cleanup.md) for an
implementation task. AGENTS.md carries the ongoing coding standards so future
repository work uses them without pasting the prompt each time. The prompt is
usable with the project principles now; video-specific guidance still requires
verification of the source.
