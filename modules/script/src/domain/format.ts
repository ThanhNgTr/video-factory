// A format learned from a sample video (ADR 0017). Pure.
import type { Format } from "@vf/contracts";

// what a learned format must satisfy beyond its schema: a one-off genre the writer can actually hit
export function checkLearnedFormat(f: Format): string[] {
  const errs: string[] = [];
  if (f.kind === "series") errs.push('kind must be "explainer" or "skit": a learned format makes one-off videos');
  if (f.lengthS.min >= f.lengthS.max || f.lengthS.max > 180) errs.push("lengthS: min below max, max at most 180");
  if (f.beats.min > f.beats.max) errs.push("beats: min at most max");
  if (f.maxSpokenChars > 13 * (f.lengthS.max - 7) + 20)
    errs.push(
      `maxSpokenChars ${f.maxSpokenChars} is more than the narrator can say in ${f.lengthS.max} s (about 13 per second)`,
    );
  if (f.rubric.length < 3) errs.push("rubric: at least 3 genre criteria");
  if (f.staging.length < 2) errs.push("staging: at least 2 rules for the director, from the sample's measured motion");
  return errs;
}
