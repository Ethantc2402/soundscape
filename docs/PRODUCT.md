# Product context

Frontend choices and deferred candidates are tracked in the
[product backlog](PRODUCT-BACKLOG.md). Approved policies there remain distinct
from implemented behavior and from proposed future options.

## Known scope and workflows

Soundscape 3D is an audio measurement foundation with pure TypeScript APIs and a React demo. It supports mono/stereo PCM validation, per-channel peak/RMS/mean square, selected-frame Hann-windowed FFT power, seven-band aggregation, reusable spectral analyzer sessions, and lazy time-indexed spectra over fully fitting windows with explicit sample hops. The demo displays time-domain measurements for a synthetic sine and a static seven-band heatmap for a separate mono recording.

## Requirements and constraints

The first real-song workflow accepts one local mono/stereo WAV (64 MiB, five
minutes decoded), shows decoded metadata and whole-record measurements, and lets
the user inspect per-channel band power at a selected time. PCM16/PCM24 decoding
has been tested in macOS Chrome. Import uses a 48 kHz offline context and may
resample. Files stay local. Loading, cancel/replacement, errors, and short audio
have explicit states. The original synthetic examples remain available.

Preserve input immutability, left/right channel order, finite over-range samples, intentional error classes, and numerical tolerances. Keep DSP independent of React and browser APIs. Follow the contracts and definitions in [README](../README.md) and the [audio measurement decision](decisions/001-audio-measurement.md).

## Exclusions

No 3D rendering, AI, uploads, network services, instrument identification, source separation, streaming, workers, or STFT reconstruction pipeline are implemented. Future additions require explicit task scope. File decoding is confined to the browser adapter.

## Assumptions and unanswered questions

The owner selected finished stereo mixes as the first product input. The broader
goal is a synchronized mix visualizer that helps locate potential problems; this
milestone supplies measurements, without diagnostic claims. Task 006 adds local Play/pause, full-duration seek, whole-record native loop,
a per-channel overview, and one recording-relative clock for playhead/inspection.
Physical synchronization and full performance acceptance remain unverified;
see [Task 006](plans/2026-11-18-task-006-playback-shared-clock.md). See [the roadmap](plans/2026-11-16-stereo-mix-visualizer-roadmap.md).
