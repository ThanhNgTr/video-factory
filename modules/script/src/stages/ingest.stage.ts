// Learn from a video link: download -> frames -> transcript -> Claude (vision) -> formula.json, then format.json.
import { Format, Formula } from "@vf/contracts";
import {
  askJson,
  describeMotion,
  ffmpeg,
  ffmpegStdout,
  fillPrompt,
  loadPrompt,
  MOTION_FPS,
  MOTION_H,
  MOTION_KINDS,
  MOTION_W,
  type Motion,
  measureMotion,
  mediaSeconds,
  motionNumbers,
  pickStrips,
  StageError,
} from "@vf/core";
import { type StageContext, stage } from "@vf/pipeline";
import { z } from "zod";
import { checkLearnedFormat } from "../domain/format.ts";
import type { ScriptDeps } from "../ports.ts";

const PROMPT = loadPrompt(new URL("../../prompts/formula.md", import.meta.url).pathname);
const MAX_SECONDS = 180;
const MAX_FRAMES = 40;
const Source = z.object({
  url: z.string(),
  title: z.string(),
  seconds: z.number(),
  frames: z.number(),
  step: z.number(),
});
// motion.json, written and read only here (ADR 0024)
const MotionFile: z.ZodType<Motion> = z.object({
  fps: z.number(),
  seconds: z.array(
    z.object({ t: z.number(), kind: z.enum(MOTION_KINDS), moving: z.number(), where: z.string().optional() }),
  ),
  cuts: z.array(z.number()),
  strips: z.array(z.object({ from: z.number(), to: z.number(), kind: z.enum(MOTION_KINDS) })),
});
const Transcript = z.object({
  language: z.string(),
  segments: z.array(z.object({ start: z.number(), end: z.number(), text: z.string() })),
});

export const ingestDownload = stage<ScriptDeps>({
  name: "ingest.download",
  version: 3, // + motion.json and filmstrips (ADR 0024); 3: an overlapping strip makes way for the next
  inputs: [],
  outputs: ["source.json", "motion.json"],
  run: async (ctx) => {
    const url = ctx.params.url;
    if (!url) throw new StageError("io", "ingest needs --url");
    const file = ctx.store.path("source.mp4");
    const r = await ctx.deps.downloader.download(url, file);
    const seconds = await mediaSeconds(file);
    if (seconds > MAX_SECONDS)
      throw new StageError("invalid-output", `video is ${seconds.toFixed(0)}s, max ${MAX_SECONDS}s`);
    const step = Math.max(1, Math.ceil(seconds / MAX_FRAMES));
    await ffmpeg(["-i", file, "-vf", `fps=1/${step},scale=480:-2`, ctx.store.path("frames/f%03d.jpg")]);
    const frames = Math.ceil(seconds / step);
    // how the sample moves, which the stills above cannot show: small grey frames at 6 fps, measured second by
    // second, and 6 fps filmstrips of the moments that move most (ADR 0024)
    const raw = await ffmpegStdout([
      "-i",
      file,
      "-vf",
      `fps=${MOTION_FPS},scale=${MOTION_W}:${MOTION_H},format=gray`,
      "-f",
      "rawvideo",
      "-",
    ]);
    const motion = measureMotion(raw, MOTION_W, MOTION_H, MOTION_FPS);
    const strips = pickStrips(motion);
    for (const [i, s] of strips.entries())
      await ffmpeg([
        "-ss",
        String(s.from),
        "-t",
        String(s.to - s.from),
        "-i",
        file,
        "-vf",
        `fps=${MOTION_FPS},scale=160:-2,tile=${MOTION_FPS}x${s.to - s.from}:padding=3:color=white`,
        "-frames:v",
        "1",
        ctx.store.path(`motion/strip-${i + 1}.jpg`),
      ]);
    ctx.store.writeJson("motion.json", { ...motion, strips });
    ctx.store.writeJson("source.json", { url, title: r.title, seconds, frames, step });
  },
});

// the stills, then the filmstrips, and the measured motion as text: what the formula and format prompts see
function looks(ctx: StageContext<ScriptDeps>, src: z.infer<typeof Source>) {
  const motion = ctx.store.readJson("motion.json", MotionFile);
  const stills = Array.from({ length: src.frames }, (_, i) => ({
    path: ctx.store.path(`frames/f${String(i + 1).padStart(3, "0")}.jpg`),
  })).filter((f) => ctx.store.exists(f.path.slice(ctx.store.dir.length + 1)));
  const strips = motion.strips.map((_, i) => ({ path: ctx.store.path(`motion/strip-${i + 1}.jpg`) }));
  const stripText = motion.strips.length
    ? `\n\nThe last ${strips.length} images are filmstrips: ${MOTION_FPS} frames per second, read left to right, then the next row. ${motion.strips
        .map(
          (s, i) =>
            `Strip ${i + 1} = ${s.from}-${s.to}s (${s.kind === "camera" ? "the whole picture moving" : "the camera holding while things move"})`,
        )
        .join("; ")}. Use them to see how characters walk, turn, gesture and how the camera travels.`
    : "";
  return {
    images: [...stills, ...strips],
    text: `Stills are one every ${src.step}s, in order (still number N = second ${src.step}*(N-1)).${stripText}\n\n${describeMotion(motion)}`,
  };
}

export const ingestTranscribe = stage<ScriptDeps>({
  name: "ingest.transcribe",
  version: 1,
  inputs: ["source.json"],
  outputs: ["transcript.json"],
  run: async (ctx) => {
    const t = await ctx.deps.transcriber.transcribe(ctx.store.path("source.mp4"));
    ctx.store.writeJson("transcript.json", t);
  },
});

export const ingestFormula = stage<ScriptDeps>({
  name: "ingest.formula",
  version: PROMPT.version,
  inputs: ["source.json", "motion.json", "transcript.json"],
  outputs: ["formula.json"],
  run: async (ctx) => {
    const src = ctx.store.readJson("source.json", Source);
    const tr = ctx.store.readJson("transcript.json", Transcript);
    const { images, text } = looks(ctx, src);
    const transcript = tr.segments.length
      ? tr.segments.map((s) => `[${s.start}-${s.end}s] ${s.text}`).join("\n")
      : "(no speech detected)";
    const system = fillPrompt(PROMPT, { url: src.url, seconds: src.seconds.toFixed(1) });
    const user = `Video: ${src.seconds.toFixed(1)}s long, title "${src.title}". ${text}\n\nTranscript (auto speech-to-text, language "${tr.language}"; may contain errors):\n${transcript}\n\nReturn the formula JSON.`;
    const formula = await askJson(
      ctx.deps.llm,
      { model: ctx.config.models.ingest as "opus", system, user, images, schema: Formula, schemaName: "formula" },
      {
        onUsage: (u) => ctx.recordUsage(u),
      },
    );
    ctx.store.writeJson("formula.json", formula);
  },
});

const FORMAT = loadPrompt(new URL("../../prompts/format.md", import.meta.url).pathname);

// Learn the genre too, not only the story mechanics (ADR 0017): a format the writer and the critic follow to make
// new videos like the sample. `vf like` makes one right away.
export const ingestFormat = stage<ScriptDeps>({
  name: "ingest.format",
  version: FORMAT.version,
  inputs: ["source.json", "motion.json", "transcript.json", "formula.json"],
  outputs: ["format.json"],
  run: async (ctx) => {
    const src = ctx.store.readJson("source.json", Source);
    const tr = ctx.store.readJson("transcript.json", Transcript);
    const formula = ctx.store.readJson("formula.json", Formula);
    const { images, text } = looks(ctx, src);
    const transcript = tr.segments.length
      ? tr.segments.map((s) => `[${s.start}-${s.end}s] ${s.text}`).join("\n")
      : "(no speech detected)";
    const format = await askJson(
      ctx.deps.llm,
      {
        model: ctx.config.models.ingest as "opus",
        system: fillPrompt(FORMAT, { id: formula.id, seconds: src.seconds.toFixed(0) }),
        user: `Sample: ${src.seconds.toFixed(1)}s. ${text}\n\nTranscript (auto speech-to-text, may contain errors):\n${transcript}\n\nIts formula (mechanics already extracted):\n${JSON.stringify({ ...formula, source: undefined }, null, 1)}\n\nReturn the format JSON.`,
        images,
        schema: Format,
        schemaName: "format",
      },
      { check: checkLearnedFormat, onUsage: (u) => ctx.recordUsage(u) },
    );
    // the sample's motion in numbers, for video.qa to hold the remake against (ADR 0025)
    const motion = motionNumbers(ctx.store.readJson("motion.json", MotionFile));
    ctx.store.writeJson("format.json", { ...format, id: formula.id, motion });
  },
});
