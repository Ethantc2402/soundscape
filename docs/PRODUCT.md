# Product context

## Known scope and workflows

Soundscape 3D is an audio measurement foundation with pure TypeScript APIs and a React synthetic sine demonstration. It supports mono/stereo PCM validation, per-channel peak/RMS/mean square, selected-frame Hann-windowed FFT power, seven-band aggregation, and reusable spectral analyzer sessions.

## Requirements and constraints

Preserve input immutability, left/right channel order, finite over-range samples, intentional error classes, and numerical tolerances. Keep DSP independent of React and browser APIs. Follow the contracts and definitions in [README](../README.md) and the [audio measurement decision](decisions/001-audio-measurement.md).

## Exclusions

No graphics, AI, playback, uploads, decoding, network services, instrument identification, source separation, streaming, workers, or STFT pipeline are implemented. Future additions require explicit task scope.

## Assumptions and unanswered questions

The repository establishes technical scope, but does not establish intended end users or their broader problems. No additional product requirements are assumed. Clarify the intended users, first end-to-end workflow, and next milestone before extending product scope.
