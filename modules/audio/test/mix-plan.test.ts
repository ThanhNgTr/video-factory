import { describe, expect, it } from "vitest";
import { planMix } from "../src/domain/mix-plan.ts";

describe("planMix", () => {
  it("places speech and sfx with adelay, ducks music, normalises loudness", () => {
    const p = planMix({
      speech: [{ file: "a.mp3", startS: 1.5 }],
      sfx: [{ file: "thud.wav", startS: 4 }],
      music: { file: "m.wav", gainDb: -14 },
      totalS: 10,
      targetLufs: -14,
      truePeakDb: -1,
    });
    expect(p.inputs).toEqual(["a.mp3", "thud.wav", "m.wav"]);
    expect(p.filter).toContain("adelay=1500");
    expect(p.filter).toContain("adelay=4000");
    expect(p.filter).toContain("sidechaincompress");
    expect(p.filter).toContain("loudnorm=I=-14:TP=-1");
  });
  it("works with no speech, music or sfx", () => {
    const p = planMix({ speech: [], sfx: [], totalS: 3, targetLufs: -14, truePeakDb: -1 });
    expect(p.inputs).toEqual([]);
    expect(p.filter).toContain("anullsrc");
  });
});
