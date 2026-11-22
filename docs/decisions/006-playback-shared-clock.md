# 006 — Playback and a shared recording clock

Status: implemented; physical synchronization and complete performance acceptance
remain unverified. See the [Task 006 evidence](../plans/2026-11-18-task-006-playback-shared-clock.md).

## Ownership and browser boundary

DSP under `src/audio/` remains pure TypeScript. Its validation uses indexed scans;
whole-record measurement arithmetic also exposes incremental steps without changing
existing synchronous APIs or numerical definitions. `song-session.ts` owns stable decoded PCM,
one inspection analyzer, independent compact waveform extrema, and a playback
adapter created in an effect. Context creation/resume occurs only on Play.
`browser/song-playback.ts` validates and copies PCM into one native AudioBuffer on
first successful Play. Subsequent seeks/restarts reuse that buffer with fresh
one-shot source nodes connected directly to the destination at unity gain.
The buffer uses the decoded rate even if the context uses a different device rate.
No normalization, downmix, PCM mutation, transfers, or extra playback cache occurs.
Finite over-range stored samples remain valid; device reproduction can clip and
is not a measurement of stored sample peak.

The import controller's optional release callback disposes ready results before
replacement starts, on cancel/unmount, and when obsolete preparation returns.
Disposal stops/disconnects the source, invalidates pending resume promises, removes
listeners, closes the context and drops PCM/analyzer/waveform/buffer references.
Async commands and ended callbacks check identity; ended releases the node without
resetting the output clock. Effect cleanup pauses and cancels painting; repeated
effect setup reuses the session adapter. Hidden documents and interrupted/suspended
contexts pause and require explicit Play. Playback errors leave inspection usable.

## Position and output estimates

`playback-clock.ts` is browser independent. At rate 1, a segment anchored at
context c0 and recording p0 advances by max(0,c-c0). Nonlooping position clamps at
N/fs; looping position wraps modulo N/fs. Pause, seek and loop-toggle commands
append context-time segments; same-time commands coalesce. At most 64 segments
are retained. Output estimates preceding a retained boundary use the old segment;
when history is missing, timing is explicitly unconfirmed.

A running context's nonzero finite `getOutputTimestamp()` pair is extrapolated by
`(performance.now()-performanceTime)/1000`, bounded by current context time.
Pairs from the future, older than 250 ms, or ahead of context time are rejected.
The 250 ms freshness limit is an application policy, not a measured latency budget.
Suspended/unusable/unavailable timestamps fall back to uncompensated context time.
No additional latency subtraction or inferred device delay is used. The UI labels
quality and does not claim verified physical synchronization.

Seek accepts [0,N/fs], floors seconds to a decoded sample index, and retains
playing/paused intent. N is the stopped end sentinel; Play from end restarts at 0.
Loop initially is off, covers the entire native buffer, and toggling it preserves
position. Enabling at end leaves playback stopped. Integer seek anchors are
retained separately from seconds: e.g. 27/48000 can multiply back to just below 27.
`SongInspection.inspectSample(sample)` selects the corresponding full frame
without a second seconds round trip. Existing `inspect(seconds)` behavior stays
unchanged. Both clamp to N-8192; no wrapping, partial frames or padding is inferred.
N<8192 remains playable with measurements and waveform; N=8192 has one full frame.

One animation snapshot drives playhead/sample text, waveform and analysis selection.
The analysis table skips unchanged offsets and refreshes at most 15 Hz in normal
playback, with immediate command refreshes. It shows actual interval, center and
age. Whole-record measurements remain static. Native range/numeric controls provide
keyboard equivalents to pointer waveform seeks. Animation stops when hidden or
unmounted; audio scheduling never depends on animation callbacks.

## Waveform and workload

For B=min(N,2048), each channel independently scans buckets
[floor(b*N/B),floor((b+1)*N/B)). Float32 extrema occupy at most 32,768 bytes for
stereo and retain neither PCM references nor omitted tail samples. Display scales
are per channel and explicitly labeled, including over-range extrema and silence.

Import measurements advance through pure incremental steps, driven by the session
owner with task yields after a soft 4 ms budget and generation checks. Each
arithmetic chunk covers at most 262,144 samples, keeping the original summation
order. The iterator closes on cancellation/failure, and only complete inspection
and waveform data become a session. Decoding/preparation remain serialized by
the existing controller. Full validation is retained at every prior boundary;
copying, validation, analyzer setup and waveform construction remain indivisible.
Indexed validation and arithmetic substantially reduced measured scan costs; this
is not a hard task-duration bound or cross-device guarantee. First Play now
validates and copies 262,144 frames per channel per task, yielding between tasks.
The unpublished buffer is shared across overlapping Play commands; pause/hidden
invalidate source start while allowing the one preparation to finish for reuse.
Disposal stops further chunks at the next task boundary and prevents publication.
Only a complete validated copy can start; selected seek/loop intent remains current.
The synchronous offline graph helper is unchanged. Native context construction and
buffer allocation cannot be subdivided by this change.

Foreground measurements show smaller post-context click delays at the cost of
longer time until playback. Import preparation now has shorter measured interaction delays and total time;
native context startup remains a separate unresolved stall and full responsiveness
acceptance remains open. See the November 20 section in the plan
and [playback observations](../benchmarks/task-006-responsiveness.json) and
[import-preparation trials](../benchmarks/task-006-import-preparation.json). No worker or
dependency was introduced. Dropped-frame, native-memory and synchronization gates
remain unverified.
The 115,200,000 bytes per five-minute 48 kHz stereo PCM/playback copy is nominal
channel arithmetic, not a measured native-memory ceiling or reclamation guarantee.

## Evidence and sources

Deterministic clock and deferred-resource tests, analytic waveform/window tests,
matched-rate offline graph checks, resampled impulse alignment, and trusted CDP UI
checks are recorded in the plan. Offline rendering and timestamps cannot prove
physical audio-to-screen alignment. No final synchronization tolerance has been
registered from calibration, and the proposed <=50 ms target has not been tested.

This is original application code using the Web Audio contracts:

- [AudioBufferSourceNode, Web Audio Recommendation](https://www.w3.org/TR/2021/REC-webaudio-20210617/#AudioBufferSourceNode):
  one-shot sources, start/stop offsets, native looping.
- [AudioBuffer](https://www.w3.org/TR/2021/REC-webaudio-20210617/#AudioBuffer):
  channel copies and sample-rate metadata.
- [getOutputTimestamp, Web Audio 1.1 draft](https://www.w3.org/TR/webaudio/#dom-audiocontext-getoutputtimestamp):
  output context/performance time pairing and zero/unavailable initial estimates.
  Segment retention, extrapolation and freshness are application policy.

Existing decisions 001–005, FFT attribution and licenses remain authoritative.
