// Referential integrity a zod schema cannot express. Shared by the writer's repair loop and assets.check.
import { NARRATOR } from "./common.ts";
import { checkDiorama } from "./diorama.ts";
import { checkGraphic, iconsOf } from "./graphic.ts";
import type { Library } from "./library.ts";
import { type Camera, HELD, type Scene, type Shot } from "./scene.ts";
import type { Script } from "./script.ts";
import { walkBlocker } from "./set-geometry.ts";

export function checkScriptRefs(script: Script, lib: Library): string[] {
  const errs: string[] = [];
  const format = lib.formats[script.format];
  if (!format) errs.push(`unknown format "${script.format}"`);
  // a character the library lacks is fine when newCast describes it (it is designed before staging)
  const designed = new Set(script.newCast.map((c) => c.id));
  for (const id of script.cast)
    if (!lib.people[id] && !designed.has(id))
      errs.push(
        `cast: unknown character "${id}" (library has: ${Object.keys(lib.people).join(", ")}; or describe a new one in newCast)`,
      );
  for (const c of script.newCast) if (!script.cast.includes(c.id)) errs.push(`newCast: "${c.id}" is not in cast`);
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
    // the least the narrator must say to reach the format's minimum length, scaled from its own maximum
    // (about 7 s of every video is pauses and cards, not speech)
    const least = Math.round((format.maxSpokenChars * (format.lengthS.min - 7)) / Math.max(1, format.lengthS.max - 7));
    if (spoken < least)
      errs.push(
        `total spoken text is ${spoken} characters, at least ${least} for the format's ${format.lengthS.min}-second minimum: add a beat or lines`,
      );
    if (script.beats.length < format.beats.min || script.beats.length > format.beats.max)
      errs.push(`${script.beats.length} beats, format wants ${format.beats.min}-${format.beats.max}`);
    if (format.kind === "series" && !script.choice) errs.push("a series part must end with `choice` (option1/option2)");
    if (!format.hud && (script.hud || script.beats.some((b) => b.clock !== undefined || b.counter !== undefined)))
      errs.push("this format has no HUD: leave out hud and every beat's clock and counter");
  }
  if (script.beats[0]?.role !== "hook") errs.push("beats[0] must have role hook");
  return errs;
}

export function checkSceneRefs(scene: Scene, lib: Library): string[] {
  const errs: string[] = [];
  const ids = new Set<string>();
  // declaring an icon the library already has is harmless (assets.draw skips it): a run's own icons join the library
  const declared = new Set(scene.icons.map((i) => i.id));
  scene.shots.forEach((shot, i) => {
    const where = `shots[${i}] (${shot.id})`;
    if (ids.has(shot.id)) errs.push(`${where}: duplicate shot id`);
    ids.add(shot.id);
    if (shot.diorama) {
      // a diorama is its own 3D world: no set, no cast; the narrator speaks over it
      for (const e of checkDiorama(shot.diorama)) errs.push(`${where}: diorama ${e}`);
      if (shot.cast.length) errs.push(`${where}: a diorama shot has no cast`);
      if (shot.props.length) errs.push(`${where}: a diorama shot has no props`);
      if (shot.graphic || shot.inset) errs.push(`${where}: a diorama shot has no graphic or inset`);
      if (shot.line && shot.line.who !== NARRATOR) errs.push(`${where}: only the narrator speaks over a diorama`);
      return;
    }
    if (shot.graphic) {
      // a graphic fills the frame: no set, no characters; the narrator speaks over it
      for (const e of checkGraphic(shot.graphic)) errs.push(`${where}: graphic ${e}`);
      for (const id of iconsOf(shot.graphic))
        if (!lib.icons[id] && !declared.has(id))
          errs.push(`${where}: icon "${id}" is neither in the library nor declared in scene.icons (with a brief)`);
      if (shot.cast.length) errs.push(`${where}: a graphic shot has no cast (the graphic fills the frame)`);
      if (shot.props.length) errs.push(`${where}: a graphic shot has no props (the graphic fills the frame)`);
      if (shot.line && shot.line.who !== NARRATOR) errs.push(`${where}: only the narrator speaks over a graphic`);
      return;
    }
    if (!shot.set) {
      errs.push(`${where}: a shot without a graphic needs a set`);
      return;
    }
    if (shot.inset) {
      for (const e of checkGraphic(shot.inset)) errs.push(`${where}: inset ${e}`);
      for (const id of iconsOf(shot.inset))
        if (!lib.icons[id] && !declared.has(id))
          errs.push(
            `${where}: inset icon "${id}" is neither in the library nor declared in scene.icons (with a brief)`,
          );
    }
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
      if (m.holds && !(HELD as readonly string[]).includes(m.holds) && !lib.icons[m.holds] && !declared.has(m.holds))
        errs.push(
          `${where}: ${m.id} holds "${m.holds}", which is neither a built-in item (${HELD.join(", ")}) nor an icon in the library or declared in scene.icons`,
        );
      if (!lib.people[m.id]) errs.push(`${where}: unknown character "${m.id}"`);
      if (!lib.actions[m.action])
        errs.push(`${where}: unknown action "${m.action}" (library has: ${Object.keys(lib.actions).join(", ")})`);
      for (const sp of [m.spot, m.toSpot]) {
        if (sp !== undefined && !spots.has(sp))
          errs.push(`${where}: set "${shot.set}" has no spot "${sp}" (has: ${[...spots].join(", ")})`);
      }
      const posture = lib.actions[m.action]?.posture ?? "stand";
      if (posture === "sit" && !set.spots.find((sp) => sp.id === m.spot)?.seat)
        errs.push(
          `${where}: ${m.id} sits ("${m.action}") on "${m.spot}", which has no seat (seats in "${shot.set}": ${
            set.spots
              .filter((sp) => sp.seat)
              .map((sp) => sp.id)
              .join(", ") || "none: stand instead"
          })`,
        );
      if (posture !== "stand" && m.toSpot)
        errs.push(
          `${where}: ${m.id} walks while ${posture === "sit" ? "sitting" : "lying"}: walk standing, then sit or lie in the next shot`,
        );
      const from = set.spots.find((sp) => sp.id === m.spot)?.pos;
      const to = set.spots.find((sp) => sp.id === m.toSpot)?.pos;
      const blocker = from && to && walkBlocker(set, from, to);
      if (from && blocker) {
        const clear = set.spots.filter((sp) => sp.id !== m.spot && !walkBlocker(set, from, sp.pos)).map((sp) => sp.id);
        errs.push(
          `${where}: ${m.id} would walk through a ${blocker.type} from "${m.spot}" to "${m.toSpot}" (clear walks from "${m.spot}": ${clear.join(", ") || "none"})`,
        );
      }
      const other = taken.get(m.spot);
      if (other) errs.push(`${where}: ${m.id} and ${other} stand on the same spot "${m.spot}"`);
      taken.set(m.spot, m.id);
    }
    // story props stand on spots like the cast and are drawn from icons like a held item (ADR 0022)
    const propIds = new Set<string>();
    for (const pr of shot.props) {
      if (propIds.has(pr.id) || castIds.has(pr.id))
        errs.push(`${where}: prop id "${pr.id}" is already used in this shot: give every prop its own id`);
      propIds.add(pr.id);
      if (!lib.icons[pr.icon] && !declared.has(pr.icon))
        errs.push(
          `${where}: prop "${pr.id}" uses icon "${pr.icon}", which is neither in the library nor declared in scene.icons (with a brief)`,
        );
      if (!spots.has(pr.spot))
        errs.push(
          `${where}: set "${shot.set}" has no spot "${pr.spot}" for prop "${pr.id}" (has: ${[...spots].join(", ")})`,
        );
    }
    if (shot.focus && !castIds.has(shot.focus) && !propIds.has(shot.focus))
      errs.push(`${where}: focus "${shot.focus}" is neither in the cast nor a prop of this shot`);
    if (shot.line && shot.line.who !== NARRATOR && !castIds.has(shot.line.who))
      errs.push(`${where}: speaker "${shot.line.who}" is not in the cast`);
    for (const cue of shot.sfx)
      if (!lib.sfx[cue.id])
        errs.push(`${where}: unknown sfx "${cue.id}" (library has: ${Object.keys(lib.sfx).join(", ")})`);
    if ((shot.camera === "closeup" || shot.camera === "over-shoulder" || shot.camera === "insert") && !shot.focus)
      errs.push(`${where}: camera "${shot.camera}" needs a focus`);
    if (
      shot.camera === "insert" &&
      shot.focus &&
      castIds.has(shot.focus) &&
      !shot.cast.find((m) => m.id === shot.focus)?.holds
    )
      errs.push(
        `${where}: camera "insert" shows the item the focus holds: give ${shot.focus} a \`holds\`, or focus a prop`,
      );
  });
  return errs;
}

export const ROOM_SHOTS: ReadonlySet<Camera> = new Set<Camera>(["wide", "push", "pan", "shake"]);
// a shot that frames the whole room (and so shows everyone present); a graphic shot shows no room
export const isRoomShot = (s: Pick<Shot, "camera" | "graphic" | "diorama">): boolean =>
  !s.graphic && !s.diorama && ROOM_SHOTS.has(s.camera);

// The staging must carry the story exactly: same beats, same lines in the same order (a human edits script.json).
export function checkSceneMatchesScript(scene: Scene, script: Script): string[] {
  const errs: string[] = [];
  const beatIds = new Set(script.beats.map((b) => b.id));
  const covered = new Set(scene.shots.map((s) => s.beat));
  for (const s of scene.shots) if (!beatIds.has(s.beat)) errs.push(`shot ${s.id}: unknown beat "${s.beat}"`);
  for (const b of script.beats) if (!covered.has(b.id)) errs.push(`beat "${b.id}" has no shot`);
  // a shot that frames the whole room shows everyone the beat puts there, so nobody vanishes between shots
  for (const s of scene.shots) {
    if (!isRoomShot(s)) continue;
    const shown = new Set(s.cast.map((m) => m.id));
    const missing = script.beats.find((b) => b.id === s.beat)?.cast.filter((id) => !shown.has(id)) ?? [];
    if (missing.length)
      errs.push(
        `shot ${s.id} (${s.camera}) frames the room but leaves out ${missing.join(", ")}, who the beat "${s.beat}" puts there: add them (bystanders play idle on their usual spot)`,
      );
  }
  // one shot per line plus one per silent beat is the baseline; silent cutaways (an establishing shot, a prop, a
  // reaction) come on top, two plus one per three lines, so the episode keeps under its length cap
  const base = script.beats.reduce((n, b) => n + Math.max(1, b.lines.length), 0);
  const lines = script.beats.reduce((n, b) => n + b.lines.length, 0);
  const cap = base + 2 + Math.floor(lines / 3);
  if (scene.shots.length > cap)
    errs.push(
      `${scene.shots.length} shots for ${base} lines and silent beats: at most ${cap}. Keep the cutaways to the ones that change the picture most`,
    );
  const want = script.beats.flatMap((b) => b.lines.map((l) => `${l.who}: ${l.text}`));
  const got = scene.shots.flatMap((s) => (s.line ? [`${s.line.who}: ${s.line.text}`] : []));
  if (want.join("\n") !== got.join("\n")) {
    errs.push(
      `the shots' lines must be exactly the script's lines, in order (one line per shot, text unchanged). Expected ${want.length} lines:\n${want.join("\n")}`,
    );
  }
  return errs;
}
