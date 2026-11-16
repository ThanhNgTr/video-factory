import { checkSceneMatchesScript, checkSceneRefs, Scene, Script } from "@vf/contracts";
import { askJson, fillPrompt, loadPrompt } from "@vf/core";
import { stage } from "@vf/pipeline";
import { describeActions, describeCast, describeSets } from "../domain/describe.ts";
import type { ScriptDeps } from "../ports.ts";

const PROMPT = loadPrompt(new URL("../../prompts/direct.md", import.meta.url).pathname);

// script.json (story, human-edited) -> scene.json (staging). Re-runs whenever script.json changes.
export const scriptDirect = stage<ScriptDeps>({
  name: "script.direct",
  version: PROMPT.version,
  inputs: ["script.json"],
  outputs: ["scene.json"],
  run: async (ctx) => {
    const script = ctx.store.readJson("script.json", Script);
    const system = fillPrompt(PROMPT, {
      sets: describeSets(ctx.library),
      actions: describeActions(ctx.library),
      cast: describeCast(ctx.library, script.cast),
      sfx: Object.keys(ctx.library.sfx).join(", "),
    });
    const user = `SCRIPT:\n${JSON.stringify(script, null, 1)}\n\nWrite scene.json: title, mood and hud copied from the script, music.mood = the script mood, and the shots.`;
    const scene = await askJson(
      ctx.deps.llm,
      { model: ctx.config.models.direct as "sonnet", system, user, schema: Scene, schemaName: "scene" },
      {
        check: (s) => [...checkSceneRefs(s, ctx.library), ...checkSceneMatchesScript(s, script)],
        onUsage: (u) => ctx.recordUsage(u),
      },
    );
    ctx.store.writeJson("scene.json", scene);
  },
});
