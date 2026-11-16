import type { Voice, Word } from "@vf/contracts";

export type TtsResult = { file: string; seconds: number; words: Word[] };

export interface TtsProvider {
  // Speaks plain text (no markup) into outFile. words are absolute seconds from the start of the file.
  speak(text: string, voice: Voice, outFile: string): Promise<TtsResult>;
}

export type AudioDeps = { tts: TtsProvider };
