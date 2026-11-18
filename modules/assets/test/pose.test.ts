import type { Action } from "@vf/contracts";
import { describe, expect, it } from "vitest";
import { REST, samplePose } from "../src/domain/pose.ts";

const walk: Action = {
  schemaVersion: 1,
  id: "walk",
  dur: 1,
  loop: true,
  posture: "stand",
  keys: [
    { t: 0, legL: 20, face: "happy" },
    { t: 0.5, legL: -20 },
    { t: 1, legL: 20 },
  ],
};

describe("samplePose", () => {
  it("returns REST without an action", () => expect(samplePose(undefined, 3)).toEqual(REST));
  it("interpolates between keys and carries missing values", () => {
    const p = samplePose(walk, 0.25);
    expect(p.legL).toBeCloseTo(0, 5);
    expect(p.armL).toBe(REST.armL);
    expect(p.face).toBe("happy");
  });
  it("loops", () => expect(samplePose(walk, 1.5).legL).toBeCloseTo(-20, 5));
  it("clamps a one-shot action at its end", () => expect(samplePose({ ...walk, loop: false }, 9).legL).toBe(20));
  it("keeps velocity continuous across a mid-swing key (no stall)", () => {
    const swing: Action = {
      ...walk,
      keys: [
        { t: 0, legL: 25 },
        { t: 0.25, legL: 0 },
        { t: 0.5, legL: -25 },
        { t: 0.75, legL: 0 },
        { t: 1, legL: 25 },
      ],
    };
    const d = 1e-3;
    const v = (t: number) => (samplePose(swing, t + d).legL - samplePose(swing, t - d).legL) / (2 * d);
    expect(v(0.25 - d)).toBeCloseTo(v(0.25 + d), 0);
    expect(Math.abs(v(0.25))).toBeGreaterThan(50);
  });
});
