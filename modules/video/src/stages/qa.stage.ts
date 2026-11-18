import { Script, Timeline } from "@vf/contracts";
import {
  ffmpegInfo,
  ffmpegStdout,
  MOTION_FPS,
  MOTION_H,
  MOTION_W,
  measureMotion,
  mediaSeconds,
  motionNumbers,
  StageError,
} from "@vf/core";
import { stage } from "@vf/pipeline";
import { judge, parseBlackdetect, parseSilencedetect } from "../domain/qa-rules.ts";
import type { VideoDeps } from "../ports.ts";

// Rule-based QA (roadmap GĐ 5 adds vision QA): length, black frames, long silence.
export const videoQa = stage<VideoDeps>({
  name: "video.qa",
  version: 3, // 2: a video up to 10% under the minimum passes; 3: the picture's motion, measured like a sample's (ADR 0025)
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
    // how much the finished picture moves, measured exactly like a sample at ingest, next to the sample's numbers
    const raw = await ffmpegStdout([
      "-i",
      file,
      "-vf",
      `fps=${MOTION_FPS},scale=${MOTION_W}:${MOTION_H},format=gray`,
      "-f",
      "rawvideo",
      "-",
    ]);
    const motion = { ...motionNumbers(measureMotion(raw, MOTION_W, MOTION_H, MOTION_FPS)), sample: format?.motion };
    if (format?.motion && motion.moving < format.motion.moving / 2)
      ctx.log.warn(
        { moving: motion.moving, sample: format.motion.moving },
        "the picture moves far less than the sample",
      );
    const qa = {
      ...judge({
        seconds,
        expectedSeconds: tl.totalFrames / tl.fps,
        issues: [...parseBlackdetect(black), ...parseSilencedetect(silence)],
        lengthRange: format?.lengthS ?? { min: 5, max: 180 },
      }),
      motion,
    };
    ctx.store.writeJson("qa.json", qa);
    if (!qa.pass)
      throw new StageError("qa-failed", `video failed QA: ${qa.issues.map((i) => i.code).join(", ")}`, {
        details: { issues: qa.issues },
      });
  },
});
