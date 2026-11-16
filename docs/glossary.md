# Glossary (ubiquitous language)

Code uses exactly these words. One concept, one name.

| Term | Meaning | Where |
|---|---|---|
| **Formula** | The reusable mechanics learned from a viral video: beats by second, hook type, CTA. Never the story. | `library/formulas/*.json`, `Formula` in contracts |
| **Format** | A kind of video as data: length, beat count, writing rules, default mood (`series`, `skit`). | `library/formats/*.json`, `Format` |
| **Beat** | One story unit in `script.json`: what happens, who is on screen, the lines, an optional text card. | `Beat` in contracts |
| **Script** | The story (`script.json`): beats, lines, HUD values, the two-way choice. The only artifact a human edits. | `Script` |
| **Scene** | The staging (`scene.json`): shots with set, spots, actions, camera, lighting, SFX cues. | `Scene` |
| **Shot** | One camera setup inside a beat. One line at most. | `Shot` |
| **Spot** | A named standing place in a set with a default facing (`behind-desk`, `entrance`). | `Spot` in `Set3D` |
| **Cue** | An SFX event inside a shot, in seconds from the shot start. | `SfxCue` |
| **Run** | One execution of a pipeline for one video or one ingest. Has an id, a seed, a folder of artifacts, rows in SQLite. | `packages/pipeline` |
| **Stage** | One step of a pipeline: reads artifacts, writes artifacts, versioned, cached by input hash. | `stage()` |
| **Artifact** | An immutable file in a run folder, known by name (`audio.json`), never by path. | `ArtifactStore` |
| **Port** | An interface a module needs from the outside (`TtsProvider`, `Llm`, `Renderer`). Types only. | `modules/*/src/ports.ts` |
| **Adapter** | A concrete implementation of a port (`EdgeTts`, `ClaudeCliLlm`, `RemotionRenderer`, fakes). | `modules/*/src/adapters/` |
| **Series bible** | What the next part must stay consistent with: world, rules, cast, part summaries, audience votes. | `library/series/*.json` |
| **HUD** | The game-like overlay: title, clock, counter. | `Overlay.tsx` |
