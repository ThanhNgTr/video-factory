// Microsoft Edge read-aloud voices through edge-tts (free, en-US, word boundaries). Cached per (text, voice).
// shortcut: unofficial free endpoint; move to a paid provider (ElevenLabs/Azure) before publishing at volume.
import { execFile } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { type Voice, Word } from "@vf/contracts";
import { mediaSeconds, StageError, sha256 } from "@vf/core";
import { z } from "zod";
import type { TtsProvider, TtsResult } from "../ports.ts";

const run = promisify(execFile);
const Out = z.object({ words: z.array(Word) });
const PIN = "edge-tts==7.2.3"; // pinned: 7.3.x returned NoAudioReceived for some phrases in the demo

export class EdgeTts implements TtsProvider {
  private readonly script: string;
  private readonly cacheDir: string;
  constructor(script: string, cacheDir: string) {
    this.script = script;
    this.cacheDir = cacheDir;
    mkdirSync(cacheDir, { recursive: true });
  }

  async speak(text: string, voice: Voice, outFile: string): Promise<TtsResult> {
    const key = sha256(JSON.stringify([text, voice]));
    const cachedMp3 = join(this.cacheDir, `${key}.mp3`);
    const cachedJson = join(this.cacheDir, `${key}.json`);
    if (!existsSync(cachedMp3) || !existsSync(cachedJson)) {
      let stdout = "";
      for (let attempt = 0; ; attempt++) {
        try {
          ({ stdout } = await run(
            "uv",
            [
              "run",
              "--quiet",
              "--with",
              PIN,
              "python",
              "-I",
              this.script,
              text,
              voice.id,
              voice.pitch,
              voice.rate,
              cachedMp3,
            ],
            {
              encoding: "utf8",
              timeout: 120_000,
            },
          ));
          break;
        } catch (e) {
          if (attempt >= 2)
            throw new StageError("provider-transient", `edge-tts failed for "${text.slice(0, 40)}"`, {
              retryable: true,
              cause: e,
            });
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        }
      }
      writeFileSync(cachedJson, stdout);
    }
    copyFileSync(cachedMp3, outFile);
    const { words } = Out.parse(JSON.parse(readFileSync(cachedJson, "utf8")));
    return { file: outFile, seconds: await mediaSeconds(outFile), words };
  }
}
