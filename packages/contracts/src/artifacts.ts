// Artifacts produced after the script: checked assets, audio, timeline, qa.
import { z } from "zod";
import { Id } from "./common.ts";
import { Action, Person, Set3D } from "./library.ts";

// assets.json: everything the renderer needs, inlined and verified against the library
export const Assets = z.object({
  schemaVersion: z.literal(1),
  people: z.record(Id, Person),
  actions: z.record(Id, Action),
  sets: z.record(Id, Set3D),
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
});

export const Qa = z.object({
  schemaVersion: z.literal(1),
  pass: z.boolean(),
  seconds: z.number(),
  issues: z.array(z.object({ code: z.string(), at: z.number().optional(), detail: z.string() })),
});

export type Assets = z.infer<typeof Assets>;
export type Word = z.infer<typeof Word>;
export type SpeechClip = z.infer<typeof SpeechClip>;
export type Audio = z.infer<typeof Audio>;
export type Mix = z.infer<typeof Mix>;
export type Caption = z.infer<typeof Caption>;
export type Timeline = z.infer<typeof Timeline>;
export type Qa = z.infer<typeof Qa>;
