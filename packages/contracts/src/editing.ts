// Editing grammar a staged scene must keep (ADR 0025): the picture changes at every cut, a red scare stays a scare,
// the last third does not slacken. Pure; the director repairs what fails, like a bad reference.
import type { Scene } from "./scene.ts";

export function checkEditing(scene: Pick<Scene, "shots">): string[] {
  const errs: string[] = [];
  const shots = scene.shots;
  for (let i = 1; i < shots.length; i++) {
    const a = shots[i - 1];
    const b = shots[i];
    if (!a?.set || !b?.set) continue;
    if (a.set === b.set && a.camera === b.camera && (a.focus ?? "") === (b.focus ?? "") && a.angle === b.angle)
      errs.push(
        `shots ${a.id} and ${b.id} cut to the same picture (${b.camera} on ${b.focus ?? "the room"}, ${b.angle} angle): change the size, the angle or the subject at every cut`,
      );
  }
  let run = 0;
  for (const s of shots) {
    run = s.set && s.lighting === "red" ? run + 1 : 0;
    if (run === 4)
      errs.push(
        `four red shots in a row ending at ${s.id}: red is the scare, three shots at most, then the light comes back`,
      );
  }
  const red = shots.filter((s) => s.set && s.lighting === "red").length;
  if (red > Math.max(3, Math.ceil(shots.length / 4)))
    errs.push(`${red} of ${shots.length} shots are lit red: at most a quarter of the video`);
  // a showy move is one moment: repeated, it stops landing (ADR 0026)
  const limits: Record<string, number> = { "dolly-zoom": 2, "crash-zoom": 2, whip: 3 };
  for (const [k, max] of Object.entries(limits)) {
    const n = shots.filter((s) => s.move === k || s.transition === k).length;
    if (n > max) errs.push(`${n} shots use ${k}: at most ${max} in a video, keep it for the moment that needs it`);
  }
  // the climax: silent shots in the last third stay short (the final shot may hold)
  for (const s of shots.slice(Math.floor((2 * shots.length) / 3), -1))
    if (!s.line && s.dur > 2)
      errs.push(
        `${s.id}: a silent ${s.dur} s shot in the last third slackens the climax: 1-2 s there, or give it a line`,
      );
  return errs;
}
