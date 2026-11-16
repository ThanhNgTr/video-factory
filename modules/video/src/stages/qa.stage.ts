import { Script, Timeline } from "@vf/contracts";
import { ffmpegInfo, mediaSeconds, StageError } from "@vf/core";
import { stage } from "@vf/pipeline";
import { judge, parseBlackdetect, parseSilencedetect } from "../domain/qa-rules.ts";
import type { VideoDeps } from "../ports.ts";

// Rule-based QA (roadmap GĐ 5 adds vision QA): length, black frames, long silence.
export const videoQa = stage<VideoDeps>({
  name: "video.qa",
  version: 1,
  inputs: ["video.mp4", "timeline.json", "script.json"],
  outputs: ["qa.json"],
  run: async (ctx) => {
    const file = ctx.store.path("video.mp4");
    const tl = ctx.store.readJson("timeline.json", Timeline);
    const script = ctx.store.readJson("script.json", Script);
    const format = ctx.library.formats[script.format];
    const seconds = await mediaSeconds(file);
    const black = await ffmpegInfo(["-i", file, "-vf", "blackdetect=d=1.5:pix_th=0.05", "-an", "-f", "null", "-"]);
    const silence = await ffmpegInfo(["-i", file, "-af", "silencedetect=n=-45dB:d=6", "-vn", "-f", "null", "-"]);
    const qa = judge({
      seconds,
      expectedSeconds: tl.totalFrames / tl.fps,
      issues: [...parseBlackdetect(black), ...parseSilencedetect(silence)],
      lengthRange: format?.lengthS ?? { min: 5, max: 180 },
    });
    ctx.store.writeJson("qa.json", qa);
    if (!qa.pass)
      throw new StageError("qa-failed", `video failed QA: ${qa.issues.map((i) => i.code).join(", ")}`, {
        details: { issues: qa.issues },
      });
  },
});
