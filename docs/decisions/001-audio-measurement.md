# 001 — PCM representation and time-domain measurements

Status: implemented for Task 001; validation and traversal hardened in Task 001.5.

## Representation

Soundscape uses planar PCM: one `Float32Array` per channel, accompanied by a
finite positive sample rate in Hz. A mono input has one channel; stereo has two
in left/right order, with equal nonzero lengths. Planar storage makes channel
independence explicit and avoids deinterleaving before measurement. Float32
provides compact, predictable sample storage and a conventional representation
for future audio boundaries without coupling current DSP to those boundaries.
Accumulation uses JavaScript Number arithmetic rather than Float32 arithmetic.

Samples are normalized linear amplitudes: 1 is nominal full scale, not a physical
sound-pressure reference. Finite values outside [-1, 1] are accepted without
clipping. No input samples are mutated or copied by the measurements.

Runtime validation checks the top-level object, numeric sample-rate type, array
container, channel count, Float32 channel storage, channel lengths, and sample
finiteness before measurements. TypeError denotes incorrect types (including
missing required properties); RangeError denotes invalid numbers or sizes.
Zero or more than two channels is a RangeError. Sparse arrays have invalid
channel storage and produce TypeError. Nonfinite Float32 values produce RangeError.

## Definitions

For each channel x with N samples:

- Sample peak: `max_n |x[n]|`, in linear amplitude units. This measures stored
  samples, not reconstructed intersample peaks.
- Mean-square signal power: `P = (1/N) Σ x[n]²`, in squared amplitude units.
- RMS: `sqrt(P)`, in linear amplitude units.

The public names `perChannelMeanSquareEnergy` and `meanSquareEnergy` are retained
for compatibility. They refer to mean-square signal power, not total energy,
joules, calibrated acoustic power, or perceptual loudness. RMS includes any DC
component. Measurements do not sum or average across stereo channels. Sample
rate is returned as metadata and does not alter these amplitude calculations.

`measureAudio` validates once (including a pass over samples for finiteness),
then computes peak and sum of squares in one measurement pass per channel.
It derives RMS from mean square and allocates only the returned result objects
and channel array. The standalone measurement functions retain their contracts.

## Numerical evidence

Synthetic signals have known expectations and require no external files, audio
devices, network access, or subjective judgments. Integer-cycle sine fixtures
with sampled extrema test peak A, RMS A/√2, and mean square A²/2. Silence, signed
over-range samples, and left-only/right-only signals test distinct failure modes.
Cross-checks verify the combined API against the standalone functions.

The sine generator stores Float32 samples, so tests permit absolute error <=1e-6
for peak/RMS and <=1e-7 for mean square. Silence is checked exactly. These are
test tolerances for the selected fixtures, not universal error guarantees for all
buffer sizes. Analytic sine identities need not hold over arbitrary partial cycles.

## Boundaries and deferred decisions

Measurements remain independent of rendering so tests and future audio consumers
can use the same mathematics without React, DOM, or browser APIs.

The current API requires complete buffers in memory. Streaming, compensated
summation for very long buffers, channel layouts beyond stereo, intersample peak
estimation, dB reference conventions, perceptual weighting, and calibration are
deferred. FFT, spectral windowing, audio-device/file processing, and graphics are
outside this milestone. No performance benchmark has been added.

The channel storage check uses `instanceof Float32Array`; cross-realm typed-array
acceptance is not guaranteed. Validation handles ordinary runtime data, not hostile
getters/proxies or concurrent mutation of shared sample storage. Fixture options
other than sample rate retain their existing RangeError validation behavior.

## References

- [MDN: Float32Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Float32Array)
  describes the storage type used here.
- [MathWorld: Root-Mean-Square](https://mathworld.wolfram.com/Root-Mean-Square.html)
  provides the standard RMS definition. The implementation directly evaluates the
  elementary formulas above; no external DSP implementation was copied.
