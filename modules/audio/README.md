# @vf/audio — C. voice and mix

| Stage       | Reads                                       | Writes                           | Port          |
| ----------- | ------------------------------------------- | -------------------------------- | ------------- |
| `audio.tts` | `scene.json`, `script.json`, `assets.json`  | `audio.json`, `audio/<shot>.mp3` | `TtsProvider` |
| `audio.mix` | `scene.json`, `audio.json`, `timeline.json` | `mix.wav`, `mix.json`            | — (ffmpeg)    |

- `domain/normalize.ts`: "23:58" → "eleven fifty-eight", "#3" → "number three", "hon" → "hun" (else read as "Han"), markup stripped.
- `domain/silence.ts`: edge-tts leaves ~1 s after every sentence and ~0.9 s at the end of a clip. `EdgeTts` cuts each pause to 0.4 s and the lead/tail to 0.15 s (ffmpeg silencedetect + atrim/concat) and shifts the word timings; the cache keeps the raw clip. Part 1 of night-diner went from 125 s to 95 s with the same script.
- `domain/mix-plan.ts`: builds the ffmpeg graph: speech on the timeline, music ducked by sidechain, SFX cues, `loudnorm` to −14 LUFS / −1 dBTP.
- `audio.mix` also plays the picture's sound cues from `timeline.json` (pops, ticks, thuds, whooshes, a chime; ADR 0020) at their own levels, and sets the music `audio.musicDuckDb` (−16 dB) under the measured loudness of the narration, whatever level its file was made at. Voices come from `assets.json`, so designed characters speak too.
- Library audio is generated: `tools/make-audio-library.sh` (ffmpeg) and `tools/synth-music.ts` (the upbeat `bright-bounce` loop).
- Providers: `EdgeTts` (free, en-US, word timings, cached in `runs/.tts-cache`) and `FakeTts`. Pick with `VF_TTS`.
- Music/SFX live in `library/music`, `library/sfx` with a license field. The starter set is synthesised by `tools/make-audio-library.sh`.
