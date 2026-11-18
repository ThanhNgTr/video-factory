---
name: vf-sets
description: Set and location design for Video Factory - Set3D rooms and outdoor places, furniture from prop types, spots and seats for blocking, walk lanes, lamps, colour and value against the characters, story props versus furniture. Use when designing or editing library/sets/*.json, the scout and set designer (modules/assets/prompts/scout.md, set.md, design-gate.md), checkSetDesign or set-geometry.ts, SetView, or when a place reads wrong, blocks the camera or traps a walk.
---

# Sets in Video Factory

A set is data: `Set3D` in `packages/contracts/src/library.ts`. A room (or `outdoor: true` with a `sky`) of `w` x `h` between `back` and `front` on z, wall and floor colours with `floorStyle`, `wallStyle` and an optional `wainscot`, up to 12 `lamps`, up to 80 furniture pieces from the 12 `PROP_TYPES` (box, cylinder, shelf, counter, door, window, sofa, plant, elevator, painting, rug, chair) and 1-12 `spots`. `SetView.tsx` builds it low-poly, with a fourth wall behind the camera for reverse angles (ADR 0025). For a place the library lacks, a scout (`scout.md`) names at most 2 missing places, the designer (`set.md`) writes a `Set3D`, `checkSetDesign` validates it, and a gate scores a wide still (ADR 0018). A series stays in its bible's `sets`.

## Design rules

1. **Design for the camera.** Cameras film from the open front (+z) and stand about 0.5 m inside `front` for wide shots. Keep the front 2.5 m free of anything taller than 1 m. Put the hero furniture at the back and middle, facing the front.
2. **Design for blocking: spots are the staging.** 5-9 spots, each at least 0.5 m from furniture: an entrance by a door (people leave by walking to it, `exitPoint`), a spot at the main piece, two open-floor spots near the camera (z 0-2) for dialogue, and seat spots wherever the story sits or lies. A seat spot sits at the front edge of its seat, facing out, with `seat` = its height (chair or sofa 0.45, stool 0.75, bed 0.5).
3. **Leave walk lanes.** Walks are straight lines, and `checkSceneRefs` rejects one that crosses floor furniture (body radius 0.2 m, ADR 0011). Spots people move between need a clear straight path.
4. **The place reads in one wide shot**: 2-3 hero pieces name it (counter + stools + pie case = diner; desks + blackboard = classroom), then supporting pieces, then dressing. Build recognisable things from boxes and cylinders (`set.md` has the recipes and sizes). Squint at the wide still: the acting area and the hero piece should still stand out; if the dressing wins, cut it.
5. **Sets are background.** Muted, mid-value walls and floor so the characters' strong colours pop (`vf-characters`); one accent colour on the hero piece. Texture comes from `floorStyle`, `wallStyle`, `wainscot`, not from more props. Mood (bright, night, horror) and lighting tint the room at render: choose base colours for normal light and check them under dim.
6. **Lamps light the acting area** (2-6 over the spots), not the corners.
7. **Furniture is fixed; story objects are props.** What the story adds, breaks or moves (a box, a sign, a fridge being dragged) is a `Shot.props` icon (`vf-fx`), never a new set.
8. **Generic and reusable.** Sets are kept and reused by later videos: `hotel-lobby`, never this story's lobby; spot ids say what the place is (`behind-desk`, `by-the-window`, `entrance`).

## Changing the set system

- A new furniture type: `PROP_TYPES` and the sizes and obstacle rules in `packages/contracts/src/set-geometry.ts`, its drawing in `SetView.tsx`, a test; `set.md` receives types and sizes from code (`{{types}}`, `{{sizes}}`), so bump its version only if its wording changes.
- A rule a designed set must keep goes into `checkSetDesign` (`set-geometry.ts`) so the designer's repair loop fixes it, not into a prompt paragraph alone.
- Library edits reach existing runs on resume: `assets.check` fingerprints sets (ADR 0016).

## Check, do not guess

- A designed set is pictured and gated inside `assets.design`; read its score and the still in the run folder.
- A library set: render frames of a run that uses it with `node tools/stills.ts runs/<run> <outDir> <shotId> <frame>...`, or tile the video with `tools/sheets.sh`. Ask: does the wide shot name the place? Are close shots blocked by furniture (ADR 0011 falls back to the open front)? Do sitters line up with their seats? Do characters stand out from the walls?
