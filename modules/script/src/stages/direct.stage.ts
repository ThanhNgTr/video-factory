import {
  checkEditing,
  checkSceneMatchesScript,
  checkSceneRefs,
  Designs,
  Scene,
  Script,
  withDesigns,
} from "@vf/contracts";
import { askJson, fillPrompt, loadPrompt } from "@vf/core";
import { stage } from "@vf/pipeline";
import { describeActions, describeCast, describeIcons, describeSets } from "../domain/describe.ts";
import { checkSceneLength } from "../domain/length.ts";
import { stagingLibrary } from "../domain/series.ts";
import type { ScriptDeps } from "../ports.ts";

const PROMPT = loadPrompt(new URL("../../prompts/direct.md", import.meta.url).pathname);

// script.json (story, human-edited) -> scene.json (staging). Re-runs whenever script.json changes.
export const scriptDirect = stage<ScriptDeps>({
  name: "script.direct",
  version: PROMPT.version,
  inputs: ["script.json", "designs.json"],
  outputs: ["scene.json"],
  run: async (ctx) => {
    const script = ctx.store.readJson("script.json", Script);
    const format = ctx.library.formats[script.format];
    // the library plus the characters and sets designed for this run (ADR 0018)
    const library = withDesigns(
      stagingLibrary(ctx.library, ctx.params.series),
      ctx.store.readJson("designs.json", Designs),
    );
    const system = fillPrompt(PROMPT, {
      sets: describeSets(library),
      actions: describeActions(ctx.library),
      cast: describeCast(library, script.cast),
      sfx: Object.keys(ctx.library.sfx).join(", "),
      icons: describeIcons(ctx.library),
      // learned from the sample's motion (ADR 0024); hand-written formats have none
      staging: format?.staging.map((r) => `- ${r}`).join("\n") || "(none: stage it as above)",
    });
    const user = `SCRIPT:\n${JSON.stringify(script, null, 1)}\n\nWrite scene.json: title, mood and hud copied from the script, music.mood = the script mood, and the shots.`;
    const scene = await askJson(
      ctx.deps.llm,
      { model: ctx.config.models.direct as "sonnet", system, user, schema: Scene, schemaName: "scene" },
      {
        check: (s) => [
          ...checkSceneRefs(s, library),
          ...checkSceneMatchesScript(s, script),
          ...checkEditing(s),
          ...(format ? checkSceneLength(s, format) : []),
        ],
        onUsage: (u) => ctx.recordUsage(u),
      },
    );
    ctx.store.writeJson("scene.json", scene);
  },
});
