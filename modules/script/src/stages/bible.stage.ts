import { Script } from "@vf/contracts";
import { stage } from "@vf/pipeline";
import { updateBible } from "../domain/series.ts";
import type { ScriptDeps } from "../ports.ts";

// Writes the series bible as it should look after this part. The CLI copies it into library/series when the run succeeds.
export const scriptBible = stage<ScriptDeps>({
  name: "script.bible",
  version: 1,
  inputs: ["script.json"],
  outputs: ["series-bible.json"],
  run: async (ctx) => {
    const script = ctx.store.readJson("script.json", Script);
    const id = ctx.params.series ?? ctx.runId;
    const prev = ctx.library.series[id];
    const choice = ctx.params.choice === "1" || ctx.params.choice === "2" ? ctx.params.choice : undefined;
    const formula = ctx.params.formula ?? prev?.formula ?? Object.keys(ctx.library.formulas)[0] ?? "unknown";
    ctx.store.writeJson("series-bible.json", updateBible(prev, id, formula, script, ctx.runId, choice));
  },
});
