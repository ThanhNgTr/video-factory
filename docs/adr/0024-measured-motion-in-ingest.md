# ADR 0024: Ingest measures how the sample moves

Date: 2026-11-17 · Status: accepted

## Context
`ingest` showed Claude one still every `ceil(length / 40)` seconds (every 2 s for a 54 s Short) and asked for the formula and format. A still cannot show whether the camera travels, whether a character walks or stands, or how shots change, so the formulas described movement by guesswork and the formats said nothing about staging. Checked by hand on a 7-million-view cartoon Short ("What if humans invented teleportation?"): from 4-second stills it looked like characters mostly stand; motion maps and 6 fps filmstrips showed the picture moving in about two thirds of the seconds, characters walking with real strides, gesturing, sitting, and a small sad face planted at 3.5 s that returns at the end. Our videos, staged without that knowledge, hold still.

## Decision
- **Measure, then describe.** `ingest.download` reads the sample again as 72 x 128 grey frames at 6 fps (`ffmpegStdout`, raw video on stdout) and `domain/motion.ts` classifies every second, purely: a hard cut (a spike in the frame-to-frame difference, so a dissolve or a fast move is not one), the whole picture moving (most textured cells change and so does the frame's edge: a camera move or layers sliding), the camera holding while things move (with where in the frame), or still. A single global shift and zoom was tried first and rejected: 2.5D cartoons move their layers at different speeds, so no one transform lines two frames up.
- **Filmstrips where it matters.** `pickStrips` picks up to three 2-second windows (the strongest movement with the camera holding, plus one camera move; never across a cut) and ffmpeg tiles each into a 6 fps strip. `motion.json` keeps the seconds, cuts and strips.
- **Prompts get it.** `ingest.formula` and `ingest.format` send the stills plus the strips and the motion as text, told to trust it over the stills (`formula.md` v3: every beat's pattern says how the camera and the characters move, and a planted recurring image is a mechanic; `format.md` v2).
- **The director gets it.** `Format.staging` (optional, default empty: older formats parse, schemaVersion stays 1) holds 3-6 staging rules in the director's terms, learned from the measurement; `checkLearnedFormat` requires at least two. `script.direct` puts them in its prompt (`direct.md` v18).

## Consequences
- A learned format now says how much the camera and the characters move, so a remake moves like its sample instead of holding still. The thresholds were calibrated on one 2.5D cartoon; live-action or 3D samples may need another look (`node` the domain function on a file and read the per-second list).
- The renderer still moves the camera only on push and pan shots; a sample whose camera never rests will ask for more push and pan than the director has variety for. Gentle drift on every shot is the next step if remakes still look static.
- About one second of CPU per minute of sample; no new dependency (ffmpeg already runs here).
- Formulas and formats learned before this ADR have no staging; re-ingest a sample to get it.
