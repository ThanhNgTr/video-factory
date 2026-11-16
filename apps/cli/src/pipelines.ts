import { assetsCheck } from "@vf/assets";
import { audioMix, audioTts } from "@vf/audio";
import type { StageDef } from "@vf/pipeline";
import { ingestDownload, ingestFormula, ingestTranscribe, scriptBible, scriptDirect, scriptWrite } from "@vf/script";
import { videoQa, videoRender, videoThumb, videoTimeline } from "@vf/video";
import type { Deps } from "./wiring.ts";

// One episode, start to finish. Order matters: the mix needs the timeline, the render needs the mix.
export const MAKE: readonly StageDef<Deps>[] = [
  scriptWrite,
  scriptDirect,
  scriptBible,
  assetsCheck,
  audioTts,
  videoTimeline,
  audioMix,
  videoRender,
  videoQa,
  videoThumb,
];

// Learn a formula from a link.
export const INGEST: readonly StageDef<Deps>[] = [ingestDownload, ingestTranscribe, ingestFormula];
