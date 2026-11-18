// Mouth shape from the letters of the word being spoken (roadmap: visemes from word timings; Rhubarb later).
// Pure: a function of the captions and the frame.
import type { Caption } from "@vf/contracts";

export type Mouth = { open: number; wide: number }; // open 0..1, wide = horizontal scale (0.5 pucker .. 1.1 grin)

const SHAPES: Record<string, Mouth> = {
  closed: { open: 0.04, wide: 1 }, // m b p
  teeth: { open: 0.14, wide: 1.05 }, // f v
  round: { open: 0.45, wide: 0.6 }, // o u w
  openWide: { open: 0.85, wide: 1.05 }, // a
  mid: { open: 0.5, wide: 1 }, // e i y and most consonants
  tongue: { open: 0.4, wide: 0.85 }, // l th
  rest: { open: 0.05, wide: 1 },
};
const classOf = (ch: string): keyof typeof SHAPES => {
  if ("mbp".includes(ch)) return "closed";
  if ("fv".includes(ch)) return "teeth";
  if ("ouw".includes(ch)) return "round";
  if (ch === "a") return "openWide";
  if ("lt".includes(ch)) return "tongue";
  return "mid";
};

// The word that covers `frame` and how far through it we are; a word lasts until the next one starts (or 8 frames).
export function mouthAt(words: readonly Caption[], frame: number, shot: string): Mouth | null {
  const list = words.filter((w) => w.shot === shot);
  for (let i = 0; i < list.length; i++) {
    const w = list[i];
    if (!w) continue;
    const end = list[i + 1]?.frame ?? w.frame + 8;
    if (frame < w.frame || frame >= end) continue;
    const letters = w.text.toLowerCase().replace(/[^a-z]/g, "");
    if (!letters) return SHAPES.rest ?? null;
    // one shape per letter, held over the word's span, with a short close at the end of a word
    const u = (frame - w.frame) / Math.max(1, end - w.frame);
    if (u > 0.85 && end - w.frame > 6) return SHAPES.rest ?? null;
    const ch = letters[Math.min(letters.length - 1, Math.floor((u / 0.85) * letters.length))] ?? "e";
    return SHAPES[classOf(ch)] ?? null;
  }
  return null;
}
