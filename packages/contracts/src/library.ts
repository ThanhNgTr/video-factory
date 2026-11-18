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
  // knee fold, degrees: 0 = straight, 90 = shin at a right angle to the thigh (sitting, kneeling)
  kneeL: z.number().min(0).max(170).optional(),
  kneeR: z.number().min(0).max(170).optional(),
  face: Face.optional(),
});

export const Action = z.object({
  schemaVersion: z.literal(1),
  id: Id,
  dur: z.number().min(0.2).max(4),
  loop: z.boolean(),
  // sit: the hips rest on the spot's seat (a chair, a sofa, a stool); lie: the body lies on it (a bed) or the floor
  posture: z.enum(["stand", "sit", "lie"]).default("stand"),
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
    shape: z.enum(["soft", "round", "square", "lean"]).default("soft"), // body silhouette
    headShape: z.enum(["round", "oval", "square"]).default("round"),
  }),
  skin: Color,
  // ponytail, bob and curly: added with iris, lashes, blush and an inner shirt for better-looking leads. Additive:
  // every older person parses unchanged, schemaVersion stays 1
  hair: z.object({
    style: z.enum(["none", "short", "messy", "long", "bun", "bald-sides", "ponytail", "bob", "curly"]),
    color: Color,
  }),
  face: z.object({
    eyes: z.enum(["dot", "big", "glow", "none"]).default("dot"),
    brows: z.enum(["thin", "bushy", "none"]).default("thin"),
    mustache: z.boolean().default(false),
    glasses: z.boolean().default(false),
    grin: z.boolean().default(false), // permanent too-wide grin (monsters)
    iris: Color.optional(), // a coloured ring round the pupil; without it the eye is white and black
    lashes: z.boolean().default(false), // a lined upper lid with two lashes at the outer corner
    blush: z.boolean().default(false), // pink cheeks always, not only when happy
  }),
  outfit: z.object({
    top: z.enum(["tshirt", "hoodie", "coat", "suit", "dress", "uniform"]),
    topColor: Color,
    pants: Color,
    accent: Color.default("#c9a227"),
    pattern: z.enum(["none", "plaid", "stars", "stripes"]).default("none"), // printed on the top, in the accent colour
    inner: Color.optional(), // a shirt showing down the front of an open coat or hoodie
  }),
  wear: z
    .array(
      z.enum([
        "top-hat",
        "cap",
        "scarf",
        "tie",
        "apron",
        "badge",
        "raincoat-hood",
        "gloves",
        "name-tag",
        "long-fingers",
      ]),
    )
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
  // a seat at this spot (a chair, a sofa, a stool, a bed): its height in metres. Sitting and lying actions rest on it
  seat: z.number().min(0.1).max(1.5).optional(),
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
  // outdoors (a street, a yard, a building site): no ceiling, side walls or ceiling lamps; the sky behind
  outdoor: z.boolean().default(false),
  sky: Color.default("#9fd3f2"),
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
  // the sample's subject in a few words ("exponential growth: folding paper to the Moon"); a topic is not content,
  // so `vf like` may make a new video on it (ADR 0017). Older formulas have none.
  topic: z.string().max(160).optional(),
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
  kind: z.enum(["series", "skit", "explainer"]),
  lengthS: z.object({ min: z.number(), max: z.number() }),
  beats: z.object({ min: z.number().int(), max: z.number().int() }),
  maxSpokenChars: z.number().int(),
  rules: z.array(z.string()).min(1),
  // how the director stages this genre, learned from the sample's measured motion (ADR 0024): how often and how the
  // camera moves, how much characters move, shot length. Hand-written formats may leave it empty.
  staging: z.array(z.string()).max(8).default([]),
  defaultMood: z.enum(["bright", "night", "horror"]),
  // a game-like overlay (title, clock, counter) for the whole video: a genre choice, not a habit. Off unless the
  // format's sample keeps one on screen (the night-shift series does); additive, older formats read as off
  hud: z.boolean().default(false),
  // how much the sample's picture moves, measured at ingest (ADR 0024): the share of seconds the whole picture moves
  // and the seconds between hard cuts. video.qa measures the finished video the same way and reports the gap
  motion: z.object({ moving: z.number().min(0).max(1), secondsPerCut: z.number().positive() }).optional(),
  // what the script critic checks for this format, on top of the criteria every short shares (ADR 0015).
  // A new genre (knowledge, comedy, ...) brings its own rubric as data; `must` items decide pass or fail.
  rubric: z
    .array(z.object({ id: Id, check: z.string().min(10), must: z.boolean().default(true) }))
    .max(12)
    .default([]),
});

// A flat vector drawing (SVG) Claude made for a graphic and a reviewer passed (ADR 0017). Kept and reused.
export const Icon = z.object({
  schemaVersion: z.literal(1),
  id: Id,
  brief: EnglishText(160), // what it shows
  svg: z.string().min(40).max(40_000),
  score: z.number().min(0).max(10), // the reviewer's recognisability score when it was drawn
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
  sets: z.array(Id).min(1).optional(), // the only sets this series may be staged in (all sets when absent)
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

// What one finished video was about (ADR 0023): kept so the next writer takes another angle, protagonist and place.
export const Premise = z.object({
  schemaVersion: z.literal(1),
  id: Id, // the run id
  title: EnglishText(60),
  premise: EnglishText(500),
  cast: z.array(Id).max(6),
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
export type Icon = z.infer<typeof Icon>;
export type Premise = z.infer<typeof Premise>;

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
  icons: z.record(Id, Icon).default({}),
  premises: z.record(Id, Premise).default({}),
});
export type Library = z.infer<typeof Library>;
