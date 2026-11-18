import { checkSetDesign, type Designs, Id, Person, PROP_SIZE, PROP_TYPES, Script, Set3D } from "@vf/contracts";
import { askJson, fillPrompt, type LlmModel, loadPrompt } from "@vf/core";
import { type StageContext, stage } from "@vf/pipeline";
import { z } from "zod";
import type { AssetsDeps } from "../ports.ts";

const PERSON = loadPrompt(new URL("../../prompts/person.md", import.meta.url).pathname);
const SET = loadPrompt(new URL("../../prompts/set.md", import.meta.url).pathname);
const SCOUT = loadPrompt(new URL("../../prompts/scout.md", import.meta.url).pathname);
const GATE = loadPrompt(new URL("../../prompts/design-gate.md", import.meta.url).pathname);
export const DESIGN_PASS = 7;
export const MAX_DESIGNS = 3;
// en-US voices edge-tts speaks; AnaNeural is a child
export const VOICES = [
  "en-US-AnaNeural",
  "en-US-AndrewNeural",
  "en-US-AriaNeural",
  "en-US-AvaNeural",
  "en-US-BrianNeural",
  "en-US-ChristopherNeural",
  "en-US-EmmaNeural",
  "en-US-EricNeural",
  "en-US-GuyNeural",
  "en-US-JennyNeural",
  "en-US-MichelleNeural",
  "en-US-RogerNeural",
  "en-US-SteffanNeural",
];

const Scouted = z.object({ newSets: z.array(z.object({ id: Id, look: z.string() })).max(2) });
const Verdict = z.object({ recognizable: z.number().int().min(0).max(10), defects: z.array(z.string()).max(6) });

// Characters and sets the library lacks, designed as data before staging (ADR 0018). A character the script
// describes in newCast, and the places a scout finds missing, are each written by Claude (parameters, not drawings),
// pictured by our renderer and judged by a gate; below DESIGN_PASS the designer fixes its own design, at most
// MAX_DESIGNS times. The best design is always kept: the story needs that character or place.
export const assetsDesign = stage<AssetsDeps>({
  name: "assets.design",
  version: PERSON.version * 1_000_000 + SET.version * 10_000 + SCOUT.version * 100 + GATE.version,
  inputs: ["script.json"],
  outputs: ["designs.json"],
  fingerprint: (ctx) => [Object.keys(ctx.library.people).sort(), Object.keys(ctx.library.sets).sort()],
  run: async (ctx) => {
    const script = ctx.store.readJson("script.json", Script);
    const out: Designs = { schemaVersion: 1, people: {}, sets: {}, scores: {} };
    const others = [
      ...script.cast.flatMap((id) => {
        const p = ctx.library.people[id];
        return p ? [`- ${p.id}: ${p.name}, ${p.outfit.top} ${p.outfit.topColor}, ${p.hair.style} hair`] : [];
      }),
      ...script.newCast.map((c) => `- ${c.id}: ${c.name}, ${c.look}`),
    ].join("\n");
    const wanted = script.newCast.filter((c) => !ctx.library.people[c.id]);
    const people = await Promise.all(
      wanted.map((c) =>
        design(ctx, {
          what: "characters",
          id: c.id,
          look: `${c.name}: ${c.look}`,
          system: fillPrompt(PERSON, { voices: VOICES.join(", "), others: others || "(none)" }),
          schema: Person,
          schemaName: "person",
          normalize: (p) => ({ ...p, id: c.id, name: c.name }),
          check: (p) => (VOICES.includes(p.voice.id) ? [] : [`voice.id must be one of ${VOICES.join(", ")}`]),
          snap: (p, file) => ctx.deps.snapshot.person(p, file),
          seen: "the character from the front, both sides and the back, plus a close-up of the head",
          limits:
            "The renderer builds every character from fixed parts: a round, oval or square head, a few hair styles (short, messy, long, bun, bald sides, ponytail, bob, curly), eyes with or without a coloured iris and lashes, a few tops (t-shirt, hoodie, coat, suit, dress, uniform), flat colours and a few accessories (hats, scarf, tie, apron, glasses, badge). Judge whether the ROLE reads: age, gender, build, status and attitude (a strict old teacher, a cocky teenager). Details those parts cannot show (braids, a cardigan, a pencil behind the ear) are not defects; a wrong age, gender or attitude is.",
        }),
      ),
    );
    wanted.forEach((c, i) => {
      const r = people[i];
      if (r) {
        out.people[c.id] = r.value;
        out.scores[c.id] = r.score;
      }
    });
    // a series stages in its bible's sets; a narrator over graphics needs no room at all
    if (!ctx.params.series && script.cast.length) {
      const scouted = await askJson(
        ctx.deps.llm,
        {
          model: ctx.config.models.direct as LlmModel,
          system: fillPrompt(SCOUT, {
            sets: Object.values(ctx.library.sets)
              .map((s) => `- ${s.id}: ${s.spots.map((sp) => sp.note ?? sp.id).join("; ")}`)
              .join("\n"),
          }),
          user: `SCRIPT:\n${JSON.stringify({ title: script.title, beats: script.beats.map((b) => b.action) }, null, 1)}`,
          schema: Scouted,
          schemaName: "scout",
        },
        {
          check: (s) =>
            s.newSets.filter((x) => ctx.library.sets[x.id]).map((x) => `"${x.id}" is a library set already: use it`),
          onUsage: (u) => ctx.recordUsage(u),
        },
      );
      const example = ctx.library.sets["diner-kitchen"] ?? Object.values(ctx.library.sets)[0];
      for (const want of scouted.newSets) {
        const r = await design(ctx, {
          what: "room sets",
          id: want.id,
          look: want.look,
          system: fillPrompt(SET, {
            types: PROP_TYPES.join(", "),
            sizes: JSON.stringify(PROP_SIZE),
            example: example ? JSON.stringify(example) : "(none)",
          }),
          schema: Set3D,
          schemaName: "set",
          normalize: (s) => ({ ...s, id: want.id }),
          check: checkSetDesign,
          snap: (s, file) => ctx.deps.snapshot.set(s, file),
          seen: "the empty room from the camera's wide shot",
          limits:
            "Sets are low-poly rooms built from boxes, cylinders, counters, shelves, sofas, chairs, plants, doors, windows and paintings. Judge whether the KIND of place reads (a classroom, an office), not fine detail.",
        });
        out.sets[want.id] = r.value;
        out.scores[want.id] = r.score;
      }
    }
    ctx.store.writeJson("designs.json", out);
  },
});

type Brief<T> = {
  what: string;
  id: string;
  look: string;
  system: string;
  schema: z.ZodType<T>;
  schemaName: string;
  normalize: (v: T) => T;
  check: (v: T) => string[];
  snap: (v: T, file: string) => Promise<void>;
  seen: string; // what the picture shows, for the gate
  limits: string; // what the renderer can and cannot show, so the gate judges only what a redesign can fix
};

async function design<T>(ctx: StageContext<AssetsDeps>, b: Brief<T>): Promise<{ value: T; score: number }> {
  const onUsage = (u: Parameters<typeof ctx.recordUsage>[0]) => ctx.recordUsage(u);
  let best: { value: T; score: number } | undefined;
  let previous: T | undefined;
  let defects: string[] = [];
  for (let n = 1; n <= MAX_DESIGNS; n++) {
    const fix = previous
      ? `\n\nA reviewer rejected your previous design. Fix these problems:\n- ${defects.join("\n- ")}\n\nYour previous design (edit it; keep what was not criticised):\n${JSON.stringify(previous)}`
      : "";
    const value = b.normalize(
      await askJson(
        ctx.deps.llm,
        {
          model: ctx.config.models.draw as LlmModel,
          system: b.system,
          user: `Id: ${b.id}\nLook: ${b.look}${fix}\n\nReturn the JSON.`,
          schema: b.schema,
          schemaName: b.schemaName,
        },
        { check: (v) => b.check(b.normalize(v)), onUsage },
      ),
    );
    const file = `designs/${b.id}-${n}.png`;
    await b.snap(value, ctx.store.path(file));
    const verdict = await askJson(
      ctx.deps.llm,
      {
        model: ctx.config.models.gate as LlmModel,
        system: fillPrompt(GATE, { what: b.what, limits: b.limits }),
        user: `Description: ${b.look}\nThe image shows ${b.seen}.`,
        images: [{ path: ctx.store.path(file) }],
        schema: Verdict,
        schemaName: "design-gate",
      },
      { onUsage },
    );
    ctx.log.info({ design: b.id, round: n, score: verdict.recognizable }, "design judged");
    if (!best || verdict.recognizable > best.score) best = { value, score: verdict.recognizable };
    if (verdict.recognizable >= DESIGN_PASS) break;
    previous = value;
    defects = verdict.defects.length ? verdict.defects : ["it does not read as the description"];
  }
  if (!best) throw new Error(`design ${b.id}: no attempt was judged`); // MAX_DESIGNS >= 1, so never
  return best;
}
