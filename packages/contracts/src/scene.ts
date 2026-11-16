// scene.json: the staging. Every shot names a set, spots, actions, camera and cues. Written by script.direct, read by B, C, D.
import { z } from "zod";
import { EnglishText, Id } from "./common.ts";
import { Face } from "./library.ts";
import { Line } from "./script.ts";

export const CAMERAS = ["wide", "medium", "closeup", "over-shoulder", "push", "pan", "shake", "zoom-shake"] as const;
export const Camera = z.enum(CAMERAS);
export const LIGHTING = ["normal", "dim", "flicker", "blackout"] as const;

export const CastMember = z.object({
  id: Id,
  spot: Id, // a spot of the shot's set
  toSpot: Id.optional(), // walk/run from spot to toSpot during the shot
  action: Id,
  face: Face.optional(),
});

export const SfxCue = z.object({ id: Id, at: z.number().min(0).max(20) }); // seconds into the shot

export const Shot = z.object({
  id: Id,
  beat: Id, // the script beat this shot belongs to
  set: Id,
  camera: Camera,
  focus: Id.optional(), // cast member the camera frames (closeup, over-shoulder, zoom)
  cast: z.array(CastMember).max(4), // empty = establishing shot
  line: Line.optional(),
  text: EnglishText(60).optional(),
  lighting: z.enum(LIGHTING).default("normal"),
  clock: EnglishText(12).optional(),
  counter: z.number().int().min(0).max(999).optional(),
  dur: z.number().min(0.6).max(10), // seconds; a spoken line extends it if speech is longer
  sfx: z.array(SfxCue).max(3).default([]),
});

export const Scene = z.object({
  schemaVersion: z.literal(1),
  title: EnglishText(60),
  mood: z.enum(["bright", "night", "horror"]),
  hud: z.object({ title: EnglishText(30), counterLabel: EnglishText(16).optional() }).optional(),
  music: z.object({ mood: z.string() }).optional(),
  shots: z.array(Shot).min(3).max(60),
});

export type Camera = z.infer<typeof Camera>;
export type CastMember = z.infer<typeof CastMember>;
export type Shot = z.infer<typeof Shot>;
export type Scene = z.infer<typeof Scene>;
