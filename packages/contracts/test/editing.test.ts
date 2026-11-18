import { describe, expect, it } from "vitest";
import { checkEditing } from "../src/editing.ts";
import { Shot } from "../src/scene.ts";

const shot = (id: string, o: Record<string, unknown> = {}) =>
  Shot.parse({ id, beat: "b", set: "room", camera: "wide", cast: [], dur: 1.5, ...o });
const errs = (...shots: ReturnType<typeof shot>[]) => checkEditing({ shots }).join("\n");

describe("checkEditing", () => {
  it("refuses two cuts to the same picture, and lets a size, angle or subject change through", () => {
    expect(errs(shot("a"), shot("b"))).toMatch(/a and b cut to the same picture/);
    expect(errs(shot("a"), shot("b", { camera: "medium" }))).toBe("");
    expect(errs(shot("a"), shot("b", { angle: "low" }))).toBe("");
    expect(errs(shot("a", { camera: "closeup", focus: "x" }), shot("b", { camera: "closeup", focus: "y" }))).toBe("");
    expect(
      errs(shot("a"), shot("g", { set: undefined, graphic: { kind: "list", items: ["x", "y"] } }), shot("b")),
    ).toBe("");
  });
  it("keeps showy moves for a moment", () => {
    const cams = ["wide", "medium", "closeup"];
    const dz = (n: number) =>
      Array.from({ length: n }, (_, i) => shot(`d${i}`, { camera: cams[i % 3], move: "dolly-zoom" }));
    expect(errs(...dz(2))).toBe("");
    expect(errs(...dz(3))).toMatch(/3 shots use dolly-zoom/);
    const wh = Array.from({ length: 4 }, (_, i) => shot(`w${i}`, { camera: cams[i % 3], transition: "whip" }));
    expect(errs(...wh)).toMatch(/4 shots use whip/);
  });
  it("keeps red light to a scare", () => {
    const red = (id: string) => shot(id, { lighting: "red", camera: id });
    expect(errs(red("wide"), red("medium"), red("closeup"), red("push"))).toMatch(/four red shots in a row/);
    const many = ["wide", "medium", "closeup", "push", "pan", "insert", "shake", "wide"].map((c, i) =>
      shot(`s${i}`, {
        camera: c,
        lighting: i < 5 ? "red" : "normal",
        focus: c === "insert" || c === "closeup" ? "x" : undefined,
      }),
    );
    expect(errs(...many)).toMatch(/5 of 8 shots are lit red/);
  });
  it("keeps the last third tight", () => {
    const s = ["wide", "medium", "closeup", "wide", "medium", "closeup"].map((c, i) =>
      shot(`s${i}`, { camera: c, focus: c === "closeup" ? "x" : undefined, dur: i === 4 ? 3 : 1.5 }),
    );
    expect(errs(...s)).toMatch(/s4: a silent 3 s shot in the last third/);
  });
});
