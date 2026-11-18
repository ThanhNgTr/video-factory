// When the parts of a motion graphic appear within its shot, shared by Graphics.tsx (which draws them) and the
// sound cues video.timeline writes (so a pop lands on its item). Pure.
import type { Diorama, Graphic } from "@vf/contracts";

export const START = 4; // frames before the first part moves
export const GROW = 0.42; // a growing number lands by this share of its shot
export const LIST_SHARE = 0.6; // list items and formula lines are all on screen by this share
export const ICONS_SHARE = 0.35;
export const LAYERS_SHARE = 0.5;
export const LAND = 5; // a dropped layer's spring lands about this many frames after it starts

export const DIORAMA_SHARE = 0.35; // a diorama's new layers have all started to drop by this share

// The layers a diorama shot lays: those the previous diorama shot did not have, matched bottom up by material so a
// layer slipped in under others counts and one that replaced another (stone for rotten logs) too. With no previous
// diorama, the layers from `reveal` on.
export function freshLayers(d: Diorama, prev?: Diorama): number[] {
  if (!prev) return d.layers.flatMap((_, i) => (i >= d.reveal ? [i] : []));
  let from = 0;
  return d.layers.flatMap((l, i) => {
    const k = prev.layers.findIndex((p, n) => n >= from && p.material === l.material);
    if (k < 0) return [i];
    from = k + 1;
    return [];
  });
}

// the frame each layer a diorama shot lays starts to come in, bottom first
export function dioramaDrops(d: Diorama, frames: number, prev?: Diorama): { i: number; frame: number }[] {
  const fresh = freshLayers(d, prev);
  return fresh.map((i, n) => ({
    i,
    frame: Math.round(START + 2 + n * Math.max(6, (frames * DIORAMA_SHARE) / fresh.length)),
  }));
}

export type Cue = { frame: number; id: string };

// the sound of each part of a graphic, by frame within the shot
export function graphicCues(g: Graphic, frames: number): Cue[] {
  const each = (n: number, share: number, id: string, extra = 0) =>
    Array.from({ length: n }, (_, i) => ({ frame: Math.round(START + (i * frames * share) / n + extra), id }));
  switch (g.kind) {
    case "count":
    case "scale":
      return [{ frame: START, id: "ticks" }];
    case "list":
      return each(g.items.length, LIST_SHARE, "pop");
    case "formula":
      return each(g.lines.length, LIST_SHARE, "pop");
    case "icons":
      return each(g.items.length, ICONS_SHARE, "pop");
    case "layers": {
      const fresh = g.layers.length - g.reveal;
      return each(fresh, LAYERS_SHARE, "thud", LAND); // each new layer thuds as it lands
    }
    case "chart":
      return [];
  }
}
