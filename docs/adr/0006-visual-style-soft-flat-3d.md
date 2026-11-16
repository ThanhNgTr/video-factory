# ADR 0006: visual style = soft flat-shaded 3D, no outlines, navy low-key light

Date: 2026-11-16 · Status: accepted again by ADR 0008 (shading and lighting); face rules still apply

## Context
The demo rendered block characters with a 4-band toon ramp and a thick inverted-hull ink outline. Compared with the reference reels (3D low-poly, flat shading, almost no outlines, one warm light in a navy fog), it read as a toy. The reference is 3D, not 2D: perspective, shadows and camera moves are consistent across shots.

## Decision
- `blocks.tsx`: 32-step gradient ramp lifted to 0.42 in the shadow (faces stay readable in the dark), outline thickness `LINE = 0` (constant kept to re-enable).
- `World.tsx`: `LIGHT` table moved to navy fog, low cool ambient, one warm key light that follows the camera and aims where it looks, weak cool rims, dim warm lamps. The green horror tint is gone.
- `Character.tsx`: ellipsoid (round) skull, features placed on its surface with `onSkull()`, thin neck cylinder, ears, almond eyes with iris/pupil/lids and a soft bag, two-segment brows, nose, lips with an expression curve. Hair is one ellipsoid slightly larger than the skull, shifted up and back: the intersection of the two surfaces is a clean hairline (no seams). Body: one rounded torso block whose corners are the shoulders, capsule limbs, small round hands. Fedora-style hat, hood as a tilted dome, scarf tail.
- `Overlay.tsx`: no speaker name label (the reference never names the speaker; the voice and framing do it).
- `vf preview <personId>` renders a character sheet (3 angles + close-up) for iterating on the look.

Face rules learned from the first round (Lily looked wrong): the iris must stay inside the eye white (`0.36 * min(w, h)`); small face details (nose, brows, moustache) cast no shadow, because their shadow reads as grey stubble; no lip strips on light skin; under-eye bags only for elderly characters (grey/white hair); children get a button nose and thinner brows; ears hide under long hair or a hood. Big spheres (head, hair) use 40x28 segments so they do not look faceted. A hood is a double-sided dome whose opening faces forward and slightly down, with a rolled rim; it receives but does not cast shadow (self-shadowing striped it), and the hair cap underneath is tighter so only a fringe shows.

## Consequences
- The look is decided by three files; sets and props inherit the shading automatically.
- Golden-frame tests (roadmap §6.6) should be added before further style work so regressions are caught.
- Still missing versus the reference: seated poses, hand-held props, foreground occluders and shallow depth of field (roadmap GĐ 2 items).
