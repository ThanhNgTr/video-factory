// One-off migration: legacy/library (demo schema) -> library/ (contracts schema). Run: node tools/migrate-legacy.ts
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Action, Format, Formula, Person, SeriesBible, Set3D } from "@vf/contracts";
import type { z } from "zod";

const ROOT = new URL("..", import.meta.url).pathname;
const SRC = join(ROOT, "legacy/library");
const DST = join(ROOT, "library");

const readDir = (dir: string): Record<string, unknown>[] =>
  readdirSync(join(SRC, dir))
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(SRC, dir, f), "utf8")) as Record<string, unknown>);

function save<T extends { id: string }>(dir: string, schema: z.ZodType<T>, item: unknown): void {
  const parsed = schema.parse(item);
  mkdirSync(join(DST, dir), { recursive: true });
  writeFileSync(join(DST, dir, `${parsed.id}.json`), `${JSON.stringify(parsed, null, 2)}\n`);
}

for (const a of readDir("actions")) save("actions", Action, { schemaVersion: 1, ...a });
for (const p of readDir("people")) {
  const build = (p.build as Record<string, number> | undefined) ?? {};
  save("people", Person, {
    schemaVersion: 1,
    ...p,
    build: { height: 1, width: 1, head: 1, ...build },
    face: { eyes: "dot", brows: "thin", mustache: false, glasses: false, grin: false, ...(p.face as object) },
  });
}

// Named standing places per set (roadmap §2.3: no more raw x coordinates). [x, z] in metres, camera at +z.
const SPOTS: Record<
  string,
  { id: string; pos: [number, number]; facing?: "camera" | "left" | "right" | "away"; note?: string }[]
> = {
  "hotel-lobby": [
    { id: "behind-desk", pos: [0, -3.3], note: "the clerk's place behind the front desk" },
    { id: "at-desk", pos: [0, -1.6], facing: "away", note: "a guest standing at the counter, back to camera" },
    { id: "at-desk-side", pos: [1.1, -1.7], facing: "left", note: "a guest at the counter, seen in profile" },
    { id: "center-left", pos: [-0.9, 0], note: "open floor, left" },
    { id: "center-right", pos: [0.9, 0], note: "open floor, right" },
    { id: "entrance", pos: [3.6, 1.5], facing: "left", note: "just inside the front door" },
    { id: "elevator", pos: [-3.3, -3.4], facing: "right", note: "in front of the elevator doors" },
    { id: "far-corner", pos: [-3.5, 1.0], facing: "right", note: "dim corner by the window" },
  ],
  "hotel-hallway": [
    { id: "near", pos: [0, 1.0], note: "close to camera" },
    { id: "mid", pos: [0, -3.5], note: "middle of the corridor" },
    { id: "far", pos: [0, -9], note: "deep in the corridor, small and dim" },
    { id: "door-left", pos: [-1.1, -4.5], facing: "left", note: "at a room door on the left" },
    { id: "door-right", pos: [1.1, -6.5], facing: "right", note: "at a room door on the right" },
    { id: "end", pos: [0, -17], note: "at the dark door at the very end" },
  ],
};
for (const s of readDir("sets")) {
  const spots = SPOTS[s.id as string];
  if (!spots) throw new Error(`no spots defined for set ${s.id}`);
  save("sets", Set3D, { schemaVersion: 1, ...s, spots });
}
for (const f of readDir("formulas")) save("formulas", Formula, { schemaVersion: 1, ...f });

// The demo's one series becomes a series bible (facts the next part must respect).
const nd = JSON.parse(readFileSync(join(SRC, "series/night-desk.json"), "utf8")) as {
  parts: { part: number; title: string; summary: string; run: string }[];
};
save("series", SeriesBible, {
  schemaVersion: 1,
  id: "night-desk",
  title: "The Night Desk",
  formula: "second-person-rules-horror-choice-cliffhanger",
  world:
    "You are Sam, the new night clerk of an old hotel. The hotel officially has no floor 13. The night manager Mr. Harlow gives rules and never explains them. Guests who should not exist arrive after midnight.",
  narratorVoice: { id: "en-US-GuyNeural", pitch: "-4Hz", rate: "-5%" },
  cast: ["night-clerk", "old-manager", "housekeeper", "raincoat-girl", "tall-guest"],
  rules: [
    "There is no floor 13. Never give a room on it.",
    "Never tell a guest your name.",
    "After 3 AM, never leave the desk.",
  ],
  parts: nd.parts.map((p) => ({ part: p.part, title: p.title, summary: p.summary, runId: p.run })),
});

// The series format as data (rules distilled from legacy/prompts/demo-prompts.md).
save("formats", Format, {
  schemaVersion: 1,
  id: "series",
  kind: "series",
  lengthS: { min: 60, max: 110 },
  beats: { min: 14, max: 26 },
  maxSpokenChars: 1300,
  defaultMood: "horror",
  rules: [
    "An episodic second-person survival mystery: the narrator talks to 'you'; the viewer IS the protagonist. Most lines are narrator lines; characters speak rarely, short and unsettling.",
    "In every line wrap 1-3 key words in *asterisks* (they render highlighted). No emoji.",
    "Beat 1 is a cold open: the most intriguing statement, under 3 seconds, with an on-screen text card.",
    "Set hud.title to a short game-like label (e.g. 'NIGHT 1 - FRONT DESK') and hud.counterLabel to what the viewer tracks. Set clock on beat 1 and advance it; set counter whenever it changes.",
    "Give the viewer 2-4 numbered survival rules, each its own beat with a text card like 'RULE 1: *Never* say your name' while the narrator reads it. Later beats must test or break those rules.",
    "Escalate: rules -> something slightly wrong -> clearly wrong. Mix narrated beats with silent tension beats (no lines).",
    "Ask the viewer to decide or spot the anomaly at least once (drives comments).",
    "Build to one scare near the end (tension 'scary').",
    "End on a cliffhanger with a two-option choice: fill `choice` and make the last beat's text 'COMMENT *1* OR *2*?'. The most-voted option decides the next part.",
    "Keep all spoken text together under the character budget; speech runs about 14 characters per second.",
  ],
});
console.log("migrated");
