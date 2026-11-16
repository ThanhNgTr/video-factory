import type { Audio, Scene } from "@vf/contracts";
import { describe, expect, it } from "vitest";
import { buildTimeline, captionChunks, SPEECH_LEAD_FRAMES } from "../src/domain/timeline.ts";

const scene = {
  schemaVersion: 1,
  title: "t",
  mood: "horror",
  shots: [
    {
      id: "s1",
      beat: "b1",
      set: "x",
      camera: "wide",
      cast: [],
      line: { who: "narrator", text: "Never *say your* name." },
      dur: 1,
      lighting: "normal",
      sfx: [],
      clock: "1:00 AM",
    },
    { id: "s2", beat: "b2", set: "x", camera: "wide", cast: [], dur: 2, lighting: "normal", sfx: [] },
  ],
} as unknown as Scene;
const audio: Audio = {
  schemaVersion: 1,
  clips: [
    {
      shot: "s1",
      who: "narrator",
      text: "Never *say your* name.",
      file: "audio/s1.mp3",
      seconds: 2,
      words: [
        { text: "Never", start: 0, end: 0.4 },
        { text: "*say", start: 0.5, end: 0.8 },
        { text: "your*", start: 0.9, end: 1.2 },
        { text: "name.", start: 1.3, end: 1.9 },
      ],
    },
  ],
};

describe("buildTimeline", () => {
  const tl = buildTimeline(scene, audio, { fps: 30, width: 1080, height: 1920 });
  it("extends a shot to fit its speech and carries the HUD forward", () => {
    expect(tl.shots[0]?.frames).toBe(SPEECH_LEAD_FRAMES + 60 + 10);
    expect(tl.shots[0]?.speechFrom).toBe(SPEECH_LEAD_FRAMES);
    expect(tl.shots[1]?.from).toBe(76);
    expect(tl.shots[1]?.clock).toBe("1:00 AM");
    expect(tl.totalFrames).toBe(136);
  });
  it("marks highlighted words and strips the markup", () => {
    expect(tl.captions.map((c) => [c.text, c.highlight])).toEqual([
      ["Never", false],
      ["say", true],
      ["your", true],
      ["name.", false],
    ]);
    expect(tl.captions[1]?.frame).toBe(SPEECH_LEAD_FRAMES + 15);
  });
  it("chunks captions into at most 3 words with correct windows", () => {
    const ch = captionChunks(tl.captions, () => 76);
    expect(ch.map((c) => c.words.map((w) => w.text).join(" "))).toEqual(["Never say your", "name."]);
    expect(ch[0]?.to).toBe(ch[1]?.from);
    expect(ch[1]?.to).toBe(76);
  });
});
