# 005 — Local WAV import and selected-window inspection

Status: implemented for Task 005. The owner confirmed the manual interaction
checklist on November 18, 2026; see the plan for evidence and verification limits.

Browser decoding stays outside `src/audio/`. `importAudio` checks nonempty input
and a 64 MiB file cap, sniffs RIFF/WAVE, and asks a 48 kHz OfflineAudioContext to
decode. Supported product input is mono/stereo PCM WAV; macOS Chrome has real
PCM16/PCM24 evidence. The decoded rate, not unverified source metadata, defines
timing. More than two channels and decoded durations above 300 seconds reject
before channel copies. The decoder allocates before those guards; no native-memory
bound is promised. There is no upload, parser library, downmix, or normalization.

Fresh Float32 channel copies belong to the import session. Copy validation
preserves the existing finite over-range policy and left/right ordering. Existing
DSP errors/units stay unchanged. The React view releases obsolete sessions and
the analyzer borrows stable PCM until replacement or unmount. No transfers occur.

The request controller serializes the complete read/decode/prepare/measure
pipeline and stores only the latest pending request. Generation checks prevent
stale phases, successes, and failures after replacement, cancel, or disposal.
Cancel clears the view immediately; it cannot abort native decode. A disposed
controller cannot publish again. A new selection waits for active work to settle.

Whole-record measurements and analyzer creation run once per session. Inspection
uses an 8192-sample full Hann frame, no inferred padding, at
`min(floor(t * fs), N - 8192)` for finite nonnegative t. Implementation clamps
before multiplication to avoid overflow and handles the exact final boundary
without floating-point round-down. Short nonempty recordings retain measurements
but have no spectral frame. Results show actual sample offset and end-exclusive
times; only compact band results are retained. No full-song spectrum cache exists.

The browser gets task boundaries before preparation and measurement so phase
updates can paint. Copying and whole-record scans remain synchronous; the measured
five-minute workload and limitations are recorded in the task plan. Worker work
is deferred unless measured interaction requires it.

## Numerical evidence and decoder convention

Pure analytic tests retain 1e-6 peak/RMS and 1e-7 mean-square/band tolerances.
Independent stereo tones test channel order, Hann aggregation, selected-window
content changes, finite over-range PCM, and input preservation. Cursor requests
do not repeat full-record validation.

Real browser fixtures use the exactly representable period `[0, A, 0, -A]`
at 48 kHz (12 kHz). A full-length Hann puts one-sixth of its tone power in the
lower neighbor, two-thirds at the center, and one-sixth in the upper neighbor.
Thus Treble receives A²/12 and Air 5A²/12 for symmetric decoding.

Observed macOS Chrome PCM16 conversion is asymmetric: positive signed integer
codes divide by 32767, negative codes by 32768. The initial symmetric oracle
failed at +0.5000152587890625 and then at -0.5. The browser test records this
platform-specific convention explicitly, without changing application samples
or loosening DSP tolerances. For decoded period `[0, P, 0, -N]`, mean square is
`(P² + N²)/4`; the 12 kHz sine component has amplitude `(P + N)/2` plus tiny DC
and Nyquist components. Expectations use those independent formulas. PCM24 also
passes the strict sample/measurement checks. Other browser decoder conventions
need independent verification rather than universal sample-identity promises.

## Sources

- [MDN decodeAudioData](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData):
  complete-file decode and context-rate conversion.
- [Web Audio Recommendation](https://www.w3.org/TR/2021/REC-webaudio-20210617/#dom-baseaudiocontext-decodeaudiodata):
  browser decode contract. Request invalidation is original application logic.
- [McGill WAVE format reference](https://www.mmsp.ece.mcgill.ca/Documents/AudioFormats/WAVE/WAVE.html):
  RIFF/WAVE PCM fixture structure. Fixture writer is original project code.
- Existing spectral normalization and band boundaries remain in decision 002;
  original FFT licensing and attribution are unchanged.
