# ADR 0019: Knees, postures and seats; the layers cross-section

Date: 2026-11-17 · Status: accepted

## Context
Every character could only stand: each leg was one straight piece turning at the hip, spots were points on the floor, and the director had 25 standing actions to choose from, so "she sits at her desk" was staged standing. A second viral sample ("you build it": a thing evolves layer by layer on a cutaway diagram) also needed a visual the graphics did not have.

## Decision
- **Knees.** `PoseKey` gains `kneeL`/`kneeR` (degrees of fold). With a knee bent, `Character2D` draws a thigh, a round knee and a shin: in profile the shin folds back in the card plane; from the front a part pointing at the camera shortens to the cosine of its angle, and a seated lap is drawn over the shirt. Actions without knees draw exactly as before.
- **Ground contact and seats** (`bodyLift`, shared by the renderer and the camera): folded legs of an upright body lower it until a foot is on the floor (kneel, crouch); a sitting action sets the hips on the spot's seat; a lying action rests the turned body on the floor or is lifted onto the seat (a bed, a sofa). Changing posture between shots moves the hips over 10 frames while the legs fold. The camera frames a seated or kneeling head where it is.
- **Data:** `Action.posture` (`stand` | `sit` | `lie`), `Spot.seat` (the seat's height). New actions: `sit`, `sit-talk`, `lie`, `sleep`, `kneel`, `crouch`. Library sets gained seat spots at the front edge of their seats (diner booth and stool, lobby sofa, classroom chairs), so the seat stays behind the sitter.
- **Checks:** a sitting action needs a seat spot (the error lists the set's seats); nobody walks sitting or lying. `checkSetDesign` lets a seat spot overlap its own furniture. The director (prompt v11) and the set designer (prompt v2) know seats and postures; a person who has the shot's line at a spot facing away turns round.
- **`layers` graphic:** a cross-section listed bottom first; layers before `reveal` are already there, the rest drop in and the newest is outlined; an icon can stand on top. Repeated shot after shot with one more layer, it shows something being built.

- A close or medium shot of someone lying down or fallen flat frames the whole body from the open front (its middle estimated from the turn and the facing); aimed at the standing head height, a fall ran off the frame.
- Found while making the second sample's video:
  - a learned format's minimum length is now a writing rule too: `checkScriptRefs` asks for at least `maxSpokenChars x (min - 7) / (max - 7)` characters, so a short script is lengthened before the render instead of failing QA after it;
  - QA lets a video run up to 10% under the format's minimum (shorter holds viewers better), never over its maximum;
  - `RemotionRenderer` removes its webpack bundle (about 50 MB) when its process exits: a hundred runs had filled the `/tmp` RAM disk and every write failed.

## Consequences
- Characters sit at desks, counters and sofas, lie in bed or on the floor, kneel and crouch, all chosen by the director from data; new postures are new action files.
- A seat spot is a separate spot: walking to a chair and sitting are two shots. Seated people are not yet shown getting up mid-shot, and two people cannot share one sofa spot.
- Every run re-renders (`video.render` version 9).
