import type { Llm } from "@vf/core";

export type DownloadResult = { file: string; title: string; seconds: number };
export interface VideoDownloader {
  download(url: string, outFile: string): Promise<DownloadResult>;
}

export type Transcript = { language: string; segments: { start: number; end: number; text: string }[] };
export interface Transcriber {
  transcribe(mediaFile: string): Promise<Transcript>;
}

export type ScriptDeps = { llm: Llm; downloader: VideoDownloader; transcriber: Transcriber };
