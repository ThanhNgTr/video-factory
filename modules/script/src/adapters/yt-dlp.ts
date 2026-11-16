import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";
import { StageError } from "@vf/core";
import { z } from "zod";
import type { DownloadResult, VideoDownloader } from "../ports.ts";

const run = promisify(execFile);
const Info = z.object({ title: z.string().optional(), duration: z.number().nullable().optional() });

// yt-dlp via uvx (always current: sites change their players often).
export class YtDlpDownloader implements VideoDownloader {
  async download(url: string, outFile: string): Promise<DownloadResult> {
    const base = outFile.replace(/\.mp4$/, "");
    try {
      await run(
        "uvx",
        [
          "yt-dlp",
          "--no-playlist",
          "--quiet",
          "-f",
          "bv*[height<=1080]+ba/b",
          "--merge-output-format",
          "mp4",
          "--write-info-json",
          "-o",
          `${base}.%(ext)s`,
          url,
        ],
        {
          timeout: 5 * 60_000,
        },
      );
    } catch (e) {
      throw new StageError("provider-transient", `yt-dlp failed: ${(e as Error).message.slice(0, 500)}`, {
        retryable: true,
        cause: e,
      });
    }
    const info = Info.parse(JSON.parse(readFileSync(`${base}.info.json`, "utf8")));
    return { file: outFile, title: info.title ?? "", seconds: info.duration ?? 0 };
  }
}
