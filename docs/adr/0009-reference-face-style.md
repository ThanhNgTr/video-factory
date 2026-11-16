# ADR 0009: faces and heads follow the reference reels

Date: 2026-11-16 · Status: accepted · Builds on ADR 0008 (toon shading, no post-processing)

## Context
The producer sent frames of the reference series (quickwatch.tv "Line 9") and asked for characters in that style. Measured on those frames, as fractions of the head width W: a spherical head sitting almost on the collar; round white sticker eyes about 0.30W wide at plus/minus 0.18W, solid black pupils half the eye's width looking slightly down, one catchlight upper left; thick arched brows about 0.055W thick and 0.22W long; a small ball nose a little pinker than the skin; a thick dark mouth stroke; round ears at eye level; a jagged triangular fringe on the young man; on the old man, heavy lids, pale rings under the eyes, grey puffs over the ears and an arched moustache.

## Decision
- `Character.tsx` holds these proportions in one `FACE` table (fractions of W). The head is a sphere (`head.h = head.w`), the neck is 0.05.
- Eyes: flattened white ball sunk into the skull, black pupil offset down by 0.1 of the eye, fixed catchlight on the same side for both eyes. Young characters rest wide open; elderly characters (grey or white hair) rest with a 36% curved lid and a pale ring under each eye. Children use 0.34W eyes.
- Brows are the top 1 radian of a thick torus; the nose is one ball; mouths are a thick arc, a capsule or a dark oval when talking; the moustache is a thick torus arch.
- Hair caps sit higher (front hairline about 0.69 of the half-height, 0.81 for the jagged fringe) so the forehead and brows show; `messy` hair adds four flattened cones whose points rest just above the brows; `bald-sides` is two round puffs over the ears plus a band at the back (ears hidden). The hood opening is wider (theta 1.9) for the bigger eyes.
- Bigger hands, a thicker scarf with a flat hanging end.
- This replaces the earlier face requests where they conflict: the reference has solid black pupils (no coloured iris) and no resting lid on young characters.

## Consequences
- Render cost is unchanged: 30 frames in 17 s including startup, about 0.25 s per frame.
- The library JSON needs no change: the style is derived from existing fields (`eyes`, `brows`, `hair`, `mustache`, `build`).
