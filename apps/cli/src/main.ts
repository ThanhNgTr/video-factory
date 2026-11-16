#!/usr/bin/env node
// vf: the factory's command line. `vf make` turns an idea (or nothing) into an MP4.
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { Face, Formula, SeriesBible } from "@vf/contracts";
import { StageError } from "@vf/core";
import { runStages } from "@vf/pipeline";
import { nextPart } from "@vf/script";
import { COMPOSITION_ENTRY, type PreviewProps } from "@vf/video";
import { INGEST, MAKE } from "./pipelines.ts";
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
  if (only || until) {
    console.log(
      `\nstopped after ${only ?? until}. Edit ${ctx.store.dir}/script.json if you like, then: vf resume ${runId}`,
    );
    return;
  }
  const out = join(ROOT, "out");
  mkdirSync(out, { recursive: true });
  copyFileSync(ctx.store.path("video.mp4"), join(out, `${runId}.mp4`));
  if (p.series) {
    const bible = ctx.store.readJson("series-bible.json", SeriesBible);
    writeFileSync(join(w.config.libraryDir, "series", `${bible.id}.json`), `${JSON.stringify(bible, null, 2)}\n`);
  }
  console.log(`\nvideo: out/${runId}.mp4\nrun:   ${ctx.store.dir}\ncost:  $${w.state.runCost(runId).toFixed(3)}`);
}

async function ingest(runId: string, p: Record<string, string>, force: boolean) {
  const ctx = w.context(runId, p);
  await runStages(ctx, w.state, INGEST, { force });
  const formula = ctx.store.readJson("formula.json", Formula);
  // never overwrite an existing formula: its score is feedback data
  let id = formula.id;
  for (let n = 2; existsSync(join(w.config.libraryDir, "formulas", `${id}.json`)); n++) id = `${formula.id}-${n}`;
  writeFileSync(
    join(w.config.libraryDir, "formulas", `${id}.json`),
    `${JSON.stringify({ ...formula, id }, null, 2)}\n`,
  );
  console.log(`\nformula: library/formulas/${id}.json\ncost:    $${w.state.runCost(runId).toFixed(3)}`);
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
      const runId = a.run ?? `ingest-${stamp()}`;
      const ctx = w.context(runId, { url: a.url });
      await runStages(ctx, w.state, INGEST, { force: a.force });
      const formula = ctx.store.readJson("formula.json", Formula);
      // never overwrite an existing formula: its score is feedback data
      let id = formula.id;
      for (let n = 2; existsSync(join(w.config.libraryDir, "formulas", `${id}.json`)); n++) id = `${formula.id}-${n}`;
      writeFileSync(
        join(w.config.libraryDir, "formulas", `${id}.json`),
        `${JSON.stringify({ ...formula, id }, null, 2)}\n`,
      );
      console.log(`\nformula: library/formulas/${id}.json\ncost:    $${w.state.runCost(runId).toFixed(3)}`);
      return;
    }
    case "preview": {
      // character sheet, no run: runs/previews/<id>[.action].png
      const person = arg ? w.library.people[arg] : undefined;
      if (!person)
        throw new Error(
          `usage: vf preview <personId> [--action <id>] [--face <face>] (people: ${Object.keys(w.library.people).join(", ")})`,
        );
      const action = a.action ? w.library.actions[a.action] : undefined;
      const props: PreviewProps = { person, action, face: Face.parse(a.face) };
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
vf ingest --url <link>            learn a formula from a video
vf resume <runId>                 continue a failed run
vf run <stage> --run <runId>      re-run one stage
vf preview <personId> [--action <id>] [--face <face>]   character sheet png
vf runs | vf show <runId>`);
  }
}

main()
  .catch((e: unknown) => {
    if (e instanceof StageError) console.error(`\n${e.code}: ${e.message}\n${JSON.stringify(e.details, null, 1)}`);
    else console.error(e);
    process.exitCode = 1;
  })
  .finally(() => w.state.close());
