# ADR 0021: 3D build dioramas

Date: 2026-11-17 · Status: accepted

## Context
The producer asked for a 3D remake of a viral "how a strip of dirt becomes a road" Short. Its mechanic: one fixed camera looks down a road with houses and trees, the ground in front is cut away so the layers under the road show in section, and every line of narration changes that one model (a layer of stones drops in, rain soaks the soil, ice lifts the road, asphalt and lines go on). Our sets are rooms with characters on spots, and our `layers` graphic is flat 2D, so neither can show a build growing in 3D. A hand-made scene for this one video would break the factory rule (no per-video coding).

## Decision
- **`Shot.diorama`** (contracts `diorama.ts`): data for a 3D strip of ground, not a scene file. Layers from a fixed list of materials (soil, clay, sand, gravel, stones, crushed rock, concrete, asphalt, water, ice, logs) with thickness; `reveal` (the layers already there); the strip's surface; pieces (crown, ditches, cracks, pothole, ice lens, water seep, painted lines, curb, sign); weather; a vehicle; a view (the whole road, or close on the cut face). `checkSceneRefs` checks it like a graphic: no set, no cast, narrator only.
- **`Diorama.tsx`** draws it as a pure function of the data and the frame: the ground and each layer are cross-section profiles extruded along the strip, so the front cap is the cut face and the top is the surface; rocks, rain and snow come from seeded random numbers; new layers drop in on a spring, a vehicle with headlight eyes drives up the road. `World` hands a diorama shot to it instead of a set.
- **Sound:** each new layer thuds as it lands, from `dioramaDrops` in `domain/graphic-timing.ts`, shared by the picture and `video.timeline`.
- **Director (prompt v15):** when a story builds or breaks something in the ground layer by layer, most shots are dioramas, each repeating the last shot's state plus what its line adds.
- **New layers are found, not declared:** the layers a shot has that the last diorama shot lacked (matched bottom up by material) come in; a layer on top drops, one slipped under others grows in place. `reveal` only sets what is there when the first diorama opens, since a model miscounts it and a mid-stack layer (a subbase) cannot be described by an index.

## Consequences
- Any "how X is built under the ground" story (a road, a driveway, a rail bed, a path) gets a 3D model that grows line by line with no new code. Builds that are not a strip of ground (a house, a dam, a bridge) need another diorama kind.
- The backdrop (houses, trees, clouds) is fixed; pieces are a closed list. A new piece is code plus a prompt line.
- Remakes keep the sample's mechanic (a cut-away model growing per line), never its words or story.
