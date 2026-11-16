# ADR 0007: soft-clay / vinyl look: physical materials, smooth geometry, three-point rig, post-processing

Date: 2026-11-16 · Status: superseded by ADR 0008 (render cost on CPU); revisit with a GPU render machine

## Context
The flat toon look (ADR 0006) still read as rough blocks. The producer asked for a stylised vinyl-toy / soft-clay look with cinematic depth, keeping characters procedural (Three.js / React Three Fiber), their proportions and identity, and the existing props, rig and animation API.

## Decision
- **Materials** (`modules/assets/src/render/blocks.tsx`): every lit surface is `MeshPhysicalMaterial` with a preset per kind: `skin` (roughness 0.65, sheen 0.4 #ff8a65, clearcoat 0.1), `cloth` for clothes, hats and hair (roughness 0.5, metalness 0.05, clearcoat 0.2), `eye` (roughness 0.1, clearcoat 1.0), `matte` for sets (roughness 0.85). Unlit `glow` stays for lamps and the fixed eye catchlight.
- **Geometry**: spheres 64x48 (48x32 when small), rounded boxes with 6 segments, `CapsuleGeometry` limbs and neck with padding spheres at shoulder, elbow, hip and knee, `LatheGeometry` fedora with a raised band and a bell skirt, `TubeGeometry` on a `CatmullRomCurve3` for scarves and collars, torus arcs for brows, lash lines, smiles and elderly under-eye lines. Geometries are cached by parameters so per-frame re-renders never rebuild buffers. Micro details: button rows, pocket flaps, apron bib and skirt panel, translucent cheek blush.
- **Rig unchanged**: `Character` props, `characterGeometry`, and the pose channels (`armL/armR` at the shoulder, `legL/legR` at the hip, body x/y/rot/sx/sy). The elbow and knee are new joints with a fixed relaxed angle; nothing animates them yet.
- **Lights** (`composition/rig.ts`, `fx.tsx`): hemisphere #ffffff/#2c3e50 0.8, key directional 1.5 at [4, 8, 6] with 2048 shadows, warm rim spot 3.5 #ffd1a4 at [-4, 5, -5]. Offsets are in the camera frame, so they are exactly those positions for the character sheet and follow the framed subject in every episode shot. The rim spot uses `decay: 0` (with physical decay 2 it was invisible at that distance). Episodes scale the rig per mood (horror: fill 0.55, key 0.75, rim 1) and keep fog and practical lamps.
- **Post-processing**: `@react-three/postprocessing` `EffectComposer multisampling={4}` with `N8AO` (radius 0.5, intensity 2, falloff 0.8), `Bloom` (mipmap blur, threshold 1, intensity 0.3) and `ToneMapping` set to ACES Filmic: the library default AgX washed the yellow raincoat to khaki. N8AO is deterministic with `accumulate` off.
- **Remotion fix**: `PostFX` holds the frame with `delayRender` until the composer's pass list exists, then calls `advance()` once more. Without it the first frame of every render tab came out blank.
- **Tooling**: `tsconfig` moves to `moduleResolution: Bundler` because the post-processing package ships extensionless ESM type re-exports that `NodeNext` cannot follow; Biome `useImportExtensions` now enforces the `.ts` extensions Node needs at runtime.

## Amendment, same day: matte clay and character fixes
- Materials are matte: `skin` roughness 0.8 and `cloth` (clothes, hats, hair) roughness 0.82, both with clearcoat 0 and metalness 0; skin keeps its warm sheen. Only the iris and pupil keep the glossy `eye` preset (roughness 0.1, clearcoat 1); the eye white, mouth and tears are matte.
- Eyes: iris radius 0.41 of the eye's smaller side (was 0.36, +14%). At rest the upper lid covers the top 10% of the iris. The lid is a flat plate whose lower edge is the eye's own top arch moved down, so the margin stays curved and the lash arc sits on it (a straight lid read as a frown).
- Sam (`messy` hair): the bubble tufts are gone; four flattened tapered locks (lathe teardrops) grow from the crown, are combed down over the smooth cap edge and fanned 15-25 degrees, crossing over the forehead.
- Shoulders: a static deltoid ellipsoid on each side blends the torso's top corner into the arm, and the rotating shoulder sphere grew to 1.3x the arm radius: no doll-joint groove.
- Tall Guest: the grin is two rows of nine small rounded teeth placed by angle around the head and tilted with its curve, set in a dark band between two thin lip ridges; opening the mouth parts the rows. Faceless heads get two dark sockets under a thin brow ridge.
- Rosa: below the waist the apron is an open `CylinderGeometry` shell (thetaLength 0.65 pi, 0.02 outside the skirt, conical to follow the bell) with a rolled hem, tied on by a thin squircle waist band.

## Consequences
Measured on the dev machine (12 CPU cores, CPU WebGL `swangle`, 2 tabs), episode 1 frames 720-749:

| Variant | Seconds per frame | 2-minute episode |
|---|---|---|
| Before (toon, ADR 0006) | 0.31 | 19 min |
| New materials + geometry, no post-processing | 0.70 | 45 min |
| As specified (MSAA 4, N8AO full res) | 2.1 | about 2 h 10 min |
| N8AO half resolution | 1.9 | about 2 h |
| No multisampling | 1.2 | about 1 h 15 min |

- shortcut: post-processing at 1080x1920 on CPU WebGL is the bottleneck, upgrade when spike S1 delivers a GPU render machine (or drop MSAA / render post at half resolution if the CPU must stay).
- Golden-frame tests are still missing; the character sheet (`vf preview`) is the manual check.
