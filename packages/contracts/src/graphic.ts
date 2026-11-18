// Motion graphics: data visuals that code draws (ADR 0017). The director fills in the numbers and the words; the
// renderer animates them. Icons are library drawings (Icon), named by id; new ones are declared in scene.icons.
import { z } from "zod";
import { Color, EnglishText, Id } from "./common.ts";

const Label = EnglishText(48);
const Value = z.number();

export const GRAPHIC_KINDS = ["count", "scale", "chart", "formula", "list", "icons", "layers"] as const;

export const Graphic = z.discriminatedUnion("kind", [
  // a big number counting from..to over the shot ("4,398,046,511,104 layers")
  z.object({
    kind: z.literal("count"),
    from: Value,
    to: Value,
    unit: EnglishText(24).optional(),
    label: Label.optional(),
    icon: Id.optional(),
  }),
  // a bar growing on a log scale from..to, passing labelled landmarks (a sheet of paper -> Everest -> the Moon)
  z.object({
    kind: z.literal("scale"),
    unit: EnglishText(12), // the unit every value is in: "m", "km", "years"
    from: Value.positive(),
    to: Value.positive(),
    marks: z
      .array(z.object({ label: Label, value: Value.positive(), icon: Id.optional() }))
      .min(1)
      .max(8),
    label: Label.optional(),
  }),
  // a line or bar chart drawn point by point; `highlight` calls out one point
  z.object({
    kind: z.literal("chart"),
    style: z.enum(["line", "bar"]),
    log: z.boolean().default(false),
    unit: EnglishText(12).optional(), // "m" shows values as human lengths
    points: z
      .array(z.object({ label: EnglishText(16), value: Value }))
      .min(2)
      .max(24),
    label: Label.optional(),
    highlight: z.number().int().min(0).optional(),
  }),
  // up to 3 lines of arithmetic, revealed one by one; "^" raises what follows ("2^42 x 0.1 mm = 439,805 km")
  z.object({ kind: z.literal("formula"), lines: z.array(EnglishText(40)).min(1).max(3) }),
  // steps or facts revealed one by one
  z.object({ kind: z.literal("list"), title: Label.optional(), items: z.array(EnglishText(48)).min(2).max(5) }),
  // a cross-section that builds up: layers listed bottom first; those before `reveal` are already there, the rest drop
  // in one by one and the newest is called out. Repeat it shot after shot with one more layer to show a build growing
  z.object({
    kind: z.literal("layers"),
    title: Label.optional(),
    layers: z
      .array(
        z.object({ label: EnglishText(32), color: Color.optional(), thick: z.number().min(0.5).max(3).default(1) }),
      )
      .min(1)
      .max(7),
    reveal: z.number().int().min(0).default(0),
    focus: z.number().int().min(0).optional(), // the layer to call out (one put in the middle); default: the last new one
    top: Id.optional(), // an icon standing on the top layer (a house on its foundation)
  }),
  // 1-4 icons side by side, each with a label and a value: a comparison, a cast of things, one hero object
  z.object({
    kind: z.literal("icons"),
    items: z
      .array(z.object({ icon: Id, label: Label.optional(), value: EnglishText(24).optional() }))
      .min(1)
      .max(4),
  }),
]);

// the icon ids a graphic draws
export const iconsOf = (g: Graphic): string[] =>
  g.kind === "count"
    ? g.icon
      ? [g.icon]
      : []
    : g.kind === "scale"
      ? g.marks.flatMap((m) => (m.icon ? [m.icon] : []))
      : g.kind === "icons"
        ? g.items.map((i) => i.icon)
        : g.kind === "layers" && g.top
          ? [g.top]
          : [];

// what a graphic's numbers must satisfy beyond their types
export function checkGraphic(g: Graphic): string[] {
  if (g.kind === "scale" && g.from >= g.to) return ["a scale grows: `from` must be below `to`"];
  if (g.kind === "chart" && g.log && g.points.some((p) => p.value <= 0)) return ["a log chart needs values above 0"];
  if (g.kind === "layers" && g.reveal > g.layers.length)
    return [`reveal ${g.reveal} is more than the ${g.layers.length} layers`];
  if (g.kind === "layers" && g.focus !== undefined && g.focus >= g.layers.length)
    return [`focus ${g.focus} is past the last layer (${g.layers.length - 1})`];
  if (g.kind === "chart" && g.highlight !== undefined && g.highlight >= g.points.length)
    return [`highlight ${g.highlight} is past the last point (${g.points.length - 1})`];
  return [];
}

export type Graphic = z.infer<typeof Graphic>;
