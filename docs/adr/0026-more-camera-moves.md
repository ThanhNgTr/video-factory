# ADR 0026: More camera moves: pan, tilt, crane, zooms, dolly zoom, whip pan

Date: 2026-11-18 · Status: accepted · Extends ADR 0025

## Context
The camera rig of ADR 0025 could dolly (push, pull), slide with a walker (track), arc (orbit), shake and drift, but not turn on the spot, rise, zoom or whip. The producer asked for the standard panning and camera-move techniques. Horror and comedy samples lean on exactly those: a tilt from the feet up, a crash zoom on a face, a dolly zoom when someone realizes, a whip pan to "meanwhile".

## Decision
- `Shot.move` gains `pan` (the camera turns 25 degrees on the spot and lands on the subject), `tilt` (starts on the floor in front of the subject and tilts up to it), `crane` (rises from below eye level to over the heads, still aimed at the subject, capped under the ceiling), `zoom` (a slow 30% zoom in), `crash-zoom` (a 45% zoom in over the first 8 frames) and `dolly-zoom` (dollies in by up to 45% of the distance while the lens widens so the subject keeps its size: `dollyZoomFov`, tested). Every move ends on the shot's framing, so the room fit and close framing of ADR 0016 still hold at the end of the shot.
- `Shot.transition` gains `whip`: the camera comes in turning 70 degrees fast and settles in 8 frames, and the overlay blurs the picture under it (`backdrop-filter`, fading with the turn). Measured on CPU (swangle): the blur applies to the 3D canvas.
- The old `camera: "pan"` (a sideways slide) keeps its meaning; the new move `pan` is a real pan.
- `checkEditing` allows at most two dolly zooms, two crash zooms and three whips a video: repeated, they stop landing.
- Additive enum values: every older scene parses unchanged, `schemaVersion` stays 1. `direct.md` v21 tells the director when each one fits; `video.render` version 20.

## Consequences
- No new dependency and no extra render cost beyond a blur on 8 frames per whip.
- Not built: a directional (true) motion blur, rack focus (no depth of field in the renderer), a pan between two subjects within one shot (a pan always lands on the shot's focus).
