// Contract test: every file in library/ and evals/fixtures parses against its schema.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Formula, Scene, Script } from "../src/index.ts";
import { lib } from "./fixtures.ts";

const fx = (n: string) =>
  JSON.parse(readFileSync(new URL(`../../../evals/fixtures/${n}.json`, import.meta.url), "utf8")) as unknown;

describe("library and fixtures", () => {
  it("library loads (every file parsed)", () => {
    expect(Object.keys(lib.people).length).toBeGreaterThan(0);
    expect(Object.keys(lib.sets).every((id) => lib.sets[id]?.spots.length)).toBe(true);
    expect(lib.formats.series).toBeDefined();
  });
  it("evals/fixtures parse", () => {
    expect(Script.safeParse(fx("script")).success).toBe(true);
    expect(Scene.safeParse(fx("scene")).success).toBe(true);
    expect(Formula.safeParse(fx("formula")).success).toBe(true);
  });
});
