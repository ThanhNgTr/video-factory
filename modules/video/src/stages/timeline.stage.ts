import { Audio, Scene } from "@vf/contracts";
import { stage } from "@vf/pipeline";
import { buildTimeline } from "../domain/timeline.ts";
import type { VideoDeps } from "../ports.ts";

export const videoTimeline = stage<VideoDeps>({
  name: "video.timeline",
  version: 5, // 4: thuds as props drop in (ADR 0022); 5: J-cuts and weather beds (ADR 0025)
  inputs: ["scene.json", "audio.json"],
  outputs: ["timeline.json"],
  run: async (ctx) => {
    const scene = ctx.store.readJson("scene.json", Scene);
    const audio = ctx.store.readJson("audio.json", Audio);
    ctx.store.writeJson("timeline.json", buildTimeline(scene, audio, ctx.config.video));
  },
});
