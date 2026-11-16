import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";
import { z } from "zod";
import type { Transcriber, Transcript } from "../ports.ts";

const run = promisify(execFile);
const Out = z.object({
  language: z.string(),
  segments: z.array(z.object({ start: z.number(), end: z.number(), text: z.string() })),
});

// faster-whisper through uv. shortcut: segment timings only; whisperX word timings when ingest learns pacing per word.
export class WhisperTranscriber implements Transcriber {
  private readonly script: string;
  constructor(script: string) {
    this.script = script;
  }
  async transcribe(mediaFile: string): Promise<Transcript> {
    const out = `${mediaFile}.transcript.json`;
    await run(
      "uv",
      [
        "run",
        "--quiet",
        "--python",
        "3.12",
        "--with",
        "faster-whisper",
        "--with",
        "av<19",
        "python",
        "-I",
        this.script,
        mediaFile,
        out,
      ],
      { timeout: 20 * 60_000 },
    );
    return Out.parse(JSON.parse(readFileSync(out, "utf8")));
  }
}
