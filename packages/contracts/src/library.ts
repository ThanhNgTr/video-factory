// Library parts: the data the renderer and the writer share. Every file in library/ is parsed with these on load.
import { z } from "zod";
import { Color, EnglishText, Id, V2, V3 } from "./common.ts";

export const FACES = ["neutral", "happy", "sad", "angry", "shock", "sleepy", "smug", "cry", "love"] as const;
export const Face = z.enum(FACES);

export const Voice = z.object({
  id: z.string().regex(/^en-US-/, "only en-US voices"),
  pitch: z
    .string()
    .regex(/^[+-]\d+Hz$/)
    .default("+0Hz"),
  rate: z
    .string()
    .regex(/^[+-]\d+%$/)
    .default("+0%"),
});

// One pose key. t is 0..1 of the action's duration. Offsets in body heights, angles in degrees.
// arm 0 = hanging down, 90 = out sideways, 170 = raised. Missing values carry over from the previous key.
export const PoseKey = z.object({
  t: z.number().min(0).max(1),
  x: z.number().min(-3).max(3).optional(),
  y: z.number().min(-3).max(3).optional(),
  rot: z.number().min(-360).max(360).optional(),
  sx: z.number().min(0.2).max(2.5).optional(),
  sy: z.number().min(0.2).max(2.5).optional(),
  armL: z.number().min(-180).max(180).optional(),
  armR: z.number().min(-180).max(180).optional(),
  legL: z.number().min(-90).max(90).optional(),
  legR: z.number().min(-90).max(90).optional(),
  face: Face.optional(),
});

export const Action = z.object({
  schemaVersion: z.literal(1),
  id: Id,
  dur: z.number().min(0.2).max(4),
  loop: z.boolean(),
  keys: z.array(PoseKey).min(1).max(24),
});

export const Person = z.object({
  schemaVersion: z.literal(1),
  id: Id,
  name: EnglishText(40),
  genre: z.enum(["people", "monster", "animal", "object"]),
  build: z.object({
    height: z.number().min(0.6).max(1.6).default(1), // 0.7 = child, 1.4+ = unnaturally tall
    width: z.number().min(0.7).max(1.5).default(1),
    head: z.number().min(0.8).max(1.4).default(1),
  }),
  skin: Color,
  hair: z.object({ style: z.enum(["none", "short", "messy", "long", "bun", "bald-sides"]), color: Color }),
  face: z.object({
    eyes: z.enum(["dot", "big", "glow", "none"]).default("dot"),
    brows: z.enum(["thin", "bushy", "none"]).default("thin"),
    mustache: z.boolean().default(false),
    glasses: z.boolean().default(false),
    grin: z.boolean().default(false), // permanent too-wide grin (monsters)
  }),
  outfit: z.object({
    top: z.enum(["tshirt", "hoodie", "coat", "suit", "dress", "uniform"]),
    topColor: Color,
    pants: Color,
    accent: Color.default("#c9a227"),
  }),
  wear: z
    .array(z.enum(["top-hat", "cap", "scarf", "tie", "apron", "badge", "raincoat-hood"]))
    .max(4)
    .default([]),
  voice: Voice,
  personality: EnglishText(200),
});

export const PROP_TYPES = [
  "box",
  "cylinder",
  "shelf",
  "counter",
  "door",
  "window",
  "sofa",
  "plant",
  "elevator",
  "painting",
  "rug",
  "chair",
] as const;

// A named place to stand. pos = [x, z] on the floor; facing is where the character looks when idle.
export const Spot = z.object({
  id: Id,
  pos: V2,
  facing: z.enum(["camera", "left", "right", "away"]).default("camera"),
  note: EnglishText(80).optional(),
});

export const Set3D = z.object({
  schemaVersion: z.literal(1),
  id: Id,
  room: z.object({ w: z.number().min(2).max(30), h: z.number().min(2).max(10), front: z.number(), back: z.number() }),
  wall: Color,
  floor: Color,
  floorStyle: z.enum(["plain", "planks", "tiles"]).default("plain"),
  wallStyle: z.enum(["plain", "stripes"]).default("plain"),
  wainscot: Color.optional(),
  lamps: z.array(V3).max(12),
  props: z
    .array(
      z.object({
        type: z.enum(PROP_TYPES),
        pos: V3,
        size: V3.optional(),
        rotY: z.number().default(0),
        color: Color.optional(),
      }),
    )
    .max(80),
  spots: z.array(Spot).min(1).max(12),
});

export const BEAT_ROLES = ["hook", "setup", "build", "twist", "payoff", "loop", "cta"] as const;

// What we learn from a viral video: mechanics only, never its story (roadmap §13.1).
export const Formula = z.object({
  schemaVersion: z.literal(1),
  id: Id,
  source: z.string().url(),
  lengthS: z.number().positive(),
  language: z.string(),
  summary: z.string(),
  beats: z
    .array(z.object({ t: z.string(), role: z.enum(BEAT_ROLES), pattern: z.string() }))
    .min(2)
    .max(12),
  whyViral: z.string(),
  cast: z.array(z.object({ role: z.string(), traits: z.string() })).max(6),
  needs: z.object({ actions: z.array(z.string()), settings: z.array(z.string()) }),
  score: z.number().nullable().default(null),
});

// A video format is data: the rules the writer follows and the model that writes it.
export const Format = z.object({
  schemaVersion: z.literal(1),
  id: Id,
  kind: z.enum(["series", "skit"]),
  lengthS: z.object({ min: z.number(), max: z.number() }),
  beats: z.object({ min: z.number().int(), max: z.number().int() }),
  maxSpokenChars: z.number().int(),
  rules: z.array(z.string()).min(1),
  defaultMood: z.enum(["bright", "night", "horror"]),
});

// Series bible: what the next part must stay consistent with. Updated after every part.
export const SeriesBible = z.object({
  schemaVersion: z.literal(1),
  id: Id,
  title: EnglishText(60),
  formula: Id,
  world: EnglishText(600),
  narratorVoice: Voice,
  cast: z.array(Id).min(1),
  rules: z.array(EnglishText(120)).max(6),
  parts: z.array(
    z.object({
      part: z.number().int().positive(),
      title: EnglishText(60),
      summary: EnglishText(1200),
      runId: z.string(),
      audienceChoice: z.enum(["1", "2"]).optional(),
    }),
  ),
});

export type Face = z.infer<typeof Face>;
export type Voice = z.infer<typeof Voice>;
export type PoseKey = z.infer<typeof PoseKey>;
export type Action = z.infer<typeof Action>;
export type Person = z.infer<typeof Person>;
export type Spot = z.infer<typeof Spot>;
export type Set3D = z.infer<typeof Set3D>;
export type Formula = z.infer<typeof Formula>;
export type Format = z.infer<typeof Format>;
export type SeriesBible = z.infer<typeof SeriesBible>;

export const Library = z.object({
  people: z.record(Id, Person),
  actions: z.record(Id, Action),
  sets: z.record(Id, Set3D),
  formulas: z.record(Id, Formula),
  formats: z.record(Id, Format),
  series: z.record(Id, SeriesBible),
  music: z.record(
    Id,
    z.object({ id: Id, file: z.string(), mood: z.array(z.string()), seconds: z.number(), license: z.string() }),
  ),
  sfx: z.record(Id, z.object({ id: Id, file: z.string(), seconds: z.number(), license: z.string() })),
});
export type Library = z.infer<typeof Library>;
