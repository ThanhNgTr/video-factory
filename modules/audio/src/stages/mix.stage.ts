import { Audio, Scene, Timeline } from "@vf/contracts";
import { ffmpeg, ffmpegInfo, mediaSeconds, StageError } from "@vf/core";
import { stage } from "@vf/pipeline";
import { planMix } from "../domain/mix-plan.ts";
import type { AudioDeps } from "../ports.ts";

// Final soundtrack: speech placed by the timeline, music ducked under it, SFX cues, -14 LUFS.
export const audioMix = stage<AudioDeps>({
  name: "audio.mix",
  version: 1,
  inputs: ["scene.json", "audio.json", "timeline.json"],
  outputs: ["mix.wav", "mix.json"],
  run: async (ctx) => {
    const scene = ctx.store.readJson("scene.json", Scene);
    const audio = ctx.store.readJson("audio.json", Audio);
    const tl = ctx.store.readJson("timeline.json", Timeline);
    const fps = tl.fps;
    const byShot = new Map(tl.shots.map((s) => [s.id, s]));
    const speech = audio.clips.flatMap((c) => {
      const s = byShot.get(c.shot);
      return s?.speechFrom === undefined ? [] : [{ file: ctx.store.path(c.file), startS: s.speechFrom / fps }];
    });
    const libDir = ctx.config.libraryDir;
    const sfx = scene.shots.flatMap((shot) => {
      const s = byShot.get(shot.id);
      if (!s) return [];
      return shot.sfx.flatMap((cue) => {
        const meta = ctx.library.sfx[cue.id];
        return meta ? [{ file: `${libDir}/sfx/${meta.file}`, startS: s.from / fps + cue.at }] : [];
      });
    });
    const wanted = scene.music?.mood ?? scene.mood;
    const track =
      Object.values(ctx.library.music).find((m) => m.mood.includes(wanted)) ?? Object.values(ctx.library.music)[0];
    const totalS = tl.totalFrames / fps;
    const plan = planMix({
      speech,
      music: track ? { file: `${libDir}/music/${track.file}`, gainDb: ctx.config.audio.musicDuckDb } : undefined,
      sfx,
      totalS,
      targetLufs: ctx.config.audio.targetLufs,
      truePeakDb: ctx.config.audio.truePeakDb,
    });
    const out = ctx.store.path("mix.wav");
    await ffmpeg([
      ...plan.inputs.flatMap((f) => ["-i", f]),
      "-filter_complex",
      plan.filter,
      "-map",
      plan.outLabel,
      "-ar",
      "48000",
      "-ac",
      "2",
      out,
    ]);
    const seconds = await mediaSeconds(out);
    if (Math.abs(seconds - totalS) > 0.5)
      throw new StageError("invalid-output", `mix is ${seconds}s, timeline is ${totalS}s`);
    const lufs = await measureLufs(out);
    ctx.log.info({ lufs, seconds, music: track?.id }, "mixed");
    // a separate artifact: rewriting audio.json would change its hash and re-run every stage that reads it
    ctx.store.writeJson("mix.json", {
      schemaVersion: 1,
      music: track && { id: track.id, file: `${libDir}/music/${track.file}` },
      mix: { file: "mix.wav", seconds, lufs },
    });
  },
});

async function measureLufs(file: string): Promise<number> {
  const log = await ffmpegInfo(["-i", file, "-af", "ebur128=framelog=quiet", "-f", "null", "-"]);
  const m = log.match(/I:\s*(-?[\d.]+)\s*LUFS/);
  return m?.[1] ? Number(m[1]) : Number.NaN;
}
