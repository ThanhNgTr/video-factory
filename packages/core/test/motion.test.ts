import { describe, expect, it } from "vitest";
import { describeMotion, measureMotion, pickStrips } from "../src/motion.ts";

const W = 72;
const H = 128;
const FPS = 6;
// a textured picture: deterministic noise, so every cell has edges a move would show
const noise = (seed: number) => {
  const px = new Uint8Array(W * H);
  let s = seed;
  for (let i = 0; i < px.length; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    px[i] = s >>> 24;
  }
  return px;
};
const video = (frames: Uint8Array[]) => {
  const raw = new Uint8Array(frames.length * W * H);
  frames.forEach((f, i) => {
    raw.set(f, i * W * H);
  });
  return measureMotion(raw, W, H, FPS);
};
const kinds = (m: ReturnType<typeof video>) => m.seconds.map((s) => s.kind);

describe("measureMotion", () => {
  const bg = noise(1);
  it("calls a picture that never changes still", () => {
    expect(kinds(video(Array.from({ length: 12 }, () => bg)))).toEqual(["still", "still"]);
  });
  it("calls a picture sliding as a whole a camera move", () => {
    const shift = (k: number) => bg.map((_, i) => bg[(i - k + bg.length) % bg.length] ?? 0);
    expect(kinds(video(Array.from({ length: 12 }, (_, k) => shift(2 * k))))).toEqual(["camera", "camera"]);
  });
  it("calls one thing moving over a still background a subject, and says where", () => {
    const block = noise(7);
    const frames = Array.from({ length: 12 }, (_, k) => {
      const f = bg.slice();
      for (let y = 96; y < 112; y++) for (let x = 0; x < 16; x++) f[y * W + 8 + x + k] = block[y * W + x] ?? 0;
      return f;
    });
    const m = video(frames);
    expect(kinds(m)).toEqual(["subject", "subject"]);
    expect(m.seconds[0]?.where).toBe("lower left");
  });
  it("finds a hard cut, and never puts a filmstrip across it", () => {
    const other = noise(99);
    const m = video([...Array.from({ length: 9 }, () => bg), ...Array.from({ length: 15 }, () => other)]);
    expect(m.cuts).toEqual([1.5]);
    expect(kinds(m)).toEqual(["still", "cut", "still", "still"]);
    expect(describeMotion(m)).toMatch(/1 hard cuts/);
    m.seconds[0] = { t: 0, kind: "subject", moving: 0.5, where: "middle center" };
    expect(pickStrips(m)).toEqual([]); // second 0's window would run into the cut
  });
});

describe("pickStrips", () => {
  it("takes two acting windows and one camera move, skipping a window that overlaps one taken", () => {
    const s = (t: number, kind: "subject" | "camera", moving: number) => ({ t, kind, moving });
    const m = {
      fps: FPS,
      cuts: [],
      strips: [],
      seconds: [s(0, "subject", 0.9), s(1, "subject", 0.8), s(2, "camera", 0.1), s(3, "camera", 0.1)]
        .concat([s(4, "subject", 0.5), s(5, "camera", 0.2), s(6, "camera", 0.9), s(7, "camera", 0.3)])
        .concat([s(8, "camera", 0.1)]),
    };
    expect(pickStrips(m).map((x) => `${x.from}:${x.kind}`)).toEqual(["0:subject", "4:subject", "6:camera"]);
  });
});
