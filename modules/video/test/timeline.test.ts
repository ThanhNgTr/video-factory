import type { Audio, Diorama, Scene } from "@vf/contracts";
import { describe, expect, it } from "vitest";
import { buildTimeline, captionChunks, JCUT_FRAMES, SPEECH_LEAD_FRAMES } from "../src/domain/timeline.ts";

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
      props: [],
      clock: "1:00 AM",
    },
    { id: "s2", beat: "b2", set: "x", camera: "wide", cast: [], dur: 2, lighting: "normal", sfx: [], props: [] },
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
  it("chunks captions into 3 words, joining a leftover single word to the chunk before", () => {
    const ch = captionChunks(tl.captions, () => 76);
    expect(ch.map((c) => c.words.map((w) => w.text).join(" "))).toEqual(["Never say your name."]);
    expect(ch[0]?.from).toBe(SPEECH_LEAD_FRAMES);
    expect(ch[0]?.to).toBe(76);
    const cap = (i: number, text: string, shot = "s1") => ({ shot, frame: i * 10, text, highlight: false });
    const two = captionChunks(
      [
        cap(0, "Two"),
        cap(1, "AM's"),
        cap(2, "coming,"),
        cap(3, "hon."),
        cap(4, "Read"),
        cap(5, "the"),
        cap(6, "back."),
        cap(7, "Yes.", "s2"),
      ],
      () => 100,
    );
    expect(two.map((c) => c.words.map((w) => w.text).join(" "))).toEqual([
      "Two AM's coming, hon.",
      "Read the back.",
      "Yes.",
    ]);
    expect(two[0]?.to).toBe(40);
    // a punch word after a full stop or a long pause stays its own beat
    const beat = captionChunks([cap(0, "Your"), cap(1, "first"), cap(2, "shift."), cap(5, "Again.")], () => 100);
    expect(beat.map((c) => c.words.map((w) => w.text).join(" "))).toEqual(["Your first shift.", "Again."]);
    const paused = captionChunks([cap(0, "One"), cap(1, "customer,"), cap(4, "Hank.")], () => 100);
    expect(paused.map((c) => c.words.map((w) => w.text).join(" "))).toEqual(["One customer,", "Hank."]);
  });
});

describe("sound cues", () => {
  it("land on the graphic's parts: a pop per list item, a thud per new layer, ticks for a count", async () => {
    const { graphicCues, LIST_SHARE, START } = await import("../src/domain/graphic-timing.ts");
    const list = graphicCues({ kind: "list", items: ["a", "b", "c"] }, 90);
    expect(list.map((c) => c.frame)).toEqual([START, START + 18, START + 36]);
    expect(list[1]?.frame).toBe(Math.round(START + (90 * LIST_SHARE) / 3));
    const layers = graphicCues(
      {
        kind: "layers",
        layers: [
          { label: "a", thick: 1 },
          { label: "b", thick: 1 },
        ],
        reveal: 1,
      },
      90,
    );
    expect(layers.map((c) => c.id)).toEqual(["thud"]); // only the layer that drops in
    expect(graphicCues({ kind: "count", from: 1, to: 9 }, 90)).toEqual([{ frame: START, id: "ticks" }]);
  });
  it("thud as each layer a diorama lays starts to drop, one after another", async () => {
    const { dioramaDrops, START } = await import("../src/domain/graphic-timing.ts");
    const drops = dioramaDrops(road(["soil", "stones", "stones"], 1), 120);
    // only the two new layers, 35% of 120 frames split in two
    expect(drops).toEqual([
      { i: 1, frame: START + 2 },
      { i: 2, frame: START + 2 + 21 },
    ]);
  });
  it("finds a diorama's new layers by comparing with the last diorama shot, wherever they go in the stack", async () => {
    const { freshLayers } = await import("../src/domain/graphic-timing.ts");
    const prev = road(["soil", "stones", "crushed-rock"]);
    expect(freshLayers(road(["soil", "gravel", "stones", "crushed-rock"]), prev)).toEqual([1]); // slipped in under
    expect(freshLayers(road(["soil", "stones", "crushed-rock", "asphalt"]), prev)).toEqual([3]); // laid on top
    expect(freshLayers(road(["soil", "crushed-rock"]), road(["soil", "logs"]))).toEqual([1]); // replaced
    expect(freshLayers(prev, prev)).toEqual([]); // the same state carried on: nothing drops again
  });
});

function road(materials: Diorama["layers"][number]["material"][], reveal = 0): Diorama {
  return {
    layers: materials.map((material) => ({ material, thick: 0.4 })),
    reveal,
    surface: "dirt",
    pieces: [],
    weather: "clear",
    vehicle: "none",
    view: "road",
  };
}

describe("J-cuts", () => {
  it("holds the picture before while the new line already starts", () => {
    const line = (id: string, jcut = false) =>
      ({
        id,
        beat: id,
        set: "x",
        camera: "wide",
        cast: [],
        line: { who: "narrator", text: "Hi there." },
        dur: 1,
        lighting: "normal",
        sfx: [],
        props: [],
        jcut,
      }) as const;
    const sc = { schemaVersion: 1, title: "t", mood: "night", shots: [line("a"), line("b", true)] } as unknown as Scene;
    const au = {
      schemaVersion: 1,
      clips: ["a", "b"].map((shot) => ({ shot, who: "narrator", seconds: 1, words: [] })),
    } as unknown as Audio;
    const plain = buildTimeline({ ...sc, shots: [line("a"), line("b")] } as unknown as Scene, au, {
      fps: 30,
      width: 1080,
      height: 1920,
    });
    const tl = buildTimeline(sc, au, { fps: 30, width: 1080, height: 1920 });
    const [a, b] = tl.shots;
    if (!a || !b || !plain.shots[0]) throw new Error("rows");
    expect(a.frames).toBe(plain.shots[0].frames + JCUT_FRAMES); // the picture before holds longer
    expect(b.from).toBe(a.from + a.frames);
    expect(b.speechFrom).toBe(b.from - JCUT_FRAMES + SPEECH_LEAD_FRAMES); // the voice starts before the cut
    expect(b.speechFrom).toBeLessThan(b.from);
  });
});
