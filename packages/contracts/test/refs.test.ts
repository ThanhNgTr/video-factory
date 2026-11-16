import { describe, expect, it } from "vitest";
import { checkSceneRefs as checkScene } from "../src/refs.ts";
import { lib, scene } from "./fixtures.ts";

describe("checkScene", () => {
  it("accepts a valid scene", () => expect(checkScene(scene, lib)).toEqual([]));
  it("reports unknown ids, bad spots and shared spots", () => {
    const bad = structuredClone(scene);
    const s0 = bad.shots[0];
    if (!s0) throw new Error("fixture");
    s0.cast.push({ id: "ghost", spot: "center-left", action: "idle" });
    s0.cast.push({ id: "night-clerk", spot: "center-left", toSpot: "nowhere", action: "fly" });
    const errs = checkScene(bad, lib);
    expect(errs.join("\n")).toMatch(/unknown character "ghost"/);
    expect(errs.join("\n")).toMatch(/no spot "nowhere"/);
    expect(errs.join("\n")).toMatch(/unknown action "fly"/);
    expect(errs.join("\n")).toMatch(/same spot "center-left"/);
  });
});
