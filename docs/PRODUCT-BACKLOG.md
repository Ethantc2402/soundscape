# Frontend product backlog

Updated November 22, 2026. Requested by the owner in chat
`01a203e9-6c76-76a3-9fc7-b4093000e876` so frontend options survive between chats.
This is a decision and deferred-work register, not a claim of implemented
features or approval to build every alternative. The [roadmap](plans/2026-11-16-stereo-mix-visualizer-roadmap.md)
defines broader scope; the [delivery ledger](plans/2026-11-22-autonomous-delivery.md)
tracks execution. The [frequency-view plan](plans/2026-11-22-detailed-frequency-view.md)
holds implementation acceptance criteria.

## Approved first frequency-view policies — implementation pending

- Fixed vertical scale across windows and channels; no per-window normalization.
- Existing power reference: `10 * log10(P / 1)`, labeled dB re 1 squared linear
  amplitude. This does not calibrate a full-level sine peak to 0 dB.
- 100 dB display range, with endpoints **−100 to 0 dB** (question 1A).
  Above-range values receive a marker and retain their actual numeric readout.
- Distinguish exact zero as **Silence** from nonzero values below the display
  range (question 2A). Raw powers remain unchanged.
- Unsmoothed measured frequency points with the existing analysis window
  (question 3A).
- Initial logarithmic frequency range **20 Hz–min(20 kHz, Nyquist)** (question
  4A). The owner chose this after requesting this backlog. Keep the full
  measured spectrum available; the visible range does not redefine DSP output.

## Open first-slice choices — ask before implementation

These preserve the numbered options presented in the owner conversation.
Recommendations are proposals, not owner answers.

- **FE-01 / question 5 — channel presentation.** A: one channel at a time with
  Left/Right selection (recommended). B: overlay both with distinct line styles
  and labels. C: separate stacked graphs. Decide initial channel/reset behavior
  as part of this choice. Goal: compare stereo content without ambiguous labels.
- **FE-02 / question 6 — frequency selection.** A: graph, keyboard-accessible
  selector and numeric readout (recommended). B: those controls plus direct
  pointer/touch selection on the graph. Readouts identify actual measured bins;
  do not imply interpolated pitch. Goal: inspect a peak precisely.
- **FE-03 / question 7 — placement.** A: graph above the existing band results
  (recommended). B: separate Detailed spectrum tab. Goal: balance comparison
  against page length, including narrow screens.
- **FE-04 / question 8 — refresh.** A: reuse the current analysis and shared
  refresh timing (recommended). B: update only on request or seek. Goal: make
  the relationship between playback position, graph and band results explicit.
- **FE-05 / question 9 — rendering.** A: React/SVG using existing dependencies
  (recommended). B: canvas with separate accessible controls/readouts.
  This is a rendering choice, not permission for another analysis engine.
- **FE-06 / question 10 — owner preview.** A: review after the complete slice
  passes automated/browser checks (recommended). B: early working preview and
  another review after verification. Required QA remains required in either case.

## Deferred candidates — retain, specify and prioritize before building

These are alternatives or roadmap candidates to revisit, not a commitment to
implement all of them. No priority or delivery date is approved.

- **FE-07 — frequency range controls.** Offer the focused 20 Hz–20 kHz view,
  all available positive frequencies, and possibly a custom range/zoom. Benefit:
  inspect low-frequency rumble and content outside the initial range without
  replacing the graph foundation. Agree bounds, empty ranges, reset behavior
  and keyboard controls; disclose omitted DC on a logarithmic axis. Full-range
  raw data already exists, but the imported recording's decoded sample rate
  limits what can be shown; this does not restore frequencies lost in decoding.
- **FE-08 — time/frequency zoom and region loops.** Roadmap milestone 3 / AD-006.
  Benefit: move from one window to the inspect → loop → listen workflow.
  Specify selection semantics, window duration/bin spacing and shared playback
  state. Do not imply zoom alone increases measurement resolution.
- **FE-09 — stereo comparison alternatives.** Revisit overlay/stacked views if
  FE-01 starts with a selector. Agree scale consistency, readable channel labels,
  non-color distinctions and mobile layout.
- **FE-10 — optional smoothing or display reduction.** Revisit only with a
  concrete readability need. Agree the mathematical rule, units, peak behavior,
  labeling and raw-bin readout. Pixel aggregation is not DSP resolution.
- **FE-11 — alternate level views.** Possible range presets, user-set limits,
  120 dB range, per-window normalization or test-tone-calibrated display. These
  were discussed alternatives, not required upgrades. Agree reference, labels,
  silence behavior and channel comparison before adding any mode.
- **FE-12 — direct graph interaction and layout alternatives.** If deferred
  from FE-02/03, retain pointer/touch selection and tabs as candidates. Specify
  hit testing, keyboard equivalents, focus and narrow-screen behavior first.
- **FE-13 — song-scale frequency history.** Roadmap milestone 3 / AD-006.
  Define a useful bounded overview and zoom-dependent display representation.
  No full-spectrum history/cache or worker architecture is approved by this
  backlog; measure workloads and agree ownership/resource limits first.
- **FE-14 — explainable overlays and issue navigation.** Roadmap milestones
  4–5 / AD-007–008. Define metric contracts and listening evidence before showing
  markers; a marker should explain its evidence and navigate to the relevant
  region. Do not invent universal mix-quality thresholds.
- **FE-15 — reference comparison.** Optional roadmap milestone 6 candidate.
  Needs separate scope, usefulness validation and an explicit level-matching
  policy; it is not part of the first frequency slice.
- **FE-16 — performance and presentation acceptance.** Agree target device,
  workload and response budget before claiming performance acceptance. Include
  keyboard, screen-reader, reduced-motion and narrow-screen flows. Existing
  Task 006 physical timing/native-memory gates remain open.

## Maintenance and next action

Resume with **FE-01 / question 5**; questions 1–4 are answered. Ask the owner
before every remaining implementation choice, with no timeout assumptions.
The owner's request for a backlog does not delegate those choices.

When an option is answered, update this register and the active plan together.
When deferred work is selected, give it a bounded plan with observable acceptance
before implementation. Mark an item implemented only after its actual checks and
review; keep rejected alternatives as decision history rather than required work.
