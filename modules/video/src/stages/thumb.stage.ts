import { ffmpeg, ffmpegInfo } from "@vf/core";
import { stage } from "@vf/pipeline";
import type { VideoDeps } from "../ports.ts";

const CANDIDATES = [1.5, 4, 7, 10]; // seconds: the hook and the first beats
// shortcut: the brightest early frame becomes the thumbnail; pick thumbnails by data and add text in GĐ 5.
export const videoThumb = stage<VideoDeps>({
  name: "video.thumb",
  version: 2, // 2: the brightest of a few early frames, so a dark hook does not make a black thumbnail
  inputs: ["video.mp4"],
  outputs: ["thumb.jpg"],
  run: async (ctx) => {
    const file = ctx.store.path("video.mp4");
    let best = { at: CANDIDATES[0] ?? 1.5, luma: -1 };
    for (const at of CANDIDATES) {
      const log = await ffmpegInfo([
        "-ss",
        String(at),
        "-i",
        file,
        "-frames:v",
        "1",
        "-vf",
        "signalstats,metadata=print",
        "-f",
        "null",
        "-",
      ]);
      const luma = Number(/YAVG=([\d.]+)/.exec(log)?.[1] ?? 0);
      // a later frame must be clearly brighter to beat the hook
      if (luma > best.luma + 12) best = { at, luma };
    }
    await ffmpeg(["-ss", String(best.at), "-i", file, "-frames:v", "1", "-q:v", "3", ctx.store.path("thumb.jpg")]);
  },
});
