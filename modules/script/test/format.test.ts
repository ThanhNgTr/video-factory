import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Format } from "@vf/contracts";
import { describe, expect, it } from "vitest";
import { checkLearnedFormat } from "../src/domain/format.ts";

const root = new URL("../../..", import.meta.url).pathname;
// a learned format also carries staging rules for the director (ADR 0024); the hand-written explainer has none
const explainer = Format.parse({
  ...JSON.parse(readFileSync(join(root, "library/formats/explainer.json"), "utf8")),
  staging: ["Push the camera on most narrator lines.", "A character walks or gestures in every other shot."],
});

describe("a format learned from a sample", () => {
  it("accepts a one-off genre the narrator can actually speak", () => {
    expect(checkLearnedFormat(explainer)).toEqual([]);
  });
  it("refuses series, impossible lengths and more words than fit", () => {
    const errs = checkLearnedFormat({
      ...explainer,
      kind: "series",
      lengthS: { min: 60, max: 40 },
      maxSpokenChars: 2000,
      rubric: [],
      staging: [],
    }).join("\n");
    expect(errs).toMatch(/one-off/);
    expect(errs).toMatch(/lengthS/);
    expect(errs).toMatch(/more than the narrator can say/);
    expect(errs).toMatch(/rubric/);
    expect(errs).toMatch(/staging/);
  });
});
