import { z } from "zod";

export const Id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "id: lowercase a-z, 0-9, dash");
export const Color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "color: #rrggbb");
export const V3 = z.tuple([z.number(), z.number(), z.number()]);
export const V2 = z.tuple([z.number(), z.number()]);

// Everything shown or spoken in a video is US English: block any letter outside basic Latin (roadmap §5.A).
const NON_ENGLISH = /[^\x20-\x7E‘’“”…—–\n]/u;
export const EnglishText = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((s) => !NON_ENGLISH.test(s), "text must be plain US English (no accents, emoji or other scripts)");

export const NARRATOR = "narrator";
export type Id = z.infer<typeof Id>;
