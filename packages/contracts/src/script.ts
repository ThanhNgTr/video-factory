// script.json: the story. The only artifact a human edits (roadmap §2.3). Staging lives in scene.json, not here.
import { z } from "zod";
import { EnglishText, Id, NARRATOR } from "./common.ts";
import { BEAT_ROLES, Voice } from "./library.ts";

export const Speaker = z.union([z.literal(NARRATOR), Id]);

export const Line = z.object({
  who: Speaker,
  // wrap 1-3 key words in *asterisks*: they render highlighted
  text: EnglishText(220),
});

export const Beat = z.object({
  id: Id,
  role: z.enum(BEAT_ROLES),
  // what the audience sees in this beat; the director turns it into shots
  action: EnglishText(300),
  // characters on screen in this beat (library ids)
  cast: z.array(Id).max(4),
  lines: z.array(Line).max(4),
  text: EnglishText(60).optional(), // big on-screen card, e.g. "RULE 1: *Never* say your name"
  clock: EnglishText(12).optional(), // HUD clock from this beat on
  counter: z.number().int().min(0).max(999).optional(), // HUD counter from this beat on
  tension: z.enum(["calm", "uneasy", "scary"]).default("calm"),
});

export const Script = z.object({
  schemaVersion: z.literal(1),
  format: Id,
  title: EnglishText(60),
  part: z.number().int().positive().optional(),
  // 3-5 sentences: what happened, the character ids involved, the exact cliffhanger. The next part is written from it.
  summary: EnglishText(1200),
  mood: z.enum(["bright", "night", "horror"]),
  hud: z.object({ title: EnglishText(30), counterLabel: EnglishText(16).optional() }).optional(),
  narratorVoice: Voice.optional(),
  cast: z.array(Id).min(1).max(6),
  beats: z.array(Beat).min(3).max(40),
  // two-way cliffhanger the audience votes on ("comment 1 or 2")
  choice: z.object({ option1: EnglishText(120), option2: EnglishText(120) }).optional(),
  publish: z.object({
    title: EnglishText(100),
    description: EnglishText(500),
    hashtags: z.array(z.string().regex(/^#[A-Za-z0-9]+$/)).max(10),
  }),
});

export type Line = z.infer<typeof Line>;
export type Beat = z.infer<typeof Beat>;
export type Script = z.infer<typeof Script>;
