---
name: vf-motion
description: Motion and Remotion rules for Video Factory's renderer. Use when changing how characters move or act (library/actions, Character2D, World.tsx), the camera, motion graphics (Graphics.tsx), captions or any Remotion composition code in this repo. Overrides remotion-markup where they differ.
---

# Motion in Video Factory

Every frame of a video is a pure function of `(RenderProps, frame)`, rendered headless by `video.render` on CPU WebGL. Nobody edits a composition by hand: the director's JSON drives it. Read this before touching `modules/video/src/composition/`, `modules/assets/src/render/` or `library/actions/`.

## Where remotion-markup does not apply here

- No `Interactive.*`, Studio-editable structure or `staticFile()`/`public/`: everything arrives in `RenderProps` (characters, sets, icons inlined in `assets.json`; icons as SVG data URIs).
- Nothing is fetched while rendering: no Mapbox, MapLibre, MapTiler or Cesium maps, no remote images. A map would have to be drawn from offline vector data passed in the props.
- No `<Video>`, photos, AI imagery or ElevenLabs voiceover (CLAUDE.md, the audio module speaks with edge-tts).
- No `effects` / `<HtmlInCanvas>`: they need Chrome 149+ with a flag and a GPU; renders here use `swangle` on the CPU. GPU rendering (`--gl=angle`) is spike S1.
- Do use what it recommends that fits: `interpolate`, `spring`, `Easing` (never CSS `transition`/`animation`), `random(seed)`, `delayRender` around anything async (the `IconsReady` pattern), `<Img>` for data URIs, `@remotion/layout-utils` `fitText`/`measureText` for text that must fit a box.

## Motion principles, applied to this renderer

Adapted from the 12 principles of animation for code-driven motion. Fix the perceptual problem with the fewest principles.

1. Block every action as phases before choosing curves: rest, anticipation, action, overshoot, settle. Write them as keys (`library/actions/*.json`, `t` 0..1) or explicit phase constants, not one opaque easing. A gesture without anticipation (a small move the other way first) reads as a twitch; one without settle reads as a robot.
2. Pose to the silhouette: 2D cards read by outline. Exaggerate key poses (an arm held up is `armR` 100 or more, a shock is a lean plus raised arms), and avoid twinning (both arms doing the same thing).
3. Timing carries weight and meaning: fast in, slow settle for light things; heavier characters (tall, wide builds) move slower. A reveal lands while the narrator says it (graphics finish growing at `GROW` of the shot) and text holds at least 0.5 s plus 0.3 s per word.
4. Ease everything that starts or stops (camera moves, walks, growth); keep constant speed only mid-motion. Overshoot with a spring (damping 12-14) for pops: icons, landmarks, counters.
5. Arcs: limbs rotate around their joints (shoulder, elbow); a hand travels on an arc, never in a straight line between poses (`samplePose` interpolates keys with Catmull-Rom).
6. Follow-through and overlap: hair sways after the body stops (`sway`), a listener glances after the speaker starts (`look`), held items lag nothing (they are in the hand). Secondary action never competes with the primary one.
7. Squash and stretch only for cartoon impacts (jump, fall) and keep the volume (`sx * sy` about 1).
8. Staging: one clear action per shot; the camera frames it (`reach` toward a held item, room fits by depth). Do not let props or text cover the face.
9. Determinism: no state across frames, every frame computable out of order; seed variation from stable ids (`hash(id)`, `random(\`${seed}...\`)`); derive speed by sampling the pure function at `f - 2`, as the sway does.

## Check motion, do not guess

- `pnpm vf preview <person> --action <id> [--holds <item or icon>]` for one character.
- `node tools/stills.ts runs/<run> <outDir> <shotId> <frame>...` for a shot at representative frames (start, the anticipation, the peak, the settle).
- A contact sheet of the finished video (`tools/sheets.sh`) and `frame-review.json` from `video.review`.

## Camera rig (ADR 0025)

`Shot.angle` (eye, low, high, dutch, reverse), `lens` (wide, normal, tele: distance-compensated, the subject keeps its size) and `move` (drift by default, still, push, pull, track, orbit, handheld, pan, tilt, crane, zoom, crash-zoom, dolly-zoom; ADR 0026) are applied in `World.tsx` after the framing, before `hide`. The old `camera` values push, pan, shake and zoom-shake keep their own moves and ignore `move`. Measure a finished video with `measureMotion` (core) or read `qa.json`'s `motion` before judging whether a rig change made the picture move more.
