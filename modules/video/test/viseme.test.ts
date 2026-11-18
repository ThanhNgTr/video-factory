import type { Caption } from "@vf/contracts";
import { describe, expect, it } from "vitest";
import { mouthAt } from "../src/domain/viseme.ts";

const words: Caption[] = [
  { shot: "s1", frame: 10, text: "Mom", highlight: false },
  { shot: "s1", frame: 30, text: "ate", highlight: true },
  { shot: "s2", frame: 60, text: "Boo", highlight: false },
];

describe("mouthAt", () => {
  it("is silent outside words and in other shots", () => {
    expect(mouthAt(words, 5, "s1")).toBeNull();
    expect(mouthAt(words, 60, "s1")).toBeNull();
  });
  it("closes the lips on m and opens wide on a", () => {
    expect(mouthAt(words, 10, "s1")?.open).toBeLessThan(0.1);
    expect(mouthAt(words, 30, "s1")?.open).toBeGreaterThan(0.7);
  });
  it("rounds the mouth on o and rests before the next word", () => {
    expect(mouthAt(words, 63, "s2")?.wide).toBeLessThan(0.8);
    expect(mouthAt(words, 29, "s1")?.open).toBeLessThan(0.1);
  });
});
