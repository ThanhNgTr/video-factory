#!/usr/bin/env node
// vf: the factory's command line. `vf make` turns an idea (or nothing) into an MP4.
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import {
  CastMember,
  Designs,
  DrawnIcons,
  Face,
  Format,
  Formula,
  type Premise,
  Script,
  SeriesBible,
} from "@vf/contracts";
import { StageError } from "@vf/core";
import { runStages } from "@vf/pipeline";
import { nextPart } from "@vf/script";
import { COMPOSITION_ENTRY, type PreviewProps } from "@vf/video";
import { INGEST, MAKE } from "./pipelines.ts";
import { startStudio } from "./studio/server.ts";
import { ROOT, wire } from "./wiring.ts";

const { values: a, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    format: { type: "string", default: "series" },
    series: { type: "string" },
    idea: { type: "string" },
    formula: { type: "string" },
    choice: { type: "string" },
    url: { type: "string" },
    run: { type: "string" },
    force: { type: "boolean", default: false },
    until: { type: "string" },
    action: { type: "string" },
    face: { type: "string", default: "neutral" },
    holds: { type: "string" },
    drip: { type: "string" },
    port: { type: "string", default: "5170" },
    note: { type: "string" },
  },
});
const [cmd = "help", arg] = positionals;
const stamp = () => new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

const w = wire();
const params = Object.fromEntries(
  Object.entries({
    format: a.format,
    series: a.series,
    idea: a.idea,
    formula: a.formula,
    choice: a.choice,
    url: a.url,
  }).filter(([, v]) => v !== undefined),
) as Record<string, string>;

async function make(runId: string, p: Record<string, string>, force: boolean, only?: string, until?: string) {
  const ctx = w.context(runId, p);
  await runStages(ctx, w.state, MAKE, { force, only, until });
  // what this run drew or designed joins the library: the next video reuses it instead of making it again.
  // Designed characters and sets are kept whatever their score: the video shows them, and a series needs them back.
  const keep = (dir: string, items: { id: string }[]) => {
    mkdirSync(join(w.config.libraryDir, dir), { recursive: true });
    for (const item of items) {
      const file = join(w.config.libraryDir, dir, `${item.id}.json`);
      if (!existsSync(file)) writeFileSync(file, `${JSON.stringify(item, null, 2)}\n`);
    }
  };
  if (ctx.store.exists("icons.json")) keep("icons", Object.values(ctx.store.readJson("icons.json", DrawnIcons).icons));
  if (ctx.store.exists("designs.json")) {
    const d = ctx.store.readJson("designs.json", Designs);
    keep("people", Object.values(d.people));
    keep("sets", Object.values(d.sets));
  }
  if (only || until) {
    console.log(
      `\nstopped after ${only ?? until}. Edit ${ctx.store.dir}/script.json if you like, then: vf resume ${runId}`,
    );
    return;
  }
  const out = join(ROOT, "out");
  mkdirSync(out, { recursive: true });
  copyFileSync(ctx.store.path("video.mp4"), join(out, `${runId}.mp4`));
  // what this video was about joins the studio's memory, so the next script takes another angle (ADR 0023)
  const script = ctx.store.readJson("script.json", Script);
  const premise: Premise = {
    schemaVersion: 1,
    id: runId.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
    title: script.title,
    premise: (script.premise ?? script.summary).slice(0, 500),
    cast: script.cast,
  };
  keep("premises", [premise]);
  if (p.series) {
    const bible = ctx.store.readJson("series-bible.json", SeriesBible);
    writeFileSync(join(w.config.libraryDir, "series", `${bible.id}.json`), `${JSON.stringify(bible, null, 2)}\n`);
  }
  console.log(`\nvideo: out/${runId}.mp4\nrun:   ${ctx.store.dir}\ncost:  $${w.state.runCost(runId).toFixed(3)}`);
}

// Learn from a link: its formula (story mechanics) and format (the genre) join the library under one id, returned.
async function ingest(runId: string, p: Record<string, string>, force: boolean): Promise<string> {
  const ctx = w.context(runId, p);
  await runStages(ctx, w.state, INGEST, { force });
  const formula = ctx.store.readJson("formula.json", Formula);
  const format = ctx.store.readJson("format.json", Format);
  // never overwrite an existing formula or format: a formula's score is feedback data
  const lib = w.config.libraryDir;
  const taken = (id: string) =>
    existsSync(join(lib, "formulas", `${id}.json`)) || existsSync(join(lib, "formats", `${id}.json`));
  let id = formula.id;
  for (let n = 2; taken(id); n++) id = `${formula.id}-${n}`;
  writeFileSync(join(lib, "formulas", `${id}.json`), `${JSON.stringify({ ...formula, id }, null, 2)}\n`);
  writeFileSync(join(lib, "formats", `${id}.json`), `${JSON.stringify({ ...format, id }, null, 2)}\n`);
  // this process goes on to make a video from them (vf like): its library sees them too
  w.library.formulas[id] = { ...formula, id };
  w.library.formats[id] = { ...format, id };
  console.log(
    `\nformula: library/formulas/${id}.json\nformat:  library/formats/${id}.json (${format.kind})\ncost:    $${w.state.runCost(runId).toFixed(3)}`,
  );
  return id;
}

async function main() {
  switch (cmd) {
    case "make": {
      const runId =
        a.run ?? (a.series ? `${a.series}-p${nextPart(w.library.series[a.series])}` : `${a.format}-${stamp()}`);
      await make(runId, params, a.force, undefined, a.until);
      return;
    }
    case "resume": {
      if (!arg) throw new Error("usage: vf resume <runId>");
      const run = w.state.getRun(arg);
      if (!run) throw new Error(`unknown run ${arg}`);
      if (run.params.url) await ingest(arg, run.params, false);
      else await make(arg, run.params, false);
      return;
    }
    case "run": {
      if (!arg || !a.run) throw new Error("usage: vf run <stage> --run <runId>");
      const run = w.state.getRun(a.run);
      if (!run) throw new Error(`unknown run ${a.run}`);
      await make(a.run, run.params, true, arg);
      return;
    }
    case "ingest": {
      if (!a.url) throw new Error("usage: vf ingest --url <link>");
      await ingest(a.run ?? `ingest-${stamp()}`, { url: a.url }, a.force);
      return;
    }
    case "like": {
      // a sample in, a similar video out (ADR 0017): learn its formula and format, then make a new video with them
      const url = arg ?? a.url;
      if (!url) throw new Error('usage: vf like <link> [--idea "..."]');
      const id = await ingest(a.run ? `ingest-${a.run}` : `ingest-${stamp()}`, { url }, a.force);
      // no idea given: the same topic as the sample, in new words (a topic is not its content)
      const topic = w.library.formulas[id]?.topic;
      const idea =
        a.idea ??
        (topic
          ? `The same topic as the sample: ${topic}. Use your own angle, examples, structure details and lines; never reuse the sample's lines.`
          : undefined);
      const p: Record<string, string> = { format: id, formula: id, ...(idea ? { idea } : {}) };
      await make(a.run ?? `${id}-${stamp()}`, p, a.force, undefined, a.until);
      return;
    }
    case "preview": {
      // character sheet, no run: runs/previews/<id>[.action].png
      const person = arg ? w.library.people[arg] : undefined;
      if (!person)
        throw new Error(
          `usage: vf preview <personId> [--action <id>] [--face <face>] [--holds card|key|phone|towel|<icon id>] [--drip up|down] (people: ${Object.keys(w.library.people).join(", ")})`,
        );
      const action = a.action ? w.library.actions[a.action] : undefined;
      const cast = CastMember.pick({ holds: true, drip: true }).parse({ holds: a.holds, drip: a.drip });
      const heldIcon = cast.holds ? w.library.icons[cast.holds] : undefined;
      const props: PreviewProps = { person, action, face: Face.parse(a.face), ...cast, heldIcon };
      const outFile = join(w.config.runsDir, "previews", `${person.id}${action ? `.${action.id}` : ""}.png`);
      mkdirSync(join(w.config.runsDir, "previews"), { recursive: true });
      await w.deps.renderer.still({
        entry: COMPOSITION_ENTRY,
        compositionId: "Preview",
        props: props as unknown as Record<string, unknown>,
        outFile,
        frame: 12,
      });
      console.log(outFile);
      return;
    }
    case "revise": {
      // rewrite a run's script from a producer note, then remake everything after it
      const run = arg ? w.state.getRun(arg) : undefined;
      if (!arg || !run || !a.note?.trim()) throw new Error('usage: vf revise <runId> --note "what to change"');
      await make(arg, { ...run.params, note: a.note.trim() }, false, undefined, a.until);
      return;
    }
    case "studio": {
      // the web front: stays up until Ctrl+C (jobs it started stop with it)
      await startStudio(w, ROOT, Number(a.port));
      return;
    }
    case "runs": {
      for (const r of w.state.listRuns()) console.log(`${r.id}\t${r.status}\t$${r.cost.toFixed(3)}\t${r.created_at}`);
      return;
    }
    case "show": {
      if (!arg) throw new Error("usage: vf show <runId>");
      const run = w.state.getRun(arg);
      if (!run) throw new Error(`unknown run ${arg}`);
      console.log(
        `run ${run.id}: ${run.status}  params=${JSON.stringify(run.params)}  dir=${join(w.config.runsDir, run.id)}`,
      );
      for (const s of w.state.listStages(arg))
        console.log(
          `  ${s.stage.padEnd(16)} v${s.version}  ${s.status.padEnd(8)} ${String(s.ms).padStart(7)} ms  ${s.error ?? ""}`,
        );
      for (const c of w.state.listCosts(arg))
        console.log(`  $${c.cost_usd.toFixed(4)}  ${c.stage} ${c.provider}/${c.model} ${c.ms} ms`);
      return;
    }
    default:
      console.log(`vf make [--format series] [--series <id>] [--idea "..."] [--formula <id>] [--choice 1|2] [--run <id>] [--force] [--until <stage>]
vf like <link> [--idea "..."]     a similar video from a sample: learn its formula and format, then make one
vf ingest --url <link>            learn a formula and a format from a video
vf resume <runId>                 continue a failed run
vf run <stage> --run <runId>      re-run one stage
vf preview <personId> [--action <id>] [--face <face>]   character sheet png
vf runs | vf show <runId>
vf revise <runId> --note "..."    rewrite a run's script from your note, then remake the video
vf studio [--port 5170]           the web studio: create episodes, edit scripts, watch progress`);
  }
}

main()
  .catch((e: unknown) => {
    if (e instanceof StageError) console.error(`\n${e.code}: ${e.message}\n${JSON.stringify(e.details, null, 1)}`);
    else console.error(e);
    process.exitCode = 1;
  })
  .finally(() => w.state.close());
