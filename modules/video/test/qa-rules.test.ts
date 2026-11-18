import { describe, expect, it } from "vitest";
import { judge, parseBlackdetect, parseSilencedetect } from "../src/domain/qa-rules.ts";

describe("qa rules", () => {
  it("parses ffmpeg detectors", () => {
    expect(parseBlackdetect("[blackdetect] black_start:3.2 black_end:5.9 black_duration:2.7")).toEqual([
      { code: "black-frames", at: 3.2, detail: "2.7s of black from 3.2s" },
    ]);
    expect(parseBlackdetect("black_start:1 black_end:1.5 black_duration:0.5")).toEqual([]);
    expect(parseSilencedetect("silence_start: 10.0\nsilence_end: 18.5 | silence_duration: 8.5")).toHaveLength(1);
  });
  it("lets a video run a little under the minimum, never over the maximum", () => {
    const at = (seconds: number) =>
      judge({ seconds, expectedSeconds: seconds, issues: [], lengthRange: { min: 50, max: 68 } }).pass;
    expect([at(48.3), at(44), at(68), at(69)]).toEqual([true, false, true, false]);
  });
  it("fails on length mismatch, passes a clean video", () => {
    expect(judge({ seconds: 70, expectedSeconds: 70.1, issues: [], lengthRange: { min: 60, max: 110 } }).pass).toBe(
      true,
    );
    expect(
      judge({ seconds: 50, expectedSeconds: 70, issues: [], lengthRange: { min: 60, max: 110 } }).issues.map(
        (i) => i.code,
      ),
    ).toEqual(["length-mismatch", "length-out-of-range"]);
  });
});
