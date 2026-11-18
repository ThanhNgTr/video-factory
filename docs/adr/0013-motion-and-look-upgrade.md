# ADR 0013: Smoother motion, stronger character design, colour that reads (three phases)

Date: 2026-11-17 · Status: accepted · Branch `feat/2d-characters`

## Context
The producer found the 2D characters stiff (hopping walks, stalls at every keyframe, a sine-wave mouth, metronome blinks), the designs plain and the colours flat next to the reference reels. All of it was in our own code, so each fix applies to every episode.

## Decision

### Phase 1, visible at once
- `samplePose` interpolates with Catmull-Rom through the keys instead of easing each segment to a stop, so velocity is continuous (test: no stall at a mid-swing key).
- A change of action blends over 8 frames from where the previous shot left the character; looping actions keep their phase across cuts (sampled on the absolute frame).
- A walk eases in and out, and its stride phase follows the distance covered at `WALK_SPEED` (1.1 m/s), so feet stay planted; the character settles to rest over the last 8 frames.
- Push and pan cameras ease in and out. Blinks land at a random moment of each ~3 s cycle, sometimes twice, seeded per character.
- Cards keep most of their colour in dim light: `cardLevel` maps the light level 0.55 → 0.78 and only a blackout darkens them fully; the mood tints are lighter. Dark 1.2 cm outlines sit behind the silhouette parts (head, torso, limbs). The cast got one strong colour each (mint, mustard, pale yellow, deep purple).
- Room shots (wide, push, pan, shake) back the camera up, or widen its field of view at the room's front wall, until everyone in the shot fits with a margin.

### Phase 2, alive
- Visemes from the letters of the word being spoken (`modules/video/src/domain/viseme.ts`, pure, tested): closed on m/b/p, teeth on f/v, round on o/u/w, wide on a, a rest before the next word. The mouth oval scales in both axes. Rhubarb Lip Sync stays the planned upgrade (roadmap §…): its install was not possible from this session.
- A stressed word (`*word*` in the script) triggers a 14-frame gesture chosen per word: a nod with a head tilt, a hand lift, or a lean.
- Listeners glance toward the speaker (pupils shift); hair lags the body's turns and moves by a few degrees.
- Arms have an elbow: upper and lower segments, the forearm folding inward from the front and forward in profile as the arm rises; held items stay upright in the hand.

### Phase 3, design
- `Person.build.shape` (soft, round, square, lean) sets the torso radius and width; `build.headShape` (round, oval, square) the head. Eyes carry a highlight. `outfit.pattern` (plaid, stars, stripes) prints the top in a tone between top and accent. New wear: `name-tag`, `long-fingers`. Peaked caps get a badge. New held items: `bag`, `coffee`, `bear`.
- Camera `insert`: the item the focus character holds fills the frame (checked: the focus must hold something). Lighting `red`: the room goes red and the cards nearly black, so only glowing eyes and teeth show. The director prompt (v4) asks for a close or medium shot on whoever speaks, one insert per shown prop, and red for the scare.
- `video.render` version 2, so existing runs re-render.

## Consequences
- Render cost rises a little (outline meshes, elbow segments, pattern shapes); measured on part 1 after this change, see the run log in the commit.
- Knees do not bend; legs are still one segment. No true profile drawing (3/4 at most, ADR 0010).
- Visemes are letter-based, not audio-based: a decent match for short English words, wrong for silent letters. Replace by Rhubarb cues when it is installed (same `Mouth` shape in, no renderer change).
- The gesture variants are fixed at three; a per-character gesture style would need data in `Person`.
