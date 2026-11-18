// The script critic's rules: which criteria apply, when a script passes, which draft to keep. Pure.
import type { Format } from "@vf/contracts";

// criteria every short shares; a format adds its own rubric on top (library/formats/*.json)
export const UNIVERSAL = [
  "hook",
  "one-idea",
  "open-loop",
  "no-dead-air",
  "visual",
  "escalation",
  "payoff",
  "speakable",
  "muted-clarity",
  "original",
  "fresh",
] as const;
export const PASS_SCORE = 7;
export const MAX_REWRITES = 2;

// what the critic answers (parsed with zod at the boundary, in script.write)
export type Critique = {
  criteria: { id: string; pass: boolean; note: string }[];
  score: number;
  summary: string;
  fixes: string;
};

export const criteriaFor = (format: Format): { id: string; must: boolean }[] => [
  ...UNIVERSAL.map((id) => ({ id, must: true })),
  ...format.rubric.map((r) => ({ id: r.id, must: r.must })),
];

export const describeRubric = (format: Format): string =>
  format.rubric.length
    ? format.rubric.map((r) => `- ${r.id}${r.must ? "" : " (nice to have)"}: ${r.check}`).join("\n")
    : "- (no extra criteria for this format)";

// the critic must judge every criterion, or its answer goes back for repair
export const missingCriteria = (c: Critique, format: Format): string[] =>
  criteriaFor(format)
    .filter((k) => !c.criteria.some((x) => x.id === k.id))
    .map((k) => `criterion "${k.id}" was not judged: add it to criteria`);

export const passes = (c: Critique, format: Format): boolean =>
  c.score >= PASS_SCORE &&
  criteriaFor(format)
    .filter((k) => k.must)
    .every((k) => c.criteria.find((x) => x.id === k.id)?.pass === true);

// a passing draft beats a failing one; between equals, the higher score
export const better = (a: Critique, b: Critique, format: Format): boolean => {
  const pa = passes(a, format);
  const pb = passes(b, format);
  return pa !== pb ? pa : a.score > b.score;
};
