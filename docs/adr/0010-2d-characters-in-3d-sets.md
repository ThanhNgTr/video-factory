# ADR 0010: 2D characters on camera-facing cards inside the 3D sets (experiment, branch `feat/2d-characters`)

Date: 2026-11-16 · Status: proposed, on a branch for comparison with the 3D characters on `main`

## Context
The producer felt the procedural 3D characters still did not look as good as the reference reels and asked for a branch where characters are drawn in 2D inside the 3D world.

## Decision
- `modules/assets/src/render/Character2D.tsx` draws a person from the same library JSON, with the same proportions (`characterGeometry`), the same face measurements as ADR 0009 (in head radii) and the same props (`pose`, `face`, `mouthOpen`, `blink`, `frame`). The rig and animation data are shared with the 3D character.
- Every part is a flat vector shape (`ShapeGeometry`: ellipses, rounded rectangles, arc strokes, polygons, a hair cap with a smooth or jagged hairline). Resolution-independent, so close-ups stay sharp. A linear top-left to bottom-right gradient is baked into vertex colours (exact for a linear ramp) to mimic the reference's soft shading. Geometries are cached by parameters; changing sizes (an opening mouth) are scales of one cached shape.
- The card is unlit (`MeshBasicMaterial`) but tinted by the scene: a mood colour times the light level, so flicker, dim and blackout still apply; fog applies too. Parts are layered 2 mm apart on the card, so sets still occlude characters.
- In `World.tsx` the card always turns to the camera; the character's own facing chooses a front or back view and mirroring. Arm raises rotate in the card plane; a leg swing reads as foreshortening.
- `vf preview` shows front, mirrored and back views plus a head close-up.

## Consequences
- Render cost: an 8-second sample took 86 s including startup (about 0.3 s per frame, about 20 minutes per 2-minute episode), the same range as the 3D toon look.
- No profile views yet: a character walking sideways is drawn mirrored front-on. Add profile drawings if the producer keeps this branch.
- Merging means choosing one renderer (or a `characterStyle` field per series); not decided yet.
