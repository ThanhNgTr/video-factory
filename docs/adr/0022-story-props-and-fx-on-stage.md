# ADR 0022: Story props and effects on stage

Date: 2026-11-17 · Status: accepted

## Context
The writer describes rich pictures ("a cardboard box sinks into the mud as rain falls", "a fridge is dragged into one corner and the house tilts"), but a shot could only say: a character on a spot, one of 33 generic actions, a face, a held item, a camera. Everything particular to the story vanished at staging, so the picture never showed what the narration said: a flood rendered as a character frowning in a dry room. The producer's review of the first eight videos named this first: motion and set do not match the captions, the story is not told, nothing to cut away to. A set per story would break the no-per-video-code rule; AI imagery is out (CLAUDE.md).

## Decision
- **`Shot.props`** (contracts `scene.ts`, `StageProp`): story objects standing in the set for a shot. Each is a drawn icon (library or `scene.icons`: drawn once by `assets.draw` and kept, ADR 0017) shown as a 2D card on a spot, with a size and a motion (still, drop, sink, tilt, shake, float, grow, vanish) starting `at` seconds in. `focus` may name a prop: closeup, medium and insert then frame the prop itself. **`Shot.fx`** adds rain, snow or flood water over the whole shot. Both fields are optional: older scene files parse unchanged, schemaVersion stays 1.
- **Renderer:** `World.tsx` draws props like characters (cards turned to the camera, the mood's tint, a shadow); the motion is a pure function of the frame in `domain/prop-motion.ts`; rain and snow are the diorama's `Weather`, moved to its own file and shared; a dropped prop thuds (`video.timeline`).
- **Checks:** `checkSceneRefs` holds prop icons, spots and ids to the cast's rules; `assets.check` inlines prop icons for the render.
- **Writer and critic:** `write.md` (v6) tells the writer what the stage can show and asks every beat for a visible change; the critic gains the universal criterion `visual`. `direct.md` (v16): an object the action names becomes a prop with the motion the action describes; a narrator line about an object or a place frames that, never a character standing still.

## Consequences
- Any object a story needs is one drawn icon, so the picture can follow the narration in every genre without new code. Furniture stays fixed per set (`Set3D.props`); a story prop stands on a spot, beside a character when they share one.
- Props are flat cards: nobody handles them (`holds` covers a thing in the hand), and physics is the fixed list of motions. A new motion is a case in `prop-motion.ts` plus a word in the prompt.
- Each new prop costs its first video a drawing (three LLM calls, about a minute); later videos reuse it from `library/icons`.
