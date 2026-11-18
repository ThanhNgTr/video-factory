// Library -> compact text for prompts. Pure.
import type { Library, Person } from "@vf/contracts";

export const describePerson = (p: Person): string => {
  const size = p.build.height < 0.85 ? ", child-sized" : p.build.height > 1.3 ? ", unnaturally tall" : "";
  const wear = p.wear.length ? `, wears ${p.wear.join("/")}` : "";
  const pattern = p.outfit.pattern !== "none" ? ` ${p.outfit.pattern}` : "";
  return `- ${p.id}: ${p.name} (${p.genre}${size}): ${p.outfit.top} ${p.outfit.topColor}${pattern}, ${p.hair.style} hair${wear}. ${p.personality}`;
};

export const describeCast = (lib: Library, ids?: readonly string[]): string =>
  Object.values(lib.people)
    .filter((p) => !ids || ids.includes(p.id))
    .map(describePerson)
    .join("\n");

export const describeSets = (lib: Library): string =>
  Object.values(lib.sets)
    .map(
      (s) =>
        `- ${s.id}: spots ${s.spots
          .map((sp) => `${sp.id}${sp.note ? ` (${sp.note})` : ""}${sp.seat ? ` [seat ${sp.seat} m]` : ""}`)
          .join("; ")}`,
    )
    .join("\n");

export const describeActions = (lib: Library): string =>
  Object.values(lib.actions)
    .map((a) => `${a.id} (${a.dur}s${a.loop ? ", loop" : ""}${a.posture !== "stand" ? `, ${a.posture}` : ""})`)
    .join(", ");

// icons the director may use without drawing new ones (ADR 0017)
export const describeIcons = (lib: Library): string =>
  Object.values(lib.icons)
    .map((i) => `${i.id} (${i.brief})`)
    .join("; ") || "(none yet: declare every icon you use in scene.icons)";
