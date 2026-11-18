// scene.json: the staging. Every shot names a set, spots, actions, camera and cues. Written by script.direct, read by B, C, D.
import { z } from "zod";
import { EnglishText, Id } from "./common.ts";
import { Diorama } from "./diorama.ts";
import { Graphic } from "./graphic.ts";
import { Face } from "./library.ts";
import { Line } from "./script.ts";

export const CAMERAS = [
  "wide",
  "medium",
  "closeup",
  "over-shoulder",
  "push",
  "pan",
  "shake",
  "zoom-shake",
  "insert",
] as const;
export const Camera = z.enum(CAMERAS);
// The camera beyond its framing (ADR 0025): height and tilt, lens, how it travels through the shot, how the shot
// comes in, and whether its line starts before the picture cuts. All default to the old behaviour but `move`: every
// shot now drifts a little instead of standing dead still.
export const ANGLES = ["eye", "low", "high", "dutch", "reverse"] as const; // reverse: from behind the subject, facing the room's front
export const LENSES = ["wide", "normal", "tele"] as const;
// pan, tilt, crane, zoom, crash-zoom, dolly-zoom and the whip transition: ADR 0026. A move "pan" turns the camera on
// its head; the older camera "pan" slides it sideways
export const MOVES = [
  "drift",
  "still",
  "push",
  "pull",
  "track",
  "orbit",
  "handheld",
  "pan",
  "tilt",
  "crane",
  "zoom",
  "crash-zoom",
  "dolly-zoom",
] as const;
export const TRANSITIONS = ["cut", "fade", "flash", "whip"] as const;
export const LIGHTING = ["normal", "dim", "flicker", "blackout", "red", "headlights"] as const; // red: the monster's light, silhouettes; headlights: a car's lights sweep the windows

// Items a character can hold in the right hand, and water dripping off them (up = something is wrong).
// Additive optional fields: every older scene.json still parses, so schemaVersion stays 1.
export const HELD = ["card", "key", "phone", "towel", "bag", "coffee", "bear"] as const;

// A story object standing in the set for this shot (ADR 0022): a drawn icon as a 2D card on a spot, doing `motion`
// from `at` seconds in. Additive optional fields: every older scene.json still parses, schemaVersion stays 1.
export const PROP_MOTIONS = ["still", "drop", "sink", "tilt", "shake", "float", "grow", "vanish"] as const;
export const StageProp = z.object({
  id: Id, // what `focus` names to frame it
  icon: Id, // a library icon or one declared in scene.icons
  spot: Id, // a spot of the shot's set; on a character's spot the prop stands beside them
  size: z.number().min(0.2).max(3).default(1), // height in metres
  motion: z.enum(PROP_MOTIONS).default("still"),
  at: z.number().min(0).max(10).default(0), // seconds into the shot when the motion starts
});
export const FX = ["rain", "snow", "water"] as const; // water: a flood rising over the floor

export const CastMember = z.object({
  id: Id,
  spot: Id, // a spot of the shot's set
  toSpot: Id.optional(), // walk/run from spot to toSpot during the shot
  action: Id,
  face: Face.optional(),
  holds: Id.optional(), // a built-in item (HELD) or an icon from the library or scene.icons (checkSceneRefs)
  drip: z.enum(["up", "down"]).optional(),
});

export const SfxCue = z.object({ id: Id, at: z.number().min(0).max(20) }); // seconds into the shot

export const Shot = z.object({
  id: Id,
  beat: Id, // the script beat this shot belongs to
  set: Id.optional(), // required unless the shot is a graphic (checkSceneRefs)
  graphic: Graphic.optional(), // a motion-graphics shot: the graphic fills the frame instead of a set and its cast
  inset: Graphic.optional(), // a graphic kept in a card at the top right while the scene plays (the build so far)
  diorama: Diorama.optional(), // a 3D build diorama fills the frame instead of a set (ADR 0021)
  camera: Camera,
  angle: z.enum(ANGLES).default("eye"),
  lens: z.enum(LENSES).default("normal"),
  move: z.enum(MOVES).default("drift"),
  transition: z.enum(TRANSITIONS).default("cut"), // how this shot comes in
  jcut: z.boolean().default(false), // the line starts about 0.3 s before the picture cuts to this shot
  focus: Id.optional(), // cast member or prop the camera frames (closeup, over-shoulder, zoom, insert = the item they hold)
  cast: z.array(CastMember).max(4), // empty = establishing shot
  props: z.array(StageProp).max(4).default([]),
  fx: z.enum(FX).optional(), // weather or water over the whole shot
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
  // icons the graphics use that the library may not have yet: drawn (and kept) before the render
  icons: z
    .array(z.object({ id: Id, brief: EnglishText(160) }))
    .max(16)
    .default([]),
});

export type Camera = z.infer<typeof Camera>;
export type CastMember = z.infer<typeof CastMember>;
export type StageProp = z.infer<typeof StageProp>;
export type Shot = z.infer<typeof Shot>;
export type Scene = z.infer<typeof Scene>;
