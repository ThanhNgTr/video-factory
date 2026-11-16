// Fakes for tests: a downloader that synthesises a short clip with ffmpeg, a transcriber that returns fixed text.
import { ffmpeg } from "@vf/core";
import type { DownloadResult, Transcriber, Transcript, VideoDownloader } from "../ports.ts";

export class FakeDownloader implements VideoDownloader {
  async download(_url: string, outFile: string): Promise<DownloadResult> {
    await ffmpeg([
      "-f",
      "lavfi",
      "-i",
      "color=c=gray:s=270x480:d=4",
      "-f",
      "lavfi",
      "-i",
      "anullsrc=r=24000:cl=mono",
      "-t",
      "4",
      "-pix_fmt",
      "yuv420p",
      outFile,
    ]);
    return { file: outFile, title: "fake", seconds: 4 };
  }
}

export class FakeTranscriber implements Transcriber {
  private readonly transcript: Transcript;
  constructor(transcript: Transcript = { language: "en", segments: [] }) {
    this.transcript = transcript;
  }
  async transcribe(): Promise<Transcript> {
    return this.transcript;
  }
}
