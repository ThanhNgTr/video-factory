import { type Assets, checkSceneRefs, Scene } from "@vf/contracts";
import { StageError } from "@vf/core";
import { stage } from "@vf/pipeline";

// Verifies every reference in scene.json and inlines the parts the renderer needs.
export const assetsCheck = stage<unknown>({
  name: "assets.check",
  version: 1,
  inputs: ["scene.json"],
  outputs: ["assets.json"],
  run: async (ctx) => {
    const scene = ctx.store.readJson("scene.json", Scene);
    const errs = checkSceneRefs(scene, ctx.library);
    if (errs.length)
      throw new StageError("missing-reference", `scene.json has ${errs.length} bad reference(s)`, {
        details: { errs },
      });
    const pick = <T>(all: Record<string, T>, ids: Iterable<string>): Record<string, T> =>
      Object.fromEntries([...new Set(ids)].map((id) => [id, all[id] as T]));
    const assets: Assets = {
      schemaVersion: 1,
      people: pick(
        ctx.library.people,
        scene.shots.flatMap((s) => s.cast.map((m) => m.id)),
      ),
      actions: pick(
        ctx.library.actions,
        scene.shots.flatMap((s) => s.cast.map((m) => m.action)),
      ),
      sets: pick(
        ctx.library.sets,
        scene.shots.map((s) => s.set),
      ),
    };
    ctx.store.writeJson("assets.json", assets);
  },
});
