import { FrameDefect, type FrameReview, Timeline } from "@vf/contracts";
import { askJson, ffmpeg, loadPrompt } from "@vf/core";
import { stage } from "@vf/pipeline";
import { z } from "zod";
import type { VideoDeps } from "../ports.ts";

const PROMPT = loadPrompt(new URL("../../prompts/review.md", import.meta.url).pathname);
const Answer = z.object({ defects: z.array(FrameDefect) });
const PER_SHEET = 9;

// Vision review of the finished video (ADR 0015): one labelled frame per shot, tiled 3x3, judged by every configured
// reviewer in parallel. It never blocks the episode: a failing reviewer is recorded, defects are reported to the
// producer and kept as feedback for the renderer.
export const videoReview = stage<VideoDeps>({
  name: "video.review",
  version: PROMPT.version,
  inputs: ["video.mp4", "timeline.json"],
  outputs: ["frame-review.json"],
  run: async (ctx) => {
    const tl = ctx.store.readJson("timeline.json", Timeline);
    const frames = tl.shots.map((s, i) => ({
      id: `f${String(i + 1).padStart(2, "0")}`,
      shot: s.id,
      t: Math.round(((s.from + s.frames * 0.55) / tl.fps) * 100) / 100,
    }));
    for (const f of frames)
      await ffmpeg([
        "-y",
        "-ss",
        String(f.t),
        "-i",
        ctx.store.path("video.mp4"),
        "-frames:v",
        "1",
        "-vf",
        `scale=360:-2,drawtext=text='${f.id}':x=8:y=h-34:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=5`,
        ctx.store.path(`review/${f.id}.png`),
      ]);
    const sheets: { path: string }[] = [];
    for (let i = 0; i < frames.length; i += PER_SHEET) {
      const path = ctx.store.path(`review/sheet${sheets.length + 1}.jpg`);
      await ffmpeg([
        "-y",
        "-start_number",
        String(i + 1),
        "-i",
        ctx.store.path("review/f%02d.png"),
        "-frames:v",
        "1",
        "-vf",
        "tile=3x3:padding=6:color=black",
        path,
      ]);
      sheets.push({ path });
    }
    const user = `The ${sheets.length} attached images are contact sheets with one frame per shot, in time order. Each frame is labelled at its bottom-left with its id (${frames[0]?.id} to ${frames.at(-1)?.id}).`;
    const results = await Promise.allSettled(
      ctx.deps.reviewers.map((r) =>
        askJson(
          r.llm,
          {
            model: ctx.config.models.review as "opus",
            system: PROMPT.text,
            user,
            images: sheets,
            schema: Answer,
            schemaName: "frame-review",
          },
          { onUsage: (u) => ctx.recordUsage(u) },
        ),
      ),
    );
    const review: FrameReview = {
      schemaVersion: 1,
      frames,
      reviewers: results.map((res, i) => {
        const name = ctx.deps.reviewers[i]?.name ?? `reviewer-${i + 1}`;
        if (res.status === "fulfilled") return { name, ok: true, defects: res.value.defects };
        ctx.log.warn({ reviewer: name, err: String(res.reason) }, "frame reviewer failed");
        return { name, ok: false, error: String(res.reason).slice(0, 500), defects: [] };
      }),
    };
    ctx.store.writeJson("frame-review.json", review);
  },
});
