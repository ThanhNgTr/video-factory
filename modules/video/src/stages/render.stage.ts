import { Assets, Scene, Script, Timeline } from "@vf/contracts";
import { ffmpeg } from "@vf/core";
import { stage } from "@vf/pipeline";
import type { RenderProps } from "../composition/props.ts";
import type { VideoDeps } from "../ports.ts";

export const COMPOSITION_ENTRY = new URL("../composition/entry.ts", import.meta.url).pathname;

// Renders the muted picture with Remotion, then muxes mix.wav in with ffmpeg.
export const videoRender = stage<VideoDeps>({
  name: "video.render",
  version: 1,
  inputs: ["timeline.json", "scene.json", "assets.json", "script.json", "mix.wav"],
  outputs: ["video.mp4", "props.json"],
  run: async (ctx) => {
    const script = ctx.store.readJson("script.json", Script);
    const props: RenderProps = {
      timeline: ctx.store.readJson("timeline.json", Timeline),
      scene: ctx.store.readJson("scene.json", Scene),
      assets: ctx.store.readJson("assets.json", Assets),
      seed: ctx.seed,
      choice: script.choice,
    };
    ctx.store.writeJson("props.json", props);
    const silent = ctx.store.path("video-silent.mp4");
    let lastLogged = 0;
    await ctx.deps.renderer.render({
      entry: COMPOSITION_ENTRY,
      compositionId: "Main",
      props,
      outFile: silent,
      concurrency: ctx.config.renderConcurrency,
      onProgress: (p) => {
        if (p - lastLogged >= 0.1) {
          lastLogged = p;
          ctx.log.info({ progress: Math.round(p * 100) }, "rendering");
        }
      },
    });
    await ffmpeg([
      "-i",
      silent,
      "-i",
      ctx.store.path("mix.wav"),
      "-map",
      "0:v",
      "-map",
      "1:a",
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-movflags",
      "+faststart",
      "-shortest",
      ctx.store.path("video.mp4"),
    ]);
  },
});
