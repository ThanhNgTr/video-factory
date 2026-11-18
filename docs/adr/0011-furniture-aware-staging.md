# ADR 0011: Furniture-aware staging (walk paths, camera line of sight, front-view gait)

Date: 2026-11-16 · Status: accepted

## Context
In "The Halfway Diner" part 1 the producer saw a character walk through the counter and the stools, a medium shot filmed through a row of stools, and a walk that hopped from side to side. Causes: walks are straight lines between spots and nothing checked them against furniture; medium and close-up cameras sit on the side the character faces with no occlusion test; from the front both legs were foreshortened by the same amount, so both feet lifted together.

## Decision
- `packages/contracts/src/set-geometry.ts` owns the prop sizes (`PROP_SIZE`, moved from `SetView`) and turns a set's floor props into boxes (`obstacles`). Doors, windows, paintings, elevators and rugs are not obstacles.
- `checkSceneRefs` rejects a `toSpot` walk whose straight path (body radius 0.2 m) crosses a floor prop, and lists the spots reachable in a straight line from the start. The director's repair loop fixes it; `assets.check` enforces it on edited scenes. Props a spot already stands against do not count.
- `World.tsx`: a close-up, medium or over-shoulder camera whose view of the focus character's head is blocked moves to the room's open front (+z), and a walking focus is always filmed from there, so a walk across the room reads side-on.
- `Character2D` (ADR 0010): from the front only the leg stepping forward lifts; the other stays planted. A character on a path (`walking`) keeps both arms at their mean opening from the front, since a forward/back arm swing cannot be drawn there; turned views still swing them.

## Consequences
- Walks never cross furniture, but a path that goes around furniture is not possible; the director picks another pair of spots instead. Add waypoints if a story needs one.
- The fallback camera can still be blocked (a short character behind a counter seen from the front); then the counter hides them as it would on a real set.
- No line-of-sight test for wide, push and pan shots: they look over the set from the front, which sets are built for.
