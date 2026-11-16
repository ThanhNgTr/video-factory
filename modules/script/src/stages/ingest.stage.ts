// Learn a formula from a video link: download -> frames -> transcript -> Claude (vision) -> formula.json.
import { Formula } from "@vf/contracts";
import { askJson, ffmpeg, fillPrompt, loadPrompt, mediaSeconds, StageError } from "@vf/core";
import { stage } from "@vf/pipeline";
import { z } from "zod";
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
const Transcript = z.object({
  language: z.string(),
  segments: z.array(z.object({ start: z.number(), end: z.number(), text: z.string() })),
});

export const ingestDownload = stage<ScriptDeps>({
  name: "ingest.download",
  version: 1,
  inputs: [],
  outputs: ["source.json"],
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
    ctx.store.writeJson("source.json", { url, title: r.title, seconds, frames, step });
  },
});

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
  inputs: ["source.json", "transcript.json"],
  outputs: ["formula.json"],
  run: async (ctx) => {
    const src = ctx.store.readJson("source.json", Source);
    const tr = ctx.store.readJson("transcript.json", Transcript);
    const images = Array.from({ length: src.frames }, (_, i) => ({
      path: ctx.store.path(`frames/f${String(i + 1).padStart(3, "0")}.jpg`),
    })).filter((f) => ctx.store.exists(f.path.slice(ctx.store.dir.length + 1)));
    const transcript = tr.segments.length
      ? tr.segments.map((s) => `[${s.start}-${s.end}s] ${s.text}`).join("\n")
      : "(no speech detected)";
    const system = fillPrompt(PROMPT, { url: src.url, seconds: src.seconds.toFixed(1) });
    const user = `Video: ${src.seconds.toFixed(1)}s long, title "${src.title}". Frames are one every ${src.step}s, in order (frame number N = second ${src.step}*(N-1)).\n\nTranscript (auto speech-to-text, language "${tr.language}"; may contain errors):\n${transcript}\n\nReturn the formula JSON.`;
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
