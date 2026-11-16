# @vf/audio — C. voice and mix

| Stage       | Reads                                       | Writes                           | Port          |
| ----------- | ------------------------------------------- | -------------------------------- | ------------- |
| `audio.tts` | `scene.json`, `script.json`                 | `audio.json`, `audio/<shot>.mp3` | `TtsProvider` |
| `audio.mix` | `scene.json`, `audio.json`, `timeline.json` | `mix.wav`, `mix.json`            | — (ffmpeg)    |

- `domain/normalize.ts`: "23:58" → "eleven fifty-eight", "#3" → "number three", markup stripped.
- `domain/mix-plan.ts`: builds the ffmpeg graph: speech on the timeline, music ducked by sidechain, SFX cues, `loudnorm` to −14 LUFS / −1 dBTP.
- Providers: `EdgeTts` (free, en-US, word timings, cached in `runs/.tts-cache`) and `FakeTts`. Pick with `VF_TTS`.
- Music/SFX live in `library/music`, `library/sfx` with a license field. The starter set is synthesised by `tools/make-audio-library.sh`.
