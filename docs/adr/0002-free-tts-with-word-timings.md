# ADR 0002: edge-tts behind the TTS port, cached per line

Date: 2026-11-16 · Status: accepted (interim, until spike S2)

## Context
Captions light up word by word, so the TTS must return word timings. Spike S2 (paid provider choice) is not done. Microsoft Edge read-aloud voices (edge-tts, free) return `WordBoundary` events with 100 ns offsets.

## Decision
`TtsProvider.speak(text, voice, outFile) -> { seconds, words[] }`. `EdgeTts` runs a 20-line Python script through `uv` (pinned `edge-tts==7.2.3`), caches by `hash(text, voice)` in `runs/.tts-cache`, and retries transiently. `FakeTts` emits silence with evenly spaced words. Spoken text goes through `normalizeSpeech` (times, `#N`, markup).

## Consequences
- Editing one line re-synthesises one line; everything else is a cache hit.
- Free unofficial endpoint: not for volume. Replacing it is one adapter file plus `VF_TTS`.
