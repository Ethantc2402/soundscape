# 002 — Single-frame spectral power

Status: implemented for Task 002. Core principle: measured data before visual interpretation.

## FFT implementation and attribution

Use exactly **fft.js 4.0.4**, by Fedor Indutny, under the MIT license. The lockfile
pins its registry artifact and integrity hash. Its API, types, source, and license
were inspected before integration. Its real-input radix-4 FFT accepts powers of
two, writes interleaved real/imaginary coefficients, and does **not** scale the
forward transform. Only its inverse transform divides by transform size. The
real transform supplies DC through Nyquist without requiring `completeSpectrum`.

This established, narrowly scoped implementation has no runtime dependencies.
It ships broad TypeScript declarations; our boundary supplies typed Float64
buffers and exposes no library-specific types. A custom FFT would increase
algorithmic complexity and verification burden without helping this milestone.

Alternatives inspected in the npm registry:

| Package/version | License | Assessment |
| --- | --- | --- |
| fft.js 4.0.4 | MIT | Selected: small, real-input API, included types, no runtime dependencies |
| @thi.ng/dsp 4.7.123 | Apache-2.0 | More recently updated, but a general DSP package with six direct dependencies |
| fft-js 0.0.12 | MIT | Another older release; no bundled type declaration advertised |

fft.js 4.0.4 was published in January 2021. Selection does not imply active
upstream maintenance; age and permissive declaration types remain risks. The
package is 22,390 bytes unpacked (registry metadata), not a measured bundle size.
No upstream benchmark is used as a Soundscape performance claim.

Sources: [fft.js README/API/license](https://github.com/indutny/fft.js#readme),
[forward/inverse implementation](https://github.com/indutny/fft.js/blob/v4.0.4/lib/fft.js),
and npm package metadata for the versions above. The bundled package README's MIT
notice is retained in [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md).
The normalization below follows the DFT Parseval identity and the stated Hann
formula; it is not an imported DSP framework's undocumented convention.

## Frame selection and periodic Hann

`analyzeSpectrum(pcm, { frameOffset, fftSize, frameLength? })` analyzes one frame
per input channel, preserving mono or left/right ordering. Offsets count PCM
frames, one sample per channel. `frameLength` defaults to `fftSize`; a shorter
explicit length requests padding. Frames must fit entirely inside the input:
there is no implicit truncation, partial-frame acceptance, or automatic padding.

For observed length M, window samples are:

`w[n] = 0.5 (1 - cos(2πn/M)), n = 0 ... M-1`.

This is periodic Hann, using M in the denominator. Symmetric Hann uses M-1,
has two zero endpoints, and is a different finite sequence. Periodic Hann has
circular symmetry `w[n] = w[M-n]` and generally a nonzero last sample. Its coherent
gain `Σw/M` is 1/2 and mean-square gain `Σw²/M` is 3/8 for our supported M >= 4.
The implementation computes the gains from the coefficients it actually uses.

Selected samples are multiplied into Float64 workspace, never into input PCM.
If FFT size L exceeds M, append L-M zeros **after** applying the M-sample window.
Do not stretch the Hann window across padded samples. Minimum M is 4; maximum
L is 65536 to bound per-call allocations. Supported L values are 1024, 2048,
4096, 8192, 16384, 32768, and 65536. M may be any integer from 4 through L.

## Frequency coordinates and resolution

Return L/2+1 bins, from DC through Nyquist, with centers `f[k] = k fs/L` and
spacing `Δf = fs/L`. Frequency coordinates use the original sample rate fs.
Frame duration is M/fs, excluding padding. The observed duration controls
intrinsic resolution; padding only samples the same windowed transform more
densely. Hann's main-lobe null-to-null width is approximately 4fs/M away from
the endpoint cases. Finer bin spacing alone does not separate unresolved tones.

## Normalization and units

Let `y[n] = x[n] w[n]`, zero-padded to L. fft.js computes the unscaled DFT X.
For each one-sided bin:

`P[k] = d[k] |X[k]|² / (L Σw²)`

where d is 1 at DC and Nyquist and 2 at interior positive-frequency bins. Interior
negative-frequency conjugate power is folded into its positive-frequency partner.
DC and Nyquist are self-conjugate and must not be doubled.

Outputs are **bin-integrated power in squared linear amplitude**, with metadata
`powerUnits: 'squared-linear-amplitude'` and
`normalization: 'one-sided-window-mean-square'`.

These concepts are distinct:

- Raw coefficient magnitude `|X[k]|` is unnormalized and frame-length dependent.
- A coherent-gain-corrected amplitude spectrum would use `d |X[k]| / Σw`.
  It would recover A at an isolated interior bin-centered sine peak. It is not
  returned by this API.
- The returned power uses mean-square window gain. Its peak is not generally
  the square of that amplitude spectrum.
- A PSD would have units squared amplitude/Hz. `P[k]/Δf` would yield that
  periodogram density, but this API neither returns nor labels P as PSD.

For an isolated interior bin-centered sine of amplitude A, with M=L and no
overlap with its negative-frequency image, Hann spreads power over three bins:
the center has A²/3 and each adjacent bin A²/12. Their sum is A²/2. These values
are stable across supported full-length FFT sizes. With padding, individual bin
powers change with integration spacing; their sum remains stable.

For constant amplitude A at DC, the endpoint power is 2A²/3 and bin 1 carries
A²/3. A Nyquist alternating sequence has the same pattern mirrored at Nyquist.
Both total A². The DC component is preserved; no mean subtraction occurs.

Parseval gives the exact target (up to numerical error):

`Σ P[k] = Σ(x[n] w[n])² / Σw²`.

This is window-weighted mean square. It need not equal the unwindowed frame's
mean square for transients or arbitrary short signals. Gain correction cannot
reconstruct samples attenuated by the window. Results are not joules, calibrated
acoustic power, loudness, or dB.

## Band aggregation

Seven fixed bands: Sub-bass 20–60, Bass 60–250, Low mids 250–500, Mids 500–2000,
High mids 2000–6000, Treble 6000–12000, and Air 12000–20000 Hz.
Exported band definitions and supported FFT sizes are frozen at runtime as well
as readonly in TypeScript. Calls cannot alter subsequent analyses through them.

Each **bin center** belongs to `[lower, upper)`, except Air includes exactly
20000 Hz. Thus a shared boundary belongs only to the higher band. No fractional
bin interpolation or bandwidth-overlap allocation is attempted. Sum the original
linear bin powers, with no normalization to a band's maximum and no dB conversion.
Centers below 20 Hz or above 20 kHz are excluded, even if their bins overlap a
band. Band powers therefore need not sum to total spectral power.

The spectrum ends at Nyquist. Returned band limits are clipped to Nyquist, and
`binCount` reports eligible centers. Bands above Nyquist, or bands skipped by a
coarse grid, return zero power and zero count. If Nyquist equals a band's lower
boundary, that band can contain the single Nyquist bin despite identical clipped
lower/upper limits. For example, at fs=24000, Air contains the 12000 Hz endpoint;
Treble excludes it. This prevents double-counting at clipped boundaries.

Finite-window leakage can cross band boundaries. A 60 Hz tone lies exactly on
the Sub-bass/Bass boundary, so some measured power legitimately falls below 60 Hz.
The engine does not reassign that leaked power to the nominal source frequency.
Aggregation advances through the sorted bands as bin frequencies increase,
preserving the same assignment without searching all bands anew for every bin.

## Numerical tests and observed fixtures

Tests retain all time-domain coverage and add independent direct finite-sum DFT
and weighted mean-square references, Hann coefficients/gains, full-length and
padded Parseval checks, analytic sine powers, DC/Nyquist weights, stereo isolation,
two tones, non-bin alignment, amplitude scaling, bands, malformed inputs, extreme
finite Float32 values, and immutability/determinism checks.

Analytic power expectations use absolute tolerance 1e-7, accounting for unit-scale
Float32 input quantization. Same-input FFT/DFT and Parseval comparisons use 1e-12;
window coefficients and normalized gains use 2e-14 for double-precision trig and
accumulation. These are fixture-specific tolerances, not universal error bounds.

An exact 1000 Hz tone at 48000 Hz cannot be bin-aligned for a power-of-two L:
`1000L/48000 = L/48` is not an integer. Padding to another power of two cannot fix
this. Tests verify its nearest-bin peak and analytic finite-window DFT instead
of inventing a bin-centered expectation. Exact 1 kHz bin alignment is tested at
fs=51200 across every supported L. The 60 Hz / 48000 Hz test uses L=32768,
about 0.683 seconds and 41 cycles, rather than an ambiguous short observation.

Observed unit-amplitude fixtures from executing the engine in this workspace
(rounded for readability):

| Input | fs | L=M | Δf (Hz) | Dominant bin / center (Hz) | Peak-bin power | Total power |
| --- | --- | --- | --- | --- | --- | --- |
| 60 Hz | 48000 | 32768 | 1.46484375 | 41 / 60.05859375 | 0.3326459954 | 0.4999999988 |
| 1000 Hz | 48000 | 4096 | 11.71875 | 85 / 996.09375 | 0.2885278791 | 0.4999999905 |
| 1000 Hz | 51200 | 4096 | 12.5 | 80 / 1000 | 0.3333333320 | 0.4999999980 |

At 60 Hz the measured Sub-bass power was approximately 0.0936746294 and Bass
power 0.4063253694. This follows bin-center aggregation of a leaking Hann spectrum.
Reported peak centers are grid coordinates, not interpolated frequency estimates.

## Limitations and Task 003 boundary

This analyzes one chosen frame, not a song's STFT. It does not decode files,
play audio, classify instruments, separate sources, or produce rendering data.
The React demonstration remains a time-domain example. Outputs are mutable typed
arrays owned by the caller; they do not share input or per-call workspace.

Full PCM validation still scans the input, including samples outside the selected
frame. Per-call FFT plans are not cached; workspace is reused only across that
call's channels. No latency or throughput benchmark has been performed. Browser
bundle compatibility is checked separately because the React entry does not yet
import the spectral engine. Invalid types produce TypeError; invalid numbers,
unsupported sizes, bounds, unrepresentable timing/spacing, and band-sum overflow
produce RangeError. Ordinary finite Float32 PCM cannot overflow double-precision
power at the supported frame sizes.

Deferred to a separately scoped Task 003: successive-window scheduling, hop size,
time-indexed feature-frame contracts, and overlap policies. Streaming ownership,
worker execution, plan caching, visualization, and playback synchronization remain
separate decisions rather than implicit additions here.
