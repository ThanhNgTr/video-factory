export { EdgeTts } from "./adapters/edge-tts.ts";
export { FakeTts } from "./adapters/fake-tts.ts";
export { normalizeSpeech } from "./domain/normalize.ts";
export type { AudioDeps, TtsProvider, TtsResult } from "./ports.ts";
export { audioMix } from "./stages/mix.stage.ts";
export { alignWords, audioTts } from "./stages/tts.stage.ts";
