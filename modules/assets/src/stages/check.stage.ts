import { type Assets, checkSceneRefs, Designs, DrawnIcons, iconsOf, Scene, withDesigns } from "@vf/contracts";
import { StageError } from "@vf/core";
import { stage } from "@vf/pipeline";

// Verifies every reference in scene.json and inlines the parts the renderer needs.
export const assetsCheck = stage<unknown>({
  name: "assets.check",
  version: 2, // + story props' icons (ADR 0022)
  inputs: ["scene.json", "icons.json", "designs.json"],
  outputs: ["assets.json"],
  // the library parts it inlines: a changed character, action or set reaches the render of existing runs
  fingerprint: (ctx) => [ctx.library.people, ctx.library.actions, ctx.library.sets, ctx.library.icons],
  run: async (ctx) => {
    const scene = ctx.store.readJson("scene.json", Scene);
    const drawn = ctx.store.readJson("icons.json", DrawnIcons);
    const library = withDesigns(ctx.library, ctx.store.readJson("designs.json", Designs));
    const errs = checkSceneRefs(scene, library);
    if (errs.length)
      throw new StageError("missing-reference", `scene.json has ${errs.length} bad reference(s)`, {
        details: { errs },
      });
    const pick = <T>(all: Record<string, T>, ids: Iterable<string>): Record<string, T> =>
      Object.fromEntries([...new Set(ids)].map((id) => [id, all[id] as T]));
    const assets: Assets = {
      schemaVersion: 1,
      people: pick(
        library.people,
        scene.shots.flatMap((s) => s.cast.map((m) => m.id)),
      ),
      actions: pick(
        ctx.library.actions,
        scene.shots.flatMap((s) => s.cast.map((m) => m.action)),
      ),
      sets: pick(
        library.sets,
        scene.shots.flatMap((s) => (s.set ? [s.set] : [])),
      ),
      // library icons and the ones drawn for this run; an icon that never passed the gate is left out
      icons: Object.fromEntries(
        [
          ...new Set(
            scene.shots.flatMap((s) => [
              ...(s.graphic ? iconsOf(s.graphic) : []),
              ...(s.inset ? iconsOf(s.inset) : []),
              ...s.cast.flatMap((m) => (m.holds ? [m.holds] : [])),
              ...s.props.map((pr) => pr.icon),
            ]),
          ),
        ].flatMap((id) => {
          const icon = ctx.library.icons[id] ?? drawn.icons[id];
          return icon ? [[id, icon]] : [];
        }),
      ),
    };
    ctx.store.writeJson("assets.json", assets);
  },
});
