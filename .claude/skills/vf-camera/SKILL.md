---
name: vf-camera
description: Camera angles, shot sizes, camera moves, cuts and transitions for Video Factory - the shot rig (camera, angle, lens, move, transition, jcut, focus), coverage, establishing shots and cutaways, shot/reverse, the editing grammar checkEditing enforces, pacing toward the climax, and measuring motion against the sample. Use when changing how the director stages shots (modules/script/prompts/direct.md, a format's staging), checkEditing, framing or the rig in World.tsx and domain/framing.ts, J-cuts in video.timeline, or when a video looks static or its cuts read as jump cuts.
---

# Camera and editing in Video Factory

The director (`direct.md`) writes every shot of `scene.json`: `camera` (framing: wide, medium, closeup, over-shoulder, insert; and the older moving setups push, pan, shake, zoom-shake), `angle` (eye, low, high, dutch, reverse), `lens` (wide, normal, tele; distance-compensated, so the subject keeps its size and only depth changes), `move` (drift by default, still, push, pull, track, orbit, handheld, pan, tilt, crane, zoom, crash-zoom, dolly-zoom; ADR 0026), `transition` (cut, fade, flash, whip), `jcut`, and `focus` (a cast member or a prop). `World.tsx` and `modules/video/src/domain/framing.ts` frame first (room fit per person's depth, reach toward a held item, foreground furniture removed, a blocked view moved to the open front), then apply the rig (ADR 0025).

## What each choice means

| Want | Use |
| --- | --- |
| Calm talk | eye angle, normal lens, drift; medium or closeup on the speaker |
| Dread, power | low angle with a push |
| Small, trapped | high angle |
| Wrong, unsafe | dutch, once or twice a video |
| The other side of an exchange, what they look at | reverse |
| Tension, being watched | tele lens, still or a slow push |
| Chaos, a chase, horror distortion | wide lens, handheld |
| A reveal | pull, orbit, or pan from what they look at to them |
| Feet, water, a dropped thing first, then the face | tilt |
| The view opens, the end of a scene, how small they are | crane |
| A thought dawning, being watched | zoom |
| A shock or a gag on a face or object | crash-zoom (two a video at most) |
| The moment someone realizes the horror | dolly-zoom (two a video at most) |
| "Meanwhile", a sudden look elsewhere | whip transition (three a video at most) |
| A walk across the room | track (walkers are filmed side-on from the front) |
| Impact, jump scare | shake, zoom-shake, with an sfx cue |
| A jump in time, the end | fade (through black) |
| A shock, a memory | flash (white) |
| The voice leads the eye | jcut on about every third spoken shot, never the first |

## Coverage and cutting

1. **Every cut changes the picture**: size, angle or subject. `checkEditing` rejects two shots in a row with the same set, camera, focus and angle. Change size by a full step (wide → medium → closeup), and for a reason: a closer size says "this matters now" (a face realising, the object that counts), a wider one resets where everyone is.
2. **The speaker gets a medium or closeup.** Room shots (wide, push, pan, shake) are for arrivals, the whole room and silent tension, and show everyone in the beat (ADR 0012). No more than two room shots in a row on a still cast.
3. **Establish every place** the first time and on every return: a silent wide, 1-1.5 s.
4. **Cut away at least every 8 s of talk:** 0.8-1.5 s, no line, showing what the words are about (a prop insert, a listener's reaction, the window). Hold on the object before the line that reveals it; cut to the silent room after a punch line.
5. **Shot and reverse for an exchange.** The listener's reaction often sells the joke more than the line.
6. **One camera move per shot**, motivated by the story; drift is ambient, not a move (`shot-composition`).
7. **Keep screen direction.** A walker who leaves frame right enters the next shot from the left; pick spots for consecutive walks so the direction holds. The reverse angle flips left and right, so keep it for exchanges, where the viewer expects the flip.
8. **Pace toward the climax:** shots shorten in the last third and silent shots there stay at 2 s or less (checked); the final shot may hold.
9. **A shot lasts as long as its line** (0.6 s + 1 s per 14 characters); every extra second is dead air.
10. **Over graphics and dioramas** the camera field is ignored; an explainer keeps a host in a set with the graphic as an `inset` and saves full-frame graphics for the 2-3 biggest reveals.

## Changing the camera system

- A habit that can be checked goes into `checkEditing` (`packages/contracts/src/editing.ts`) with a test, not into another prompt paragraph (ADR 0025): the director's repair loop then fixes it.
- A new angle, move or transition: an enum value in `packages/contracts/src/scene.ts` whose default keeps old behaviour, a pure function of the frame in `World.tsx` / `framing.ts` (tests in `modules/video/test/framing.test.ts`), `Overlay.tsx` for transitions, one line in `direct.md` with its version bumped, and a `video.render` version bump.
- Out by choice (ADR 0025): true dissolves (two 3D scenes per frame on a CPU), split screens, cuts inside a line (one line per shot keeps lines verifiable).
- Genre-specific camera habits belong in the format's `staging` (at most 8 rules, learned from the sample's measured motion).

## Measure, do not guess

- `qa.json`'s `motion` (share of seconds the picture moves, seconds per cut) against the format's `motion` from its sample; `video.qa` warns below half. Same measure: `measureMotion` in `packages/core/src/motion.ts`.
- Frames: `node tools/stills.ts runs/<run> <outDir> <shotId> <frame>...`; the whole cut: `tools/sheets.sh`; defects (face-hidden, cut-off, bad-framing): `frame-review.json`.
- See also `shot-composition` (focal point, lead room, dolly zoom), `beat-sync-editing` (J/L cuts, pacing arc), `short-form-video` (a pattern interrupt every 2-4 s), `vf-motion` (how the rig and characters move).
