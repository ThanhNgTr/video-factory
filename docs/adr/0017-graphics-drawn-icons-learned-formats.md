# ADR 0017: Motion graphics, icons Claude draws, and formats learned from a sample

Date: 2026-11-17 · Status: accepted

## Context
The goal of the factory, restated by the producer: given one sample video, a similar video on the same topic within 20 to 30 minutes, in any genre, with no developer in the loop. For the genre the factory already knew (a narrated horror series) the line ran in about 20 to 25 minutes. A knowledge short ("why folding paper 42 times reaches the Moon") could not be made at all: everything on screen came from a closed, hand-coded vocabulary (4 sets, 9 characters, 7 held items, 25 actions), there were no graphics for numbers or comparisons, formats were written by hand, and the director silently swapped what was missing for the nearest thing it had.

The reference project AI-Video-Factory (MIT) covers arbitrary topics by letting Claude author vector art at run time, checked by a blind guess and a scoring gate, and by compiling small JSON specs (formulas, charts, maps) into visuals with code. Its image and video model modes do not fit our rules and were not taken.

## Decision
- **Graphic shots** (`Shot.graphic`, `packages/contracts/src/graphic.ts`): a shot can be a motion graphic that fills the frame instead of a set: `count` (a number counting up), `scale` (a bar growing on a log scale past landmarks; unit "m" is shown as mm, m or km), `chart` (line or bar, linear or log, one highlighted point), `formula` (up to 3 lines, `^` raises), `list` (2 to 5 steps), `icons` (1 to 4 pictures with labels and values). The director fills in the numbers; `Graphics.tsx` draws them, between the HUD and the captions, as a pure function of the frame. A graphic shot has no set and no cast; only the narrator speaks over it. Growth moves evenly through orders of magnitude, so each power of ten gets the same screen time.
- **Icons Claude draws** (`assets.draw`): the scene declares icons the library lacks (`scene.icons`, id plus a one-line brief). Claude (`models.draw`, sonnet) writes an SVG under an allowlist (`checkSvg`: plain shapes, groups and gradients; no text, script, images, links or style), FFmpeg's librsvg turns it into a PNG, a viewer who is not told the subject names it, and a gate scores recognisability with that guess in hand (`models.gate`). Below 7 the drawer edits its own drawing from the defects, at most 3 draws. An icon that never passes is left out and the graphic shows its label; the episode never stops. Passed icons join `library/icons/` when the run ends, so every later video reuses them for free. Claude-authored SVG is data drawn by our renderer, not an image model: it keeps the rule that a video is data rendered by our own code.
- **Formats learned from the sample** (`ingest.format`): besides the formula (story mechanics), ingest now writes a format (kind `explainer` or `skit`, length, beats, speech budget, writing rules and a genre rubric for the critic) in our vocabulary, checked by `checkLearnedFormat`. `vf like <link> [--idea "..."]` learns both and makes a video right away; the Studio's learn page does the same with one button, and every learned sample can make more videos.
- **A built-in `explainer` format** with an `accurate` must-pass criterion, so the critic checks the arithmetic and facts of a knowledge short. A script's cast may be empty (a narrator over graphics), and a script needs a formula only when one is given (a sample or a series): without one the format's rules carry it.

## Consequences
- Measured on this machine (CPU render):

  | Run | Total | Biggest steps | Cost |
  | --- | --- | --- | --- |
  | Explainer from an idea, 42 s video, 6 new icons | 4 min 49 s | write 95 s, render 82 s, icons 48 s | $0.91 |
  | `vf like` from a real YouTube Short, 59 s video with a host character | 13 min 8 s | learn 105 s, write 289 s, render 314 s | $1.86 |

  Graphic shots render at about 2 s per second of video, five times faster than 3D room shots.
- New genres now need data, not code: a learned format, icons drawn on demand, graphics specs from the director. Still missing: characters and sets authored at run time (a presenter, a classroom), characters holding drawn icons, and maps; they are the next steps of the same plan.
- The icon library grows with use; its quality is only as good as the gate. Reviewing `library/icons/` now and then (and deleting a bad icon, which is then redrawn on demand) keeps it honest.
- Changing `prompts/draw.md`, `guess.md` or `gate.md` re-draws only icons not yet in the library.
