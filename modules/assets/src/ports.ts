// What the assets stages need from outside. Types only; adapters live in adapters/, wired in apps/*/src/wiring.ts.
import type { Person, Set3D } from "@vf/contracts";
import type { Llm } from "@vf/core";

// turns an SVG file into a PNG on white, for a vision reviewer to look at
export interface Rasterizer {
  png(svgFile: string, pngFile: string, px: number): Promise<void>;
}

// a picture of a design for the gate to judge: a character sheet, or an empty set from the camera
// (drawn by the video module's compositions; the composition root joins the two)
export interface Snapshot {
  person(p: Person, outFile: string): Promise<void>;
  set(s: Set3D, outFile: string): Promise<void>;
}

export type AssetsDeps = { llm: Llm; rasterizer: Rasterizer; snapshot: Snapshot };
