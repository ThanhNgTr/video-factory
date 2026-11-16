// Thin wrappers around the ffmpeg binaries. Every caller passes explicit paths.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { StageError } from "./errors.ts";

const run = promisify(execFile);

export async function ffmpeg(args: string[], timeoutMs = 10 * 60_000): Promise<string> {
  try {
    const { stderr } = await run("ffmpeg", ["-v", "error", "-y", ...args], { timeout: timeoutMs, maxBuffer: 64 << 20 });
    return stderr;
  } catch (e) {
    throw new StageError("io", `ffmpeg failed: ${(e as Error).message}`, { cause: e, details: { args } });
  }
}

// ffmpeg filters report through stderr at info level; this variant keeps that output.
export async function ffmpegInfo(args: string[]): Promise<string> {
  try {
    const { stderr } = await run("ffmpeg", ["-v", "info", "-nostats", "-y", ...args], { maxBuffer: 64 << 20 });
    return stderr;
  } catch (e) {
    throw new StageError("io", `ffmpeg failed: ${(e as Error).message}`, { cause: e, details: { args } });
  }
}

export async function ffprobe(args: string[]): Promise<string> {
  try {
    const { stdout } = await run("ffprobe", ["-v", "error", ...args], { maxBuffer: 16 << 20 });
    return stdout;
  } catch (e) {
    throw new StageError("io", `ffprobe failed: ${(e as Error).message}`, { cause: e, details: { args } });
  }
}

export async function mediaSeconds(file: string): Promise<number> {
  const out = await ffprobe(["-show_entries", "format=duration", "-of", "csv=p=0", file]);
  const d = Number.parseFloat(out);
  if (!(d > 0)) throw new StageError("io", `no duration for ${file}`);
  return d;
}
