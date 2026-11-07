# Task 004 — Frequency-band power over time

**Status** Completed on November 6, 2026

## Objective

Add a static 2D heatmap to the React demo so a reader can see which frequency
bands carry power in each window of one built-in mono recording. The page
currently shows time-domain measurements for a separate one-second sine. Keep
that example and add the heatmap below it.

## Fixture and expected result

- Allocate one zero-initialized mono `Float32Array` of 24,576 samples at
  40,960 Hz. Use `sineWave` to fill samples `[0, 8192)` with a 150 Hz sine at
  amplitude 1 and samples `[16384, 24576)` with a 3,000 Hz sine at amplitude
  0.5. Leave `[8192, 16384)` silent. Both tones start at phase zero.
- Call `createSpectrumTimeline` with `fftSize: 4096` and `hopSize: 4096`,
  letting the observation length default to 4,096. The six full, adjacent
  windows each span 0.1 s and land entirely inside a single segment.
- The bin spacing is 10 Hz. For each bin-centered tone, periodic Hann places
  its ideal power in the center and two neighboring bins. The 140, 150 and
  160 Hz centers all fall in Bass, and 2,990, 3,000 and 3,010 Hz all fall in
  High mids. The band collects the full ideal sine power `A²/2` in each case.
  See the [spectral decision](../decisions/002-spectral-analysis.md) and
  [band definitions](../../src/audio/bands.ts).

## Acceptance criteria

1. A data-level Vitest check calls the same demo data builder as the page and
   asserts six chronological columns with exact start/end times. Column `i`
   spans `[i × 4096 / 40960, (i + 1) × 4096 / 40960)` seconds. The seven rows
   run from Sub-bass through Air in the existing band order, with 42 values.
2. The first two columns have Bass power 0.5, the middle two have exactly zero
   in every band, and the last two have High mids power 0.125. All other cells
   in the tone columns are near zero. Check every tone-column value against
   these analytic expectations within `1e-7` absolute error, the repository's
   unit-scale Float32 fixture tolerance. Assert that all powers are finite and
   nonnegative. The test uses the analytic expectations as its oracle.
3. The Vite demo visibly labels time intervals in seconds, the seven named
   bands, and power in squared linear amplitude. Time increases left to right
   and displayed values make the heatmap readable without color. A single
   linear color scale across all cells maps 0 to the light end and 0.5 to the
   dark end. A browser check sees two darkest Bass cells, two silent columns,
   and two lighter High mids cells. A visible scale and displayed numbers
   identify the values, with rounding confined to display.
4. On a wide viewport and at roughly 320 CSS px, the page keeps the existing
   measurement example usable and the heatmap labels and values reachable.
   Check the heatmap's table caption, row and column headers, and value text
   in the browser accessibility tree. If the table needs horizontal scrolling,
   keep it inside a named keyboard-scrollable region with visible focus.

## Scope and affected components

- Keep fixture assembly and timeline-to-display mapping in a small demo module
  such as `src/demo-band-timeline.ts`, with its integration check beside it.
  `src/main.tsx` owns rendering. Use a styled semantic HTML table with band
  names as categorical rows and observed time intervals as column headers.
- Exhaust the single-use timeline once at demo initialization. Keep the source
  PCM stable while iterating. Copy each frame's start/end times and the mono
  channel's band names and power values into display data. Release PCM and full
  spectral results when projection finishes. The component renders the compact
  data across rerenders. Use `frame.spectrum.channels[0].bands` as the source
  of band power.
- The [timeline contract](../decisions/004-time-indexed-analysis.md) and
  [PCM contract](../decisions/001-audio-measurement.md) define the existing
  units, bounds, error classes, stereo order, over-range support, and
  ownership. This demo uses one valid mono fixture and the existing seven
  bands. Future uploads, playback, stereo views, interactive controls, dB
  conversion, 3D, and streaming are outside this milestone.

## Implementation sequence

- [x] Write `createBandTimelineFixture(): PcmAudio` in
  the demo module using the three sample ranges above. Its review boundary is
  one channel, the specified sample rate and length, the two tone spans, and
  an exactly silent middle span. It ends at the PCM return value.
- [x] Project the fixture through `createSpectrumTimeline` and add the analytic
  Vitest check at the demo-data boundary. Keep the timeline regression suite
  separate from this consumer test.
- [x] Render the heatmap in the existing page and verify it in the browser.
  Update the implemented-behavior summaries in `README.md`,
  `docs/ARCHITECTURE.md`, and `docs/PRODUCT.md` after the view works.

## Verification and handoff

From the repository root, run `npm ci`, `npm test`, `npm run typecheck`,
`npm run build`, and `git diff --check`. Use
`npm ci --cache /tmp/soundscape-npm-cache` in the cloud if needed. Open the
actual demo in a browser for criteria 3 and 4. The existing spectral browser
smoke entry exercises the engine separately from the React page. No benchmark
is needed for this fixed six-window view.

### Implementation results

- Reviewed the fixture specification before implementation. The three spans
  align with the six analysis windows, and both tones and their periodic Hann
  neighbors land entirely in the intended bands. The fixture needed no
  corrections. The test accounts for Float32 rounding in tone windows.
- The default `npm ci` stalled with no output and was interrupted.
  `npm ci --cache /private/tmp/soundscape-npm-cache --offline` passed.
  `npm test` passed all 410 tests across four files, including the 42-cell
  analytic integration check. `npm run typecheck`, `npm run build`, and
  `git diff --check` passed.
- Verified the actual production build through Vite preview in the Codex
  in-app browser. At 1,200 CSS px, the full table fit alongside the existing
  measurement flow. Two darkest Bass cells displayed 0.500, both middle
  columns displayed all zeros, and two lighter High mids cells displayed
  0.125. The accessibility inspection exposed the caption, seven band
  row headers, six interval headers plus the Band header, and all 42 values.
- At 320 CSS px, the measurement text wrapped and only the table region
  scrolled horizontally. Tab visibly focused the region at both widths.
  At 320 CSS px, Right and Left moved between the first and last intervals
  while the caption and band labels stayed visible. A second Tab left the
  region. The separate engine smoke script and benchmark were outside this
  verification run.

Planning baseline on the current checkout passed dependency installation with
`npm ci --cache /private/tmp/soundscape-npm-cache`, all 409 tests, type-check,
build, and whitespace checks. The default install could not write npm logs,
and an offline retry lacked the locked Vitest tarball. The network-enabled
install with the temporary cache succeeded.

The working tree already contains edits to `README.md` and
`src/audio/timeline.test.ts`, plus `docs/references/testing-in-the-ai-age.md`.
Preserve all three. The local timeline test now counts FFT calls on valid PCM
to verify lazy execution and early termination. Dedicated cases still cover
nonfinite and detached storage. The demo's integration check belongs alongside
its own data builder, and any later README edit should retain the testing-guide
link. All three local edits were preserved.
