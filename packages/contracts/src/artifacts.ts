// Artifacts produced after the script: checked assets, audio, timeline, qa.
import { z } from "zod";
import { Id } from "./common.ts";
import { Action, Icon, type Library, Person, Set3D } from "./library.ts";

// assets.json: everything the renderer needs, inlined and verified against the library
export const Assets = z.object({
  schemaVersion: z.literal(1),
  people: z.record(Id, Person),
  actions: z.record(Id, Action),
  sets: z.record(Id, Set3D),
  icons: z.record(Id, Icon).default({}), // the icons the graphics draw
});

// icons.json: the icons assets.draw drew for this run (passed the gate) and the ones that never passed
export const DrawnIcons = z.object({
  schemaVersion: z.literal(1),
  icons: z.record(Id, Icon),
  failed: z.array(z.object({ id: Id, brief: z.string(), score: z.number(), problems: z.array(z.string()) })),
});

// designs.json: characters and sets assets.design made for this run (ADR 0018), with the gate's score for each
export const Designs = z.object({
  schemaVersion: z.literal(1),
  people: z.record(Id, Person),
  sets: z.record(Id, Set3D),
  scores: z.record(Id, z.number()),
});

export const Word = z.object({ text: z.string(), start: z.number().min(0), end: z.number().min(0) });

export const SpeechClip = z.object({
  shot: Id,
  who: z.string(),
  text: z.string(),
  file: z.string(), // artifact name, e.g. "audio/s03.mp3"
  seconds: z.number().positive(),
  words: z.array(Word),
});

// audio.json: one clip per spoken line
export const Audio = z.object({ schemaVersion: z.literal(1), clips: z.array(SpeechClip) });

// mix.json: the final soundtrack
export const Mix = z.object({
  schemaVersion: z.literal(1),
  music: z.object({ id: Id, file: z.string() }).optional(),
  mix: z.object({ file: z.string(), seconds: z.number().positive(), lufs: z.number() }),
});

export const Caption = z.object({
  shot: Id,
  frame: z.number().int().min(0), // absolute frame the word lights up
  text: z.string(),
  highlight: z.boolean(),
});

// timeline.json: shots resolved to frames
export const Timeline = z.object({
  schemaVersion: z.literal(1),
  fps: z.number().int(),
  width: z.number().int(),
  height: z.number().int(),
  totalFrames: z.number().int().positive(),
  shots: z.array(
    z.object({
      id: Id,
      from: z.number().int().min(0),
      frames: z.number().int().positive(),
      speechFrom: z.number().int().optional(), // absolute frame the line starts
      speechFrames: z.number().int().optional(),
      clock: z.string().optional(),
      counter: z.number().int().optional(),
    }),
  ),
  captions: z.array(Caption),
  // sound effects the picture calls for (a counter ticking, a list item popping, a layer landing), by frame and sfx id
  cues: z.array(z.object({ frame: z.number().int().min(0), id: Id })).default([]),
});

// script-review.json: the critic's verdict on the final script.json (written with it by script.write)
export const ScriptReview = z.object({
  schemaVersion: z.literal(1),
  pass: z.boolean(),
  score: z.number().min(0).max(10),
  rounds: z.number().int().min(1), // critiques run, including the ones that led to rewrites
  criteria: z.array(z.object({ id: z.string(), pass: z.boolean(), note: z.string() })),
  summary: z.string(),
});

// frame-review.json: what the vision reviewers saw on one frame per shot of video.mp4 (never blocks the episode)
export const FrameDefect = z.object({
  frames: z.array(z.string()),
  kind: z.enum(["face-hidden", "inside-furniture", "cut-off", "bad-framing", "text-overflow", "continuity", "other"]),
  severity: z.enum(["high", "medium", "low"]),
  detail: z.string(),
});
export const FrameReview = z.object({
  schemaVersion: z.literal(1),
  frames: z.array(z.object({ id: z.string(), shot: z.string(), t: z.number() })),
  reviewers: z.array(
    z.object({ name: z.string(), ok: z.boolean(), error: z.string().optional(), defects: z.array(FrameDefect) }),
  ),
});

export const Qa = z.object({
  schemaVersion: z.literal(1),
  pass: z.boolean(),
  seconds: z.number(),
  issues: z.array(z.object({ code: z.string(), at: z.number().optional(), detail: z.string() })),
  // the finished picture's movement, measured like a sample's (ADR 0025), next to what the format's sample did
  motion: z
    .object({
      moving: z.number(),
      secondsPerCut: z.number(),
      sample: z.object({ moving: z.number(), secondsPerCut: z.number() }).optional(),
    })
    .optional(),
});

export type Assets = z.infer<typeof Assets>;
export type DrawnIcons = z.infer<typeof DrawnIcons>;
export type Designs = z.infer<typeof Designs>;

// the library as a run sees it: plus the characters and sets designed for it
export const withDesigns = (lib: Library, d: Pick<Designs, "people" | "sets">): Library => ({
  ...lib,
  people: { ...lib.people, ...d.people },
  sets: { ...lib.sets, ...d.sets },
});
export type Word = z.infer<typeof Word>;
export type SpeechClip = z.infer<typeof SpeechClip>;
export type Audio = z.infer<typeof Audio>;
export type Mix = z.infer<typeof Mix>;
export type Caption = z.infer<typeof Caption>;
export type Timeline = z.infer<typeof Timeline>;
export type Qa = z.infer<typeof Qa>;
export type ScriptReview = z.infer<typeof ScriptReview>;
export type FrameDefect = z.infer<typeof FrameDefect>;
export type FrameReview = z.infer<typeof FrameReview>;
