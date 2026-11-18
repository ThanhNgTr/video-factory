import { type DrawnIcons, type Icon, Scene } from "@vf/contracts";
import { askJson, type LlmModel, loadPrompt } from "@vf/core";
import { type StageContext, stage } from "@vf/pipeline";
import { z } from "zod";
import { checkSvg, sized } from "../domain/svg.ts";
import type { AssetsDeps } from "../ports.ts";

const DRAW = loadPrompt(new URL("../../prompts/draw.md", import.meta.url).pathname);
const GUESS = loadPrompt(new URL("../../prompts/guess.md", import.meta.url).pathname);
const GATE = loadPrompt(new URL("../../prompts/gate.md", import.meta.url).pathname);
export const PASS_SCORE = 7;
export const MAX_DRAWS = 3;
const AT_ONCE = 3; // icons drawn in parallel

const Drawing = z.object({ svg: z.string() });
const Guess = z.object({ guess: z.string(), confidence: z.number().int().min(0).max(10) });
const Gate = z.object({ recognizable: z.number().int().min(0).max(10), defects: z.array(z.string()).max(6) });

type Want = { id: string; brief: string };
type Result = { icon?: Icon; failed?: DrawnIcons["failed"][number] };

// Draws the icons scene.json declares that the library lacks (ADR 0017): Claude writes an SVG, a viewer who is not told
// the subject names it, a gate scores it; below PASS_SCORE the drawer edits its drawing from the defects, at most
// MAX_DRAWS times. An icon that never passes is left out: the graphic shows its label alone, the episode goes on.
export const assetsDraw = stage<AssetsDeps>({
  name: "assets.draw",
  version: DRAW.version * 10_000 + GUESS.version * 100 + GATE.version,
  inputs: ["scene.json"],
  outputs: ["icons.json"],
  // an icon added to the library since the last run is no longer drawn here
  fingerprint: (ctx) => Object.keys(ctx.library.icons).sort(),
  run: async (ctx) => {
    const scene = ctx.store.readJson("scene.json", Scene);
    const todo = scene.icons.filter((i) => !ctx.library.icons[i.id]);
    const results: Result[] = [];
    for (let i = 0; i < todo.length; i += AT_ONCE)
      results.push(...(await Promise.all(todo.slice(i, i + AT_ONCE).map((w) => drawIcon(ctx, w)))));
    const out: DrawnIcons = {
      schemaVersion: 1,
      icons: Object.fromEntries(results.flatMap((r) => (r.icon ? [[r.icon.id, r.icon]] : []))),
      failed: results.flatMap((r) => (r.failed ? [r.failed] : [])),
    };
    if (out.failed.length) ctx.log.warn({ failed: out.failed.map((f) => f.id) }, "icons left out");
    ctx.store.writeJson("icons.json", out);
  },
});

async function drawIcon(ctx: StageContext<AssetsDeps>, want: Want): Promise<Result> {
  const onUsage = (u: Parameters<typeof ctx.recordUsage>[0]) => ctx.recordUsage(u);
  const models = ctx.config.models;
  let best: { svg: string; score: number; defects: string[] } | undefined;
  let previous = "";
  let defects: string[] = [];
  for (let n = 1; n <= MAX_DRAWS; n++) {
    const fix = previous
      ? `\n\nA quality reviewer rejected your previous drawing. Fix these problems:\n- ${defects.join("\n- ")}\n\nYour previous drawing is below. EDIT it: keep what the reviewer did not criticise and change what fixes the problems.\n<previous_svg>\n${previous}\n</previous_svg>`
      : "";
    const { svg } = await askJson(
      ctx.deps.llm,
      {
        model: models.draw as LlmModel,
        system: DRAW.text,
        user: `Icon id: ${want.id}\nWhat it shows: ${want.brief}${fix}\n\nReturn {"svg": "<svg ...>...</svg>"}.`,
        schema: Drawing,
        schemaName: "icon",
      },
      { check: (d) => checkSvg(d.svg), onUsage },
    );
    const base = `icons/${want.id}-${n}`;
    ctx.store.writeText(`${base}.svg`, sized(svg, 480));
    try {
      await ctx.deps.rasterizer.png(ctx.store.path(`${base}.svg`), ctx.store.path(`${base}.png`), 512);
    } catch (e) {
      // a drawing the rasterizer cannot read is a failed draw, fixed like any other defect
      defects = [`the SVG did not render (${String(e).slice(0, 160)}): make it valid, plain SVG`];
      previous = svg;
      continue;
    }
    const image = [{ path: ctx.store.path(`${base}.png`) }];
    const guess = await askJson(
      ctx.deps.llm,
      {
        model: models.gate as LlmModel,
        system: GUESS.text,
        user: "What does this drawing show?",
        images: image,
        schema: Guess,
        schemaName: "icon-guess",
      },
      { onUsage },
    );
    const gate = await askJson(
      ctx.deps.llm,
      {
        model: models.gate as LlmModel,
        system: GATE.text,
        user: `Intended subject: ${want.id}\nWhat it should show: ${want.brief}\nA viewer who was NOT told the subject looked at the drawing and said: "${guess.guess}" (confidence ${guess.confidence}/10).`,
        images: image,
        schema: Gate,
        schemaName: "icon-gate",
      },
      { onUsage },
    );
    ctx.log.info({ icon: want.id, draw: n, guess: guess.guess, score: gate.recognizable }, "icon judged");
    if (!best || gate.recognizable > best.score)
      best = { svg: svg.trim(), score: gate.recognizable, defects: gate.defects };
    if (gate.recognizable >= PASS_SCORE) break;
    previous = svg;
    defects = gate.defects.length ? gate.defects : [`a viewer took it for "${guess.guess}"`];
  }
  if (best && best.score >= PASS_SCORE)
    return { icon: { schemaVersion: 1, id: want.id, brief: want.brief, svg: best.svg, score: best.score } };
  return { failed: { id: want.id, brief: want.brief, score: best?.score ?? 0, problems: best?.defects ?? defects } };
}
