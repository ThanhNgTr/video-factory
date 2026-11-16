# @vf/video — D. timeline, render, QA

| Stage            | Reads                                      | Writes                                     | Port       |
| ---------------- | ------------------------------------------ | ------------------------------------------ | ---------- |
| `video.timeline` | `scene.json`, `audio.json`                 | `timeline.json` (frames, word captions)    | —          |
| `video.render`   | timeline, scene, assets, script, `mix.wav` | `video.mp4`, `props.json`                  | `Renderer` |
| `video.qa`       | `video.mp4`, timeline, script              | `qa.json` (fails the run when not passing) | — (ffmpeg) |
| `video.thumb`    | `video.mp4`                                | `thumb.jpg`                                | —          |

- Composition: `src/composition/` (`entry.ts` → `Root.tsx` → `Video.tsx` = `World.tsx` 3D + `Overlay.tsx` 2D). Open it with `pnpm studio` (needs a `props.json`; drag one in).
- Renderers: `RemotionRenderer` (CPU WebGL `swangle`, muted; audio muxed after) and `FakeRenderer`.
- Lighting: the per-mood table in `composition/World.tsx` (ambient, a key light that follows the camera, two rims, practical lamps, fog). No post-processing (ADR 0008): about 0.27 s per frame on CPU WebGL, about 17 minutes per 2-minute episode.
- Everything on screen is a pure function of `(props, frame)`; use `random(seed)` from Remotion, never `Math.random`.
