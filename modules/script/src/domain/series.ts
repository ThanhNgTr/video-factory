// Series continuity helpers. Pure.
import type { Library, Script, SeriesBible } from "@vf/contracts";

export const nextPart = (bible: SeriesBible | undefined): number => (bible?.parts.length ?? 0) + 1;

// a series may limit its sets (a diner story must not be staged in the hotel hallway)
export function stagingLibrary(library: Library, series?: string): Library {
  const allowed = series ? library.series[series]?.sets : undefined;
  if (!allowed) return library;
  return { ...library, sets: Object.fromEntries(Object.entries(library.sets).filter(([id]) => allowed.includes(id))) };
}

// The bible as the writer of `part` must see it: only the parts before it (a rewrite of part 1 after part 1 was
// recorded must not read itself as history).
export const bibleBefore = (bible: SeriesBible | undefined, part: number | undefined): SeriesBible | undefined =>
  bible && part ? { ...bible, parts: bible.parts.filter((p) => p.part < part) } : bible;

export function bibleContext(bible: SeriesBible | undefined, audienceChoice?: string): string {
  if (!bible) return "This is a new series: establish the world, the viewer's role and the rules.";
  const parts = bible.parts
    .map(
      (p) =>
        `Part ${p.part} "${p.title}": ${p.summary}${p.audienceChoice ? ` (audience voted ${p.audienceChoice})` : ""}`,
    )
    .join("\n");
  const vote = audienceChoice
    ? `\nThe audience voted option ${audienceChoice} for the last cliffhanger: continue from that choice.`
    : "";
  return `Series "${bible.title}". World: ${bible.world}\nStanding rules: ${bible.rules.join(" | ")}\nRecurring cast ids: ${bible.cast.join(", ")}\nPrevious parts (keep continuity, open by briefly recalling the last cliffhanger):\n${parts}${vote}`;
}

// New or updated bible after a part is written. Does not mutate the input.
export function updateBible(
  bible: SeriesBible | undefined,
  id: string,
  formula: string,
  script: Script,
  runId: string,
  audienceChoice?: "1" | "2",
): SeriesBible {
  const part = script.part ?? nextPart(bible);
  const base: SeriesBible = bible ?? {
    schemaVersion: 1,
    id,
    title: script.title.replace(/\s*[-:]\s*part\s*\d+.*$/i, "").trim() || script.title,
    formula,
    world: script.summary.slice(0, 600),
    narratorVoice: script.narratorVoice ?? { id: "en-US-GuyNeural", pitch: "-4Hz", rate: "-5%" },
    cast: script.cast,
    rules: script.beats
      .flatMap((b) => (b.text && /^rule\s*\d/i.test(b.text) ? [b.text.replaceAll("*", "").slice(0, 120)] : []))
      .slice(0, 6),
    parts: [],
  };
  const parts = base.parts
    .map((p) => (p.part === part - 1 && audienceChoice ? { ...p, audienceChoice } : p))
    .filter((p) => p.part !== part);
  parts.push({ part, title: script.title, summary: script.summary, runId });
  return { ...base, cast: [...new Set([...base.cast, ...script.cast])], parts: parts.sort((a, b) => a.part - b.part) };
}
