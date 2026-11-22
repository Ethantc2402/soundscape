# Architecture and environment

## Current implementation

Connected repository: [Ethantc2402/soundscape](https://github.com/Ethantc2402/soundscape). Stack: React 19, strict TypeScript 5.9, Vite 7, Vitest 4, fft.js 4.0.4. Requires Node >=22.12.0 and npm.

## Components and data flow

- [src/main.tsx](../src/main.tsx): renders the synthetic sine measurements and the band-power heatmap.
- [demo-band-timeline.ts](../src/demo-band-timeline.ts): mono fixture → spectrum timeline → compact display columns with time intervals and band power.
- [src/audio/pcm.ts](../src/audio/pcm.ts): PCM types and runtime validation.
- [fixtures.ts](../src/audio/fixtures.ts), [measurements.ts](../src/audio/measurements.ts): synthetic samples and time-domain APIs.
- [windowing.ts](../src/audio/windowing.ts), [spectrum.ts](../src/audio/spectrum.ts), [bands.ts](../src/audio/bands.ts): Hann window → FFT → one-sided power → band aggregation.
- [timeline.ts](../src/audio/timeline.ts): eager recording/settings validation → single-use lazy sample-grid iteration → reusable spectral session, with start/end times.
- `src/audio/*.test.ts`: numerical correctness, invalid inputs, boundaries, and ownership.
- `scripts/`: browser smoke checks and spectral benchmarks.
- `src/browser/import-audio.ts`: local RIFF WAV → 48 kHz offline browser decode →
  guarded mono/stereo copy → validated session-owned PCM.
- `src/import-session.ts`: one active import pipeline, latest pending request,
  cancellation/disposal invalidation and stale-result suppression.
- `src/song-inspection.ts`: whole-record measurements once → reusable analyzer →
  compact per-channel bands for a selected 8,192-sample window.
- `src/song-session.ts`: cohesive owner of stable PCM, inspection, waveform and lazy playback.
- `src/playback-clock.ts`: pure recording/context-time segment arithmetic and timestamp selection.
- `src/browser/song-playback.ts`: gesture-created context, one native copy, fresh sources,
  command invalidation, output transitions and interruption/disposal policy.
- `src/waveform-overview.ts`: independent per-channel compact bucket extrema.
- `src/ImportedSong.tsx`, `src/SongTransport.tsx`, `src/WaveformOverview.tsx`: import,
  measurement tables, transport, shared snapshot and bounded spectral refresh.

DSP remains pure TypeScript, independent of React, DOM, Web Audio, and rendering. Storage is in-memory planar Float32 PCM with preserved mono/stereo order. Analyzer sessions retain private workspaces; callers must not mutate or transfer source PCM during a session.

The import UI owns session PCM and releases it when replaced/unmounted. Decoding
returns fresh copies; no buffer is transferred or shared with AudioBuffer storage.
Only compact selected-window bands reach the view; full-spectrum history is not
retained. Native decode may finish after cancellation, but cannot publish stale
data. See [decision 005](decisions/005-local-song-import.md) for resource limits.

## Setup and checks

[package.json](../package.json) defines `npm run dev`, `npm test`, `npm run test:watch`, `npm run typecheck`, `npm run build`, and `npm run preview`; install with `npm ci`. There is no lint script. Optional `npm run test:browser` requires Chromium (`CHROMIUM` can select the executable). See [README](../README.md) for benchmark options and container-specific guidance.

No application credentials, authentication, database, backend, or external runtime services are configured. No application environment variables are documented as required. Build output is `dist/`; a hosted deployment target is not established.

## Constraints and proposed work

Detailed mathematical and ownership contracts live in [README](../README.md) and decisions [001](decisions/001-audio-measurement.md), [002](decisions/002-spectral-analysis.md), and [003](decisions/003-spectral-engine-hardening.md). Task 003 adds synchronous iteration over fully fitting windows. Task 004 consumes that iterator once at demo initialization and retains only the display columns. See [004](decisions/004-time-indexed-analysis.md) for the timeline contract.

Playback architecture, output-estimate limitations and resource policies are in
[decision 006](decisions/006-playback-shared-clock.md). The import controller releases
ready/obsolete sessions; no stale resume can restart disposed playback. Nominal
playback storage duplicates PCM once, while spectra remain selected-window results.
Physical synchronization and native-memory/performance gates remain unverified.

First-Play validation/copy is cooperative at the browser boundary: one private
AudioBuffer is prepared in bounded chunks with task yields, shared by pending
Play commands. Pause/hidden suppress start, and disposal stops preparation at
the next boundary. PCM remains stable/borrowed. Import measurement arithmetic uses a pure incremental
iterator, driven by the session owner with task yields and generation checks under
a soft 4 ms budget. Indexed validation retains all existing checks. Copying, full
validation, analyzer setup and waveform generation remain synchronous phases; no
validation is bypassed and no extra PCM copy is retained. Native AudioContext
construction remains a separate unresolved stall. Foreground/device acceptance is
still open (see Task 006's November 20 import-preparation measurements).
