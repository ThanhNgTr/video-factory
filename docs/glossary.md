# Glossary (ubiquitous language)

Code uses exactly these words. One concept, one name.

| Term | Meaning | Where |
|---|---|---|
| **Formula** | The reusable mechanics learned from a viral video: beats by second, hook type, CTA. Never the story. | `library/formulas/*.json`, `Formula` in contracts |
| **Format** | A kind of video as data: length, beat count, writing rules, a rubric for the critic, default mood (`series`, `skit`, `explainer`). Hand-written or learned from a sample with its formula (same id). | `library/formats/*.json`, `Format` |
| **Premise** | The angle a video takes, pitched and picked before writing: protagonist, place, visual spine, hook line, twist. Kept per finished run so the next script differs. | `Script.premise`, `library/premises/*.json`, `prompts/premise.md` |
| **Beat** | One story unit in `script.json`: what happens, who is in the place (actors and silent bystanders), the lines, an optional text card. | `Beat` in contracts |
| **Script** | The story (`script.json`): beats, lines, HUD values, the two-way choice. The only artifact a human edits. | `Script` |
| **Scene** | The staging (`scene.json`): shots with set, spots, actions, camera, lighting, SFX cues. | `Scene` |
| **Shot** | One camera setup inside a beat, or one graphic. One line at most. Besides its framing (`camera`) it has an `angle` (eye, low, high, dutch, reverse), a `lens` (wide, normal, tele), a `move` (drift by default, still, push, pull, track, orbit, handheld, pan, tilt, crane, zoom, crash-zoom, dolly-zoom), a `transition` (cut, fade, flash, whip) and may `jcut` (its line starts before the picture cuts). | `Shot`, ADR 0025, 0026 |
| **Graphic** | A motion-graphics shot drawn by code from numbers and words: count, scale, chart, formula, list, icons. Fills the frame instead of a set. | `Graphic` in contracts, `Graphics.tsx` |
| **Diorama** | A 3D model of a strip of ground (a road) with its front cut away so the layers under it show; each shot repeats the last state plus what its line adds. Fills the frame instead of a set. | `Diorama` in contracts, `Diorama.tsx` |
| **Motion** | How a sample video moves, measured per second at 6 fps: hard cut, whole picture moving, camera holding while things move, still; plus filmstrips. Feeds the formula and the format's `staging`. | `motion.json`, `domain/motion.ts` |
| **Design** | A character (`Person`) or set (`Set3D`) Claude wrote for a run because the library lacked it, judged from a rendered picture; kept in the library afterwards. | `designs.json`, `assets.design` |
| **Icon** | A flat SVG drawing Claude made for graphics and a gate passed; kept and reused. | `library/icons/*.json`, `Icon` |
| **Spot** | A named standing place in a set with a default facing (`behind-desk`, `entrance`); a seat spot also has the height of its seat. | `Spot` in `Set3D` |
| **Prop** | A story object standing in a set for one shot: a drawn Icon as a card on a Spot, with a motion (drop, sink, tilt, shake, float, grow, vanish). `focus` may frame it. | `StageProp` in `Shot.props`, `World.tsx` |
| **Furniture** | The fixed pieces a set is built from (boxes, counters, doors, windows). Not a Prop. | `Set3D.props`, `set-geometry.ts` |
| **Fx** | Weather or water over a whole shot: rain, snow, a rising flood. | `Shot.fx`, `Weather.tsx` |
| **Posture** | Whether an action stands, sits on a seat spot or lies (on a seat or the floor). | `Action.posture` |
| **Cue** | An SFX event inside a shot, in seconds from the shot start. | `SfxCue` |
| **Run** | One execution of a pipeline for one video or one ingest. Has an id, a seed, a folder of artifacts, rows in SQLite. | `packages/pipeline` |
| **Stage** | One step of a pipeline: reads artifacts, writes artifacts, versioned, cached by input hash. | `stage()` |
| **Artifact** | An immutable file in a run folder, known by name (`audio.json`), never by path. | `ArtifactStore` |
| **Port** | An interface a module needs from the outside (`TtsProvider`, `Llm`, `Renderer`). Types only. | `modules/*/src/ports.ts` |
| **Adapter** | A concrete implementation of a port (`EdgeTts`, `ClaudeCliLlm`, `RemotionRenderer`, fakes). | `modules/*/src/adapters/` |
| **Series bible** | What the next part must stay consistent with: world, rules, cast, part summaries, audience votes. | `library/series/*.json` |
| **HUD** | The game-like overlay: title, clock, counter. Only in a format with `hud: true` (the night-shift series); the script check refuses it elsewhere. | `Format.hud`, `Overlay.tsx` |
