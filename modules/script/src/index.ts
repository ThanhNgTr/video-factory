export { FakeDownloader, FakeTranscriber } from "./adapters/fakes.ts";
export { WhisperTranscriber } from "./adapters/whisper.ts";
export { YtDlpDownloader } from "./adapters/yt-dlp.ts";
export { checkLearnedFormat } from "./domain/format.ts";
export { bibleContext, nextPart, updateBible } from "./domain/series.ts";
export type { DownloadResult, ScriptDeps, Transcriber, Transcript, VideoDownloader } from "./ports.ts";
export { scriptBible } from "./stages/bible.stage.ts";
export { scriptDirect } from "./stages/direct.stage.ts";
export {
  ingestDownload,
  ingestFormat,
  ingestFormula,
  ingestTranscribe,
} from "./stages/ingest.stage.ts";
export { scriptWrite } from "./stages/write.stage.ts";
