// Loads library/ once at the composition root. A broken file fails loudly with its path (trust boundary: parse).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Action, Format, Formula, type Library, Person, SeriesBible, Set3D } from "@vf/contracts";
import { z } from "zod";
import { StageError } from "./errors.ts";

const MusicMeta = z.object({
  id: z.string(),
  file: z.string(),
  mood: z.array(z.string()),
  seconds: z.number(),
  license: z.string(),
});
const SfxMeta = z.object({ id: z.string(), file: z.string(), seconds: z.number(), license: z.string() });

function loadDir<T extends { id: string }>(root: string, dir: string, schema: z.ZodType<T>): Record<string, T> {
  const out: Record<string, T> = {};
  const path = join(root, dir);
  if (!existsSync(path)) return out;
  for (const f of readdirSync(path)
    .filter((f) => f.endsWith(".json"))
    .sort()) {
    const r = schema.safeParse(JSON.parse(readFileSync(join(path, f), "utf8")));
    if (!r.success) {
      throw new StageError(
        "invalid-output",
        `library/${dir}/${f}: ${r.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`,
      );
    }
    out[r.data.id] = r.data;
  }
  return out;
}

export function loadLibrary(root: string): Library {
  return {
    people: loadDir(root, "people", Person),
    actions: loadDir(root, "actions", Action),
    sets: loadDir(root, "sets", Set3D),
    formulas: loadDir(root, "formulas", Formula),
    formats: loadDir(root, "formats", Format),
    series: loadDir(root, "series", SeriesBible),
    music: loadDir(root, "music", MusicMeta),
    sfx: loadDir(root, "sfx", SfxMeta),
  };
}
