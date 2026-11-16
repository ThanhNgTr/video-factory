import { ffmpeg } from "@vf/core";
import { stage } from "@vf/pipeline";
import type { VideoDeps } from "../ports.ts";

// shortcut: the hook frame at 1.5 s becomes the thumbnail; add text when we pick thumbnails by data (GĐ 5).
export const videoThumb = stage<VideoDeps>({
  name: "video.thumb",
  version: 1,
  inputs: ["video.mp4"],
  outputs: ["thumb.jpg"],
  run: async (ctx) => {
    await ffmpeg([
      "-ss",
      "1.5",
      "-i",
      ctx.store.path("video.mp4"),
      "-frames:v",
      "1",
      "-q:v",
      "3",
      ctx.store.path("thumb.jpg"),
    ]);
  },
});
