# @vf/video — D. timeline, render, QA

| Stage            | Reads                                      | Writes                                     | Port                             |
| ---------------- | ------------------------------------------ | ------------------------------------------ | -------------------------------- |
| `video.timeline` | `scene.json`, `audio.json`                 | `timeline.json` (frames, word captions)    | —                                |
| `video.render`   | timeline, scene, assets, script, `mix.wav` | `video.mp4`, `props.json`                  | `Renderer`                       |
| `video.qa`       | `video.mp4`, timeline, script              | `qa.json` (fails the run when not passing) | — (ffmpeg)                       |
| `video.thumb`    | `video.mp4`                                | `thumb.jpg`                                | —                                |
| `video.review`   | `video.mp4`, timeline                      | `frame-review.json` (never fails the run)  | `Reviewer[]` (`Llm` with images) |

- Composition: `src/composition/` (`entry.ts` → `Root.tsx` → `Video.tsx` = `World.tsx` 3D + `Graphics.tsx` motion graphics + `Overlay.tsx` 2D).
- `Graphics.tsx` (ADR 0017) draws graphic shots (`Shot.graphic`: count, scale, chart, formula, list, icons, layers) full frame between the HUD and the captions; `World` draws nothing for them. Number formatting, growth curves and ticks are in `src/domain/numbers.ts`. Icons come inlined in `assets.json`. A scene shot's `inset` is the same graphic drawn small in a card at the top right; a later shot's `text` is a badge under the HUD (ADR 0020).
- Camera beyond the framing (ADR 0025, 0026): `Shot.angle`, `lens` and `move` set the rig in `World.tsx` (every shot drifts unless told to hold still; pan, tilt, crane, zoom, crash-zoom and dolly-zoom end on the shot's framing), `Overlay.tsx` draws fades, flashes and the whip pan's blur between shots and styles captions by the format's `kind` (`RenderProps.kind`), `video.timeline` makes J-cuts (`JCUT_FRAMES`) and cues rain and wind beds under `fx`, `video.qa` measures the finished picture's motion next to the sample's (`Qa.motion`), `video.thumb` takes the brightest early frame.
- `World.tsx` also draws a shot's story props (`Shot.props`, ADR 0022): icons standing as cards on spots, moved by `src/domain/prop-motion.ts` (drop, sink, tilt, shake, float, grow, vanish); `focus` may name a prop and the camera frames it. `Shot.fx` adds rain or snow (`Weather.tsx`, shared with dioramas) or a rising flood. A dropping prop thuds in the timeline.
- `Diorama.tsx` (ADR 0021) draws diorama shots (`Shot.diorama`): a 3D strip of ground with a cut-away front showing its layers, pieces, weather and a vehicle; `World` renders it instead of a set. Its new layers thud as they land.
- `video.timeline` also writes sound cues (`Timeline.cues`) from the graphics' timing in `src/domain/graphic-timing.ts`, which `Graphics.tsx` shares, so each pop, tick and thud lands on its picture. Open it with `pnpm studio` (needs a `props.json`; drag one in).
- `video.review` (ADR 0015): one labelled frame per shot, tiled 3x3, judged in parallel by every reviewer in `deps.reviewers` (Claude by default; `VF_REVIEWERS=claude,codex` adds Codex). Prompt: `prompts/review.md`. A reviewer that fails is recorded, never fatal.
- Renderers: `RemotionRenderer` (CPU WebGL `swangle`, muted; audio muxed after) and `FakeRenderer`.
- Lighting: `normal | dim | flicker | blackout | red | headlights` (a cold light slides along the +x window wall over the first 1.5 s). The per-mood table in `composition/World.tsx` (ambient, a key light that follows the camera, two rims, practical lamps, fog). No post-processing (ADR 0008): about 0.27 s per frame on CPU WebGL, about 17 minutes per 2-minute episode.
- Everything on screen is a pure function of `(props, frame)`; use `random(seed)` from Remotion, never `Math.random`.
