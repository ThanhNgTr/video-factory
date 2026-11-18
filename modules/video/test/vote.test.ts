import type { Scene } from "@vf/contracts";
import { describe, expect, it } from "vitest";
import { voteLabels, voteText } from "../src/domain/vote.ts";

const shot = (id: string, beat: string, text?: string) => ({ id, beat, ...(text ? { text } : {}) });

describe("the end card's vote", () => {
  it("takes the vote beat's card when its last shot has none", () => {
    const scene = { shots: [shot("s1", "b1", "HOOK"), shot("s2", "vote", "COMMENT *A* OR *B*"), shot("s3", "vote")] };
    expect(voteText(scene as unknown as Scene)).toBe("COMMENT *A* OR *B*");
    expect(voteText({ shots: [shot("s1", "b1", "HOOK"), shot("s2", "vote")] } as unknown as Scene)).toBeUndefined();
  });
  it("labels the options the way the script asks for them", () => {
    expect(voteLabels("COMMENT *A* OR *B*")).toEqual(["A", "B"]);
    expect(voteLabels("COMMENT *1* OR *2*?")).toEqual(["1", "2"]);
    expect(voteLabels(undefined)).toEqual(["1", "2"]);
  });
});
