# ADR 0010: 2D characters on camera-facing cards inside the 3D sets (experiment, branch `feat/2d-characters`)

Date: 2026-11-16 · Status: proposed, on a branch for comparison with the 3D characters on `main`

## Context
The producer felt the procedural 3D characters still did not look as good as the reference reels and asked for a branch where characters are drawn in 2D inside the 3D world.

## Decision
- `modules/assets/src/render/Character2D.tsx` draws a person from the same library JSON, with the same proportions (`characterGeometry`), the same face measurements as ADR 0009 (in head radii) and the same props (`pose`, `face`, `mouthOpen`, `blink`, `frame`). The rig and animation data are shared with the 3D character.
- Every part is a flat vector shape (`ShapeGeometry`: ellipses, rounded rectangles, arc strokes, polygons, a hair cap with a smooth or jagged hairline). Resolution-independent, so close-ups stay sharp. A linear top-left to bottom-right gradient is baked into vertex colours (exact for a linear ramp) to mimic the reference's soft shading. Geometries are cached by parameters; changing sizes (an opening mouth) are scales of one cached shape.
- The card is unlit (`MeshBasicMaterial`) but tinted by the scene: a mood colour times the light level, so flicker, dim and blackout still apply; fog applies too. Parts are layered 2 mm apart on the card, so sets still occlude characters.
- In `World.tsx` the card always turns to the camera; the character's own facing chooses a front or back view and mirroring. Arm raises rotate in the card plane; a leg swing reads as foreshortening.
- `vf preview` shows front, turned-right, turned-left and back views plus a head close-up.

## Accessories (same day)
- Scene contract: a cast member may hold an item in the right hand (`holds`: card, key, phone, towel) and drip water (`drip`: up or down). Additive optional fields, so older scene.json files still parse and `schemaVersion` stays 1. Person `wear` gains `gloves`. New library actions `hold` and `hold-up`. The director prompt (v2) assigns items and drips only when the script shows them.
- 2D drawing: the item stays upright whatever the arm's angle and is scaled 1.5x to read at the characters' cartoon proportions; the card is a cream laminated rule card with a red header and handwritten lines; gloves are white with a cuff (also in 3D); drops travel from the hem as a function of the frame.
- `vf preview <id> --action hold-up --holds card` and `--drip up` show them on the character sheet.

## Turned views (same day)
- The producer saw only front views and a sliding walk. `Character2D` gains `side` (0 = front, 1 = turned toward +x; `mirror` turns it the other way), set by `World.tsx` from the sine of the angle between the character's facing and the camera.
- Turning slides and narrows the face toward the facing side (a 3/4 view at most), hides the far ear and moves the near one onto the side of the head, narrows the torso, gathers arms and legs under the body, and puts the far arm behind it.
- Limb angles keep the shared rig: from the front an arm angle opens the arm sideways and a leg swing is foreshortening; turned, both swing forward and back in the card plane (arm 20 = hanging, positive leg = backward), so a walk becomes a real stride and a held-up item points at whoever the character faces.
- Close-up and medium cameras still frame the face from the side the character faces, so turned views show in wide shots, walks across the frame and two-person shots (people facing the camera turn toward each other).

## Consequences
- Render cost: an 8-second sample took 86 s including startup (about 0.3 s per frame, about 20 minutes per 2-minute episode), the same range as the 3D toon look.
- Turned views stop at 3/4: there is no true profile drawing (one eye, nose silhouette). Add one if 3/4 reads badly in wide walking shots.
- Merging means choosing one renderer (or a `characterStyle` field per series); not decided yet.
