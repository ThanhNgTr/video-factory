import { describe, expect, it } from "vitest";
import { propState } from "../src/domain/prop-motion.ts";

describe("propState", () => {
  it("leaves a still prop alone", () =>
    expect(propState("still", 40, 30, 0, 1)).toEqual({ y: 0, rot: 0, scale: 1, opacity: 1 }));
  it("drops in from above at `at` and lands", () => {
    expect(propState("drop", 0, 30, 1, 1).opacity).toBe(0); // not there yet
    expect(propState("drop", 30, 30, 1, 1).y).toBeGreaterThan(2);
    expect(propState("drop", 90, 30, 1, 1).y).toBe(0);
  });
  it("sinks below the floor, vanishes to nothing, grows from nothing", () => {
    expect(propState("sink", 90, 30, 0, 1).y).toBeCloseTo(-0.6);
    expect(propState("vanish", 30, 30, 0, 1)).toMatchObject({ scale: 0, opacity: 0 });
    expect(propState("grow", 0, 30, 1, 1).scale).toBe(0);
    expect(propState("grow", 60, 30, 1, 1).scale).toBe(1);
  });
});
