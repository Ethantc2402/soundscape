# 004 — Time-indexed spectral analysis (Task 003)

Status: implemented.

## API and validation

`createSpectrumTimeline(pcm, { fftSize, frameLength?, hopSize })` in
`src/audio/timeline.ts` returns a single-use `IterableIterator<TimelineFrame>`.
Construction validates PCM and fixed settings eagerly. Iteration computes one
spectrum at a time through one `createSpectrumAnalyzer` session. Full recording
validation runs exactly once, including when the recording is too short for a
frame. The short path validates PCM directly and allocates no FFT workspace;
existing analyzer factories continue to reject short recordings.

The internal `spectrum-settings.ts` module shares the existing FFT/frame option
validation with the spectral entry points. No unchecked analyzer or validation
token is exposed. Declared settings are read directly, including inherited and
non-enumerable properties, consistently with the existing analyzer. Existing public spectral signatures and numerical definitions
are preserved. `hopSize` is a required positive safe integer; incorrect types
throw `TypeError`, invalid numbers/sizes throw `RangeError`.

## Scheduling and times

For recording length N, observation length L, and hop H, there are zero frames
when N < L, otherwise `1 + floor((N - L) / H)`. Frame i starts at sample `i * H`.
Overlap, adjacent windows, and gaps are permitted. Only fitting grid windows
are emitted; incomplete tails are discarded and no off-grid final window is
appended. Empty PCM remains invalid. Invalid settings are rejected even if no
window fits. L defaults to FFT size; explicit L < FFT size requests zero padding
under the existing single-frame contract.

Each frame contains `index`, `frameOffset`, `startTimeSeconds`,
`endTimeSeconds`, and `spectrum` (the existing `SpectrumResult`). Start/end times
are recording-relative `offset / sampleRate` and `(offset + L) / sampleRate`,
with end exclusive and padding excluded. Offsets derive from integer samples,
never accumulated floating-point time. Construction checks the final scheduled
end time for finiteness, as well as existing spectral timing/spacing constraints,
so later time overflow cannot hide behind early termination.

## Ownership and scope

Settings, sample rate, channel references, and schedule are captured at creation.
Source PCM must stay stable, without mutation or transfer, for the iterator's
lifetime. Every selected frame retains the analyzer's bounds and finite-sample
guards, including detached-buffer rejection; these guards do not authorize
concurrent mutation. Returned spectra own their arrays/metadata independently
of the workspace and each other. No normalization, bands, Hann, FFT, channel
order, or finite over-range amplitude policy changes.

An active iterator retains the in-memory PCM and one analyzer, without retaining
a result history. Exhaustion, `return()`, or a `for...of` break closes iteration;
release references when done. Callers retaining many results incur their own
memory cost. No decoding, streaming input, asynchronous scheduling, workers,
playback, UI changes, dependencies, or phase/reconstruction pipeline are added.

## Verification approach

`timeline.test.ts` covers exact fits, short recordings, discarded tails, overlap,
adjacency, gaps, large hops, eager invalid-input rejection, overflow, single-use
iteration, early termination, one full validation, metadata capture, detached
buffers, nonfinite mutations, and result ownership. Analytic changing sine/DC/
silence fixtures check total power to absolute tolerance 1e-7; constant and
independent window-weighted Parseval comparisons use 1e-12. Overlapping padded
mono/stereo results are compared against existing single-frame output. Existing
independent DFT and numerical baselines remain in `spectral.test.ts`.
The development-only browser smoke entry also exercises timeline scheduling and
its spectrum. Executed checks and any blockers are recorded in the
[Task 003 plan](../plans/2026-10-30-task-003-time-indexed-analysis.md).

The scheduling API is original project code; spectral algorithms and third-party
attribution remain as documented in decisions [002](002-spectral-analysis.md)
and [003](003-spectral-engine-hardening.md), and the existing license notices.
