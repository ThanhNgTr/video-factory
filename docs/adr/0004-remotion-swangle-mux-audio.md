# ADR 0004: Remotion + React Three Fiber, CPU WebGL, audio muxed after render

Date: 2026-11-16 · Status: accepted (renderer re-evaluated after spike S1)

## Context
The demo proved Three.js block characters render through Remotion with `--gl=swangle`; GPU `angle` fails on this machine and more than 4 tabs crash Chrome at 14 GB RAM.

## Decision
`RemotionRenderer` bundles `modules/video/src/composition/entry.ts` once per process and calls `renderMedia` with `gl: "swangle"`, `concurrency` from config (default 2), `muted: true`. The soundtrack (`mix.wav`, built by ffmpeg with ducking and `loudnorm`) is muxed in afterwards with ffmpeg. Render code is a pure function of `(props, frame)`; randomness uses Remotion's `random(seed)` with the run seed.

## Consequences
- No `public/` folder coupling: artifacts live only in the run folder.
- Render time is the bottleneck (CPU). Spike S1 decides GPU machine vs Blender; only the adapter changes.
