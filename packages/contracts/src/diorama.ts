// A 3D build diorama (ADR 0021): a fixed camera looks along a strip (a road, a path) running into the distance, with
// the ground cut away at the front so the layers under the strip show. Shot after shot, layers are laid, pieces
// appear (a crown, ditches, cracks, a pothole, lines), weather turns and machines roll in: the build grows in 3D.
// The director fills in the data; the renderer draws everything from it.
import { z } from "zod";
import { EnglishText } from "./common.ts";

export const MATERIALS = [
  "soil",
  "clay",
  "sand",
  "gravel",
  "stones",
  "crushed-rock",
  "concrete",
  "asphalt",
  "water",
  "ice",
  "logs", // a corduroy layer: logs laid across the strip
] as const;
export const SURFACES = ["grass", "dirt", "mud", "stones", "gravel", "crushed-rock", "asphalt", "concrete"] as const;
export const PIECES = [
  "crown",
  "ditches",
  "cracks",
  "pothole",
  "ice-lens",
  "water-seep",
  "lines",
  "curb",
  "sign",
] as const;

export const Diorama = z.object({
  // laid under the strip, bottom first, on top of the soil that is always there
  layers: z
    .array(
      z.object({
        material: z.enum(MATERIALS),
        thick: z.number().min(0.05).max(1.5), // metres
      }),
    )
    .max(6)
    .default([]),
  reveal: z.number().int().min(0).default(0), // layers before this index are already there; the rest are laid now
  surface: z.enum(SURFACES).default("dirt"), // what the strip's top looks like
  pieces: z.array(z.enum(PIECES)).max(8).default([]),
  sign: EnglishText(24).optional(), // the text on a roadside sign (with the "sign" piece)
  weather: z.enum(["clear", "rain", "snow"]).default("clear"),
  vehicle: z.enum(["none", "car", "truck", "roller"]).default("none"),
  view: z.enum(["road", "cutaway"]).default("road"), // the whole scene, or close on the cut-away layers
});

export function checkDiorama(d: Diorama): string[] {
  const errs: string[] = [];
  if (d.reveal > d.layers.length) errs.push(`reveal ${d.reveal} is more than the ${d.layers.length} layers`);
  if (d.sign && !d.pieces.includes("sign")) errs.push('a sign text needs the "sign" piece');
  return errs;
}

export type Diorama = z.infer<typeof Diorama>;
