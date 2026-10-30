# Architecture and environment

## Current implementation

Connected repository: [Ethantc2402/soundscape](https://github.com/Ethantc2402/soundscape). Stack: React 19, strict TypeScript 5.9, Vite 7, Vitest 4, fft.js 4.0.4. Requires Node >=22.12.0 and npm.

## Components and data flow

- [src/main.tsx](../src/main.tsx): synthetic sine → PCM → measurements → React display.
- [src/audio/pcm.ts](../src/audio/pcm.ts): PCM types and runtime validation.
- [fixtures.ts](../src/audio/fixtures.ts), [measurements.ts](../src/audio/measurements.ts): synthetic samples and time-domain APIs.
- [windowing.ts](../src/audio/windowing.ts), [spectrum.ts](../src/audio/spectrum.ts), [bands.ts](../src/audio/bands.ts): Hann window → FFT → one-sided power → band aggregation.
- `src/audio/*.test.ts`: numerical correctness, invalid inputs, boundaries, and ownership.
- `scripts/`: browser smoke checks and spectral benchmarks.

DSP remains pure TypeScript, independent of React, DOM, Web Audio, and rendering. Storage is in-memory planar Float32 PCM with preserved mono/stereo order. Analyzer sessions retain private workspaces; callers must not mutate or transfer source PCM during a session.

## Setup and checks

[package.json](../package.json) defines `npm run dev`, `npm test`, `npm run test:watch`, `npm run typecheck`, `npm run build`, and `npm run preview`; install with `npm ci`. There is no lint script. Optional `npm run test:browser` requires Chromium (`CHROMIUM` can select the executable). See [README](../README.md) for benchmark options and container-specific guidance.

No application credentials, authentication, database, backend, or external runtime services are configured. No application environment variables are documented as required. Build output is `dist/`; a hosted deployment target is not established.

## Constraints and proposed work

Detailed mathematical and ownership contracts live in [README](../README.md) and decisions [001](decisions/001-audio-measurement.md), [002](decisions/002-spectral-analysis.md), and [003](decisions/003-spectral-engine-hardening.md). No architectural changes are proposed by the repository connection task.
