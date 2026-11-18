import type { Library, Script, SeriesBible } from "@vf/contracts";
import { describe, expect, it } from "vitest";
import { bibleContext, nextPart, stagingLibrary, updateBible } from "../src/domain/series.ts";

const script: Script = {
  schemaVersion: 1,
  format: "series",
  title: "The Night Desk - Part 2",
  part: 2,
  summary: "Sam opens the door. The Tall Guest is gone. Cliffhanger: 1 follow the footprints, 2 lock the desk.",
  mood: "horror",
  cast: ["night-clerk", "tall-guest"],
  newCast: [],
  beats: [
    { id: "b1", role: "hook", action: "x", cast: [], lines: [], tension: "calm", text: "RULE 4: *Never* look up" },
    { id: "b2", role: "cta", action: "y", cast: [], lines: [], tension: "scary" },
    { id: "b3", role: "cta", action: "y", cast: [], lines: [], tension: "scary" },
  ],
  choice: { option1: "follow", option2: "lock" },
  publish: { title: "t", description: "d", hashtags: ["#story"] },
};

describe("series bible", () => {
  it("starts a bible from the first part", () => {
    const b = updateBible(undefined, "night-desk", "f", { ...script, part: 1 }, "run-1");
    expect(nextPart(b)).toBe(2);
    expect(b.title).toBe("The Night Desk");
    expect(b.rules).toEqual(["RULE 4: Never look up"]);
    expect(b.parts[0]?.runId).toBe("run-1");
  });
  it("appends a part, records the vote and keeps earlier parts", () => {
    const b1: SeriesBible = updateBible(undefined, "night-desk", "f", { ...script, part: 1 }, "run-1");
    const b2 = updateBible(b1, "night-desk", "f", script, "run-2", "2");
    expect(b2.parts.map((p) => p.part)).toEqual([1, 2]);
    expect(b2.parts[0]?.audienceChoice).toBe("2");
    expect(b1.parts).toHaveLength(1);
    expect(bibleContext(b2, "1")).toMatch(/Part 2 "The Night Desk - Part 2"/);
    expect(bibleContext(b2, "1")).toMatch(/voted option 1/);
  });
  it("stages a series only in its own sets", () => {
    const bible = updateBible(undefined, "night-desk", "f", { ...script, part: 1 }, "run-1");
    const lib = {
      sets: { lobby: {}, diner: {} },
      series: { a: { ...bible, sets: ["diner"] }, b: bible },
    } as unknown as Library;
    expect(Object.keys(stagingLibrary(lib, "a").sets)).toEqual(["diner"]);
    expect(stagingLibrary(lib, "b")).toBe(lib);
    expect(stagingLibrary(lib)).toBe(lib);
  });
});
