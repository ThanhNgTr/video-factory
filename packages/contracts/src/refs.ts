// Referential integrity a zod schema cannot express. Shared by the writer's repair loop and assets.check.
import { NARRATOR } from "./common.ts";
import type { Library } from "./library.ts";
import type { Scene } from "./scene.ts";
import type { Script } from "./script.ts";

export function checkScriptRefs(script: Script, lib: Library): string[] {
  const errs: string[] = [];
  const format = lib.formats[script.format];
  if (!format) errs.push(`unknown format "${script.format}"`);
  for (const id of script.cast)
    if (!lib.people[id])
      errs.push(`cast: unknown character "${id}" (library has: ${Object.keys(lib.people).join(", ")})`);
  const cast = new Set(script.cast);
  const ids = new Set<string>();
  let spoken = 0;
  script.beats.forEach((b, i) => {
    const where = `beats[${i}] (${b.id})`;
    if (ids.has(b.id)) errs.push(`${where}: duplicate beat id`);
    ids.add(b.id);
    for (const c of b.cast) if (!cast.has(c)) errs.push(`${where}: "${c}" is not in script.cast`);
    for (const l of b.lines) {
      spoken += l.text.length;
      if (l.who !== NARRATOR && !b.cast.includes(l.who))
        errs.push(`${where}: speaker "${l.who}" is not in this beat's cast`);
    }
  });
  if (format) {
    if (spoken > format.maxSpokenChars)
      errs.push(`total spoken text is ${spoken} characters, max ${format.maxSpokenChars}: cut lines`);
    if (script.beats.length < format.beats.min || script.beats.length > format.beats.max)
      errs.push(`${script.beats.length} beats, format wants ${format.beats.min}-${format.beats.max}`);
    if (format.kind === "series" && !script.choice) errs.push("a series part must end with `choice` (option1/option2)");
  }
  if (script.beats[0]?.role !== "hook") errs.push("beats[0] must have role hook");
  return errs;
}

export function checkSceneRefs(scene: Scene, lib: Library): string[] {
  const errs: string[] = [];
  const ids = new Set<string>();
  scene.shots.forEach((shot, i) => {
    const where = `shots[${i}] (${shot.id})`;
    if (ids.has(shot.id)) errs.push(`${where}: duplicate shot id`);
    ids.add(shot.id);
    const set = lib.sets[shot.set];
    if (!set) {
      errs.push(`${where}: unknown set "${shot.set}" (library has: ${Object.keys(lib.sets).join(", ")})`);
      return;
    }
    const spots = new Set(set.spots.map((s) => s.id));
    const taken = new Map<string, string>();
    const castIds = new Set<string>();
    for (const m of shot.cast) {
      castIds.add(m.id);
      if (!lib.people[m.id]) errs.push(`${where}: unknown character "${m.id}"`);
      if (!lib.actions[m.action])
        errs.push(`${where}: unknown action "${m.action}" (library has: ${Object.keys(lib.actions).join(", ")})`);
      for (const sp of [m.spot, m.toSpot]) {
        if (sp !== undefined && !spots.has(sp))
          errs.push(`${where}: set "${shot.set}" has no spot "${sp}" (has: ${[...spots].join(", ")})`);
      }
      const other = taken.get(m.spot);
      if (other) errs.push(`${where}: ${m.id} and ${other} stand on the same spot "${m.spot}"`);
      taken.set(m.spot, m.id);
    }
    if (shot.focus && !castIds.has(shot.focus)) errs.push(`${where}: focus "${shot.focus}" is not in the cast`);
    if (shot.line && shot.line.who !== NARRATOR && !castIds.has(shot.line.who))
      errs.push(`${where}: speaker "${shot.line.who}" is not in the cast`);
    for (const cue of shot.sfx)
      if (!lib.sfx[cue.id])
        errs.push(`${where}: unknown sfx "${cue.id}" (library has: ${Object.keys(lib.sfx).join(", ")})`);
    if ((shot.camera === "closeup" || shot.camera === "over-shoulder") && !shot.focus)
      errs.push(`${where}: camera "${shot.camera}" needs a focus`);
  });
  return errs;
}

// The staging must carry the story exactly: same beats, same lines in the same order (a human edits script.json).
export function checkSceneMatchesScript(scene: Scene, script: Script): string[] {
  const errs: string[] = [];
  const beatIds = new Set(script.beats.map((b) => b.id));
  const covered = new Set(scene.shots.map((s) => s.beat));
  for (const s of scene.shots) if (!beatIds.has(s.beat)) errs.push(`shot ${s.id}: unknown beat "${s.beat}"`);
  for (const b of script.beats) if (!covered.has(b.id)) errs.push(`beat "${b.id}" has no shot`);
  const want = script.beats.flatMap((b) => b.lines.map((l) => `${l.who}: ${l.text}`));
  const got = scene.shots.flatMap((s) => (s.line ? [`${s.line.who}: ${s.line.text}`] : []));
  if (want.join("\n") !== got.join("\n")) {
    errs.push(
      `the shots' lines must be exactly the script's lines, in order (one line per shot, text unchanged). Expected ${want.length} lines:\n${want.join("\n")}`,
    );
  }
  return errs;
}
