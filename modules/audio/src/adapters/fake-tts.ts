// FakeTts: silence of a plausible length (14 chars/s), words spread evenly. Keeps tests and CI free.

import type { Voice } from "@vf/contracts";
import { ffmpeg, mediaSeconds } from "@vf/core";
import type { TtsProvider, TtsResult } from "../ports.ts";

export class FakeTts implements TtsProvider {
  async speak(text: string, _voice: Voice, outFile: string): Promise<TtsResult> {
    const seconds = Math.max(0.6, text.length / 14);
    await ffmpeg([
      "-f",
      "lavfi",
      "-i",
      "anullsrc=r=24000:cl=mono",
      "-t",
      seconds.toFixed(2),
      "-c:a",
      "libmp3lame",
      "-q:a",
      "9",
      outFile,
    ]);
    const toks = text.split(/\s+/).filter(Boolean);
    const step = seconds / Math.max(1, toks.length);
    return {
      file: outFile,
      seconds: await mediaSeconds(outFile),
      words: toks.map((t, i) => ({ text: t, start: i * step, end: (i + 1) * step })),
    };
  }
}
