# ADR 0025: A camera rig and an editing grammar

Date: 2026-11-17 · Status: accepted

## Context
Measured with the same tool as the samples (ADR 0024), our subway remake moved the whole picture in 11% of its seconds against the sample's 47%, stood fully still 19% of the time, and 29 shots read as 6 cuts because consecutive shots framed the same thing from the same place. The camera was a handful of hard-coded positions in `World.tsx`: always at eye level, always from the room's open front, one narrow lens, moving only on `push`, `pan` and `shake`. Cuts fell exactly where lines started, every shot had the same padding, and nothing stopped the director from lighting half a video red. The producer's review named camera and editing as the widest gap to the samples.

## Decision
- **The shot describes its camera** (contracts `scene.ts`, all defaulting to the old behaviour but one): `angle` eye | low | high | dutch | reverse, `lens` wide | normal | tele (distance-compensated, so the subject keeps its size and only the depth changes), `move` drift | still | push | pull | track | orbit | handheld, `transition` cut | fade | flash, `jcut`. The default move is `drift`: no shot stands dead still unless the director says `still`. The old `camera` values push, pan, shake and zoom-shake keep their moves.
- **Sets get a fourth wall** (`SetView`, cast no shadow), so a reverse angle has something behind the subject.
- **The renderer applies the rig after the framing** (`World.tsx`), the overlay draws fades and flashes and styles captions by the format's `kind` (`RenderProps.kind`: an explainer reads in a lower-third pill, a skit in bold caps), and `video.timeline` makes a J-cut by holding the previous picture `JCUT_FRAMES` longer while the new line starts; it also cues rain and wind beds under `fx`.
- **An editing grammar is checked, not hoped for** (`checkEditing` in contracts, run by `script.direct` like the reference checks): no two consecutive shots with the same framing, subject and angle in one set; red light at most three shots in a row and a quarter of the video; no silent shot over 2 s in the last third. The director prompt (v20) explains the rig and the grammar and asks explainers to keep a host on screen with the graphic as an inset.
- **The loop closes with a measurement:** `ingest.format` stores the sample's `motion` numbers (share of seconds the picture moves, seconds per cut); `video.qa` measures the finished video the same way into `Qa.motion` and warns when it moves less than half as much as the sample. It warns rather than fails: a wrong-looking number should be looked at, not thrown away with the render.
- Smaller, from the same review: `video.thumb` takes the brightest of a few early frames; horror ambient light is a little higher; learned formats may speak 13 characters a second now that shots carry no dead air.

## Consequences
- A remake can move like its sample without new code per genre: the director picks from the rig, the grammar check sends a flat cut list back. Fixing a bad habit means a line in `checkEditing`, not a new prompt paragraph.
- Still missing, by choice: true dissolves (two 3D scenes per frame on this CPU), cuts inside a line (the one-line-per-shot invariant keeps lines verifiable), split screens, a first-person hand. The measurement warning is not yet fed back into the director automatically.
- Old scenes render as before except for the drift, which is the point.
