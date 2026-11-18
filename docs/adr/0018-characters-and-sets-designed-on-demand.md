# ADR 0018: Characters and sets designed on demand, and characters holding drawn icons

Date: 2026-11-17 · Status: accepted

## Context
ADR 0017 made graphics and icons data the pipeline writes itself, which covers narrated explainers. A story or comedy sample still needed a developer: the library had 9 characters and 4 sets (a diner, a hotel), so an office skit was staged in a diner, and a story about a teacher was played by a night clerk. Characters could only hold 7 hand-coded items.

## Decision
- **The writer may describe new characters** (`Script.newCast`: id, name, look; at most 3). `checkScriptRefs` accepts them in `cast`.
- **`assets.design`** (after `script.write`, before `script.direct`) designs what the library lacks, as data:
  - each new character: Claude picks the `Person` parameters (build, silhouette, colours, hair, face, outfit, wear, an edge-tts voice from a fixed list); our renderer pictures it as a character sheet (`Snapshot` port, the `Preview` composition);
  - each missing place: a scout reads the beats against the library's sets and names at most 2 missing places; Claude writes a `Set3D` (room, props from our prop types, lamps, spots) that must pass `checkSetDesign` (everything inside the room, wall props on a wall, spots on open floor, the front clear for the camera) before it is pictured from the wide camera (`Main` composition, one empty shot).
  - a gate (`prompts/design-gate.md`, `models.gate`) scores the picture against the description; below 7 the designer edits its own design from the defects, at most 3 rounds. The best design is always kept: the story needs that character or place.
  - A series keeps staging in its bible's sets (no scout); a narrator over graphics (empty cast) designs nothing.
- `script.direct`, `assets.check` and `audio.tts` see the library plus `designs.json` (`withDesigns`); TTS takes voices from `assets.json`. When the run ends, `vf make` copies designed characters and sets into `library/people` and `library/sets` (any score: the video shows them, and a later part may need them back).
- **Characters hold any icon**: `CastMember.holds` is a built-in item or an icon id (library or `scene.icons`). `Character2D` draws an icon in the hand as a texture decoded from its SVG. `<IconsReady>` decodes every icon a video uses before the 3D canvas mounts (held with `delayRender`), so the first frame already has them; decoding inside the card raced the frame capture and the first render missed the icon. Nothing is fetched.

- The gate is told what the renderer can and cannot draw (`limits`): a character is judged on whether its role reads (age, gender, build, attitude), not on details no parameter can show (braids, a cardigan). The first real run, judged without it, spent all three rounds on one teacher at 4/10. The designer maps such details to the nearest part (a cardigan is a coat). The character sheet shrinks tall characters so their heads stay in the picture.
- Two validators read a `--json-schema`: the claude CLI's own (draft-07, strict, where `prefixItems` is unknown) and the API's (draft 2020-12, where an `items` array is invalid). The tuples zod emits for positions failed one or the other, so every set design failed. `cliSchema` writes a tuple of one type as a fixed-length array, which both accept; zod still checks the tuple on the way back. The adapter now reports the CLI's stdout when it exits without stderr, where it puts its reason.

- Designed sets brought framing cases the library never had (`video.render` version 7): a close camera placed on the side a person faces landed behind the wall when they faced the blackboard and was pulled inside them; it now films from the room's open front, widening the lens if the front is short (`keepDistance`). A person who has the shot's line at a spot facing away turns round for the whole shot. A medium shot of several people with no `focus` is framed as a two-shot (the room fit, closer; `video.render` version 8): aimed at the first person, the other one stood between the lens and them.
- From the Remotion skills (installed per `.claude/skills/README.md`), with our own code instead of new packages: graphics text is sized by measuring it on a canvas in the render's fonts (`fitSize`, after `fitText`), a formula's result is circled by a hand-drawn stroke (`Scribble`, after rough-notation highlights), and bright graphics use an amber accent because yellow washed out on cream.

## Consequences
- A new genre's people and places are made in minutes and reused afterwards; the library grows with every sample.
- The character renderer still bounds the look: designs choose among its parameters, so very specific creatures or costumes read only approximately. New parameters (more hair styles, hats, body types) widen every future design at once.
- Runs made before this ADR re-run from `assets.design` on their next resume, so `script.direct` re-stages them.
