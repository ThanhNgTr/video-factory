import { describe, expect, it } from "vitest";
import { keptSpans, parseSilences, planCuts, shiftWords } from "../src/domain/silence.ts";

const log = `[silencedetect @ 0x1] silence_start: 0
[silencedetect @ 0x1] silence_end: 0.3 | silence_duration: 0.3
[silencedetect @ 0x1] silence_start: 1.7
[silencedetect @ 0x1] silence_end: 2.7 | silence_duration: 1.0
[silencedetect @ 0x1] silence_start: 3.2`;

describe("silence", () => {
  it("parses a log whose last silence runs to the end of the file", () => {
    expect(parseSilences(log, 4.1)).toEqual([
      { start: 0, end: 0.3 },
      { start: 1.7, end: 2.7 },
      { start: 3.2, end: 4.1 },
    ]);
  });
  it("keeps a short lead, 0.4 s per pause and a short tail", () => {
    const cuts = planCuts(parseSilences(log, 4.1), 4.1);
    expect(cuts).toEqual([
      { start: 0, end: 0.15 },
      { start: 2.1, end: 2.7 },
      { start: 3.35, end: 4.1 },
    ]);
    expect(keptSpans(cuts, 4.1)).toEqual([
      { start: 0.15, end: 2.1 },
      { start: 2.7, end: 3.35 },
    ]);
    expect(planCuts([{ start: 1, end: 1.35 }], 3)).toEqual([]);
  });
  it("moves words up by the silence cut before them", () => {
    const cuts = planCuts(parseSilences(log, 4.1), 4.1);
    const words = shiftWords(
      [
        { text: "shift.", start: 1.2, end: 1.7 },
        { text: "Again.", start: 2.7, end: 3.2 },
      ],
      cuts,
    );
    expect(words[0]?.start).toBeCloseTo(1.05);
    expect(words[1]?.start).toBeCloseTo(1.95);
    expect(words[1]?.end).toBeCloseTo(2.45);
  });
});
