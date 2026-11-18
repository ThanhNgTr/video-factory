# ADR 0020: From a viewer's review of like-2: outdoor sets, inset diagrams, title badges, sound the picture calls for

Date: 2026-11-17 · Status: accepted

## Context
A frame-by-frame review of `like-2.mp4` (a "you build it" explainer) found: a static backdrop that never showed the step being explained, and a ceiling with fluorescent lamps over an outdoor lot; hair standing off the temples of an oval head; the same shock reaction three times; step titles across the middle of the picture in the captions' style; and, in effect, no music or sound effects (the pad played at about -46 dB and only two cues existed). The producer asked for the picture first, then the sound. Fixes had to serve every video, not this one (no hand-made "house cross-section" component).

## Decision
- **Outdoor sets** (`Set3D.outdoor`, `sky`): ground running past the frame, a sky backdrop, no ceiling, side walls or ceiling lamps, daylight ambient. The set designer (prompt v3) marks streets, yards and sites outdoor.
- **Inset graphics** (`Shot.inset`): any graphic kept in a card at the top right while a set scene plays, drawn on a virtual box and scaled, so the diagram of what has been built stays on screen between the full-frame graphics (the learned format's rule). The director (prompt v13) gives build-up stories an inset on every scene shot.
- **Title badges:** only the opening shot's text is a big card; later shots' text is a badge under the HUD in its own style (dark pill, accent bar), keeping clear of an inset.
- **Hair fitted to the head shape** (oval, square) and its lag limited to 6 degrees; new reactions `scratch-head`, `eureka`; the director may not give one character the same reaction more than twice.
- **Sound the picture calls for:** `video.timeline` writes `Timeline.cues` from the graphics' own timing (`domain/graphic-timing.ts`, shared with `Graphics.tsx`): a whoosh into a graphic, a pop per list item, formula line and icon, a tick roll for counts and scales, a thud per landing layer (insets too), a chime as the last shot opens. `audio.mix` plays them at their own levels under the director's story cues.
- **Music under the narration, measured:** the bed is set `musicDuckDb` (-16 dB) under the first speech clip's loudness, whatever level its file was made at, and still ducks while the narrator speaks. A synthesized upbeat loop (`tools/synth-music.ts`, `bright-bounce`) serves bright moods; the night pad keeps night.

## Consequences
- Explainers get continuous illustration and a sound bed without the director placing a single cue.
- Things in a set still do not change from shot to shot (a house gaining a roof); the inset carries that progress. A set prop that evolves is a later step.
- The audio library is still procedural placeholder audio (roadmap S6).
