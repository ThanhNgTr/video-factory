import type { Scene } from "@vf/contracts";
import { describe, expect, it } from "vitest";
import { checkSceneLength, sceneSeconds } from "../src/domain/length.ts";

const shot = (dur: number, text?: string) => ({ dur, ...(text ? { line: { who: "narrator", text } } : {}) });
const scene = (...shots: ReturnType<typeof shot>[]) => ({ shots }) as unknown as Scene;

describe("scene length before the voice exists", () => {
  it("counts a spoken shot as its line or its dur, whichever is longer, and a silent shot as its dur", () => {
    // 28 characters at 14 a second + 0.55 s of padding = 2.55 s; the 1 s dur is stretched by the voice
    expect(sceneSeconds(scene(shot(1, "*Twenty-eight* characters, ok!"), shot(1.5)))).toBeCloseTo(4.05);
    expect(sceneSeconds(scene(shot(4, "No *Ava*.")))).toBe(4); // dead air past the line still counts
  });
  it("holds the director to the format's maximum", () => {
    const long = scene(...Array.from({ length: 25 }, () => shot(3.5, "No *Ava*.")));
    expect(checkSceneLength(long, { lengthS: { min: 60, max: 80 } }).join()).toMatch(/about 88 s, .* at most 80 s/);
    expect(checkSceneLength(scene(shot(3, "x")), { lengthS: { min: 60, max: 80 } })).toEqual([]);
  });
});
