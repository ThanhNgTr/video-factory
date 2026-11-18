import { describe, expect, it } from "vitest";
import { normalizeSpeech } from "../src/domain/normalize.ts";

describe("normalizeSpeech", () => {
  it("reads clock times and strips markup", () => {
    expect(normalizeSpeech("At *11:58 PM* the lights go out.")).toBe("At eleven fifty-eight P M the lights go out.");
    expect(normalizeSpeech("It is 3:00 AM.")).toBe("It is three o'clock A M.");
    expect(normalizeSpeech("12:07")).toBe("twelve oh seven");
  });
  it("reads hon as hun", () => {
    expect(normalizeSpeech("Same as *last night*, hon.")).toBe("Same as last night, hun.");
  });
  it("reads rule numbers and bare hours", () => {
    expect(normalizeSpeech("Rule #3 says: after 3 AM never leave.")).toBe(
      "Rule number three says: after three A M never leave.",
    );
  });
});
