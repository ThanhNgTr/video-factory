# @vf/script — A. learn and write

Turns a viral link into a formula, and a formula (+ idea, + series bible) into a story and a shot list.

| Stage               | Reads                                                             | Writes                                      | Port                           |
| ------------------- | ----------------------------------------------------------------- | ------------------------------------------- | ------------------------------ |
| `ingest.download`   | `--url`                                                           | `source.mp4`, `frames/*.jpg`, `source.json` | `VideoDownloader` (yt-dlp)     |
| `ingest.transcribe` | `source.mp4`                                                      | `transcript.json`                           | `Transcriber` (faster-whisper) |
| `ingest.formula`    | frames + transcript                                               | `formula.json`                              | `Llm` (vision)                 |
| `script.write`      | library, params (`format`, `series`, `idea`, `formula`, `choice`) | `script.json`                               | `Llm`                          |
| `script.direct`     | `script.json`                                                     | `scene.json`                                | `Llm`                          |
| `script.bible`      | `script.json`                                                     | `series-bible.json`                         | —                              |

- Prompts: `prompts/*.md`, first line `<!-- version: N -->`; the stage version follows the prompt version. Change a prompt → bump → `vf eval` (GĐ 3).
- `script.write` never overwrites an existing `script.json` (human edits win). Delete it to rewrite.
- Checks that drive the repair loop: `checkScriptRefs`, `checkSceneRefs`, `checkSceneMatchesScript` in `@vf/contracts`.
- Swap providers in `apps/cli/src/wiring.ts`: `YtDlpDownloader` / `WhisperTranscriber` / `FakeDownloader` / `FakeTranscriber`.
