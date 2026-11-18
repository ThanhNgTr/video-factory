import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  checkSetDesign,
  exitPoint,
  foreground,
  obstacles,
  Set3D,
  segmentHitsBox,
  sightBlocked,
  walkBlocker,
} from "../src/index.ts";

const set = {
  props: [
    { type: "counter", pos: [0, 0, -2.6], size: [5, 1.05, 0.8], rotY: 0 },
    { type: "cylinder", pos: [0.6, 0, -1.9], size: [0.18, 0.75, 0], rotY: 0 },
    { type: "sofa", pos: [-4.4, 0, 0.4], size: [1.6, 0.9, 0.8], rotY: 90 },
    { type: "door", pos: [4.95, 0, -3.4], rotY: -90 },
  ],
} as unknown as Set3D;

describe("set geometry", () => {
  it("boxes floor props, turning rotated ones, and skips wall props", () => {
    const o = obstacles(set);
    expect(o.map((b) => b.type)).toEqual(["counter", "cylinder", "sofa"]);
    expect(o[2]?.max[0]).toBeCloseTo(-4.0); // the sofa turned 90 degrees is 0.8 wide in x
    expect(o[2]?.max[2]).toBeCloseTo(1.2);
  });
  it("leaves the stool in front of the cook out of her close shot, but keeps her counter and his own stool", () => {
    const medium = foreground(set, [0, -3.3], [0, 0.9]); // the cook behind the counter
    expect(medium).toContain(1);
    expect(medium).not.toContain(0);
    expect(foreground(set, [0.9, -1.6], [4.1, -1.6])).toEqual([]); // a guest by the stool, filmed from his right
    expect(foreground(set, [0, -3.3], [0, -0.8], 2)).not.toContain(1); // a larger keep distance keeps the stool
  });
  it("leads someone leaving through the nearest door and out past its wall", () => {
    const room = { ...set, room: { w: 10, h: 3.2, front: 8, back: -5 } } as Set3D;
    expect(exitPoint(room, [3.9, -2.6])).toEqual({ door: [4.95, -3.4], out: [5.7, -3.4] }); // the right wall's door
    expect(exitPoint(room, [0, 0.6])).toBeUndefined(); // no door within reach
  });
  it("clips segments against boxes", () => {
    expect(segmentHitsBox([0, 0], [2, 2], [0.9, 0.9], [1.1, 1.1])).toBe(true);
    expect(segmentHitsBox([0, 0], [2, 0], [0.9, 0.5], [1.1, 1])).toBe(false);
  });
  it("finds the counter end and the stools in a diagonal walk, not in a clear one", () => {
    expect(walkBlocker(set, [3.9, -2.6], [-1.2, -1.5])?.type).toBe("counter");
    expect(walkBlocker(set, [3.9, -2.6], [1, 0.6])).toBeUndefined();
    expect(walkBlocker(set, [0, -3.3], [2, -3.3])).toBeUndefined(); // standing against the counter is fine
  });
  it("sees a face over the counter but not through it", () => {
    const boxes = obstacles(set);
    expect(sightBlocked(boxes, [-0.3, 0.8, -2.5], [3.9, 1, -2.6])).toBe(true);
    expect(sightBlocked(boxes, [3.9, 1, 1.6], [3.9, 1, -2.6])).toBe(false);
    expect(sightBlocked(boxes, [0, 1.6, 1], [0, 1.6, -3.3])).toBe(false); // the cook's head above the counter
  });
  it("checks a designed set: library sets pass, a stranded or buried spot does not", () => {
    const dir = new URL("../../../library/sets/", import.meta.url).pathname;
    for (const f of readdirSync(dir)) {
      const lib = Set3D.parse(JSON.parse(readFileSync(dir + f, "utf8")));
      if (lib.id.startsWith("hotel-hallway")) continue; // a corridor: narrower than a room on purpose
      expect([f, checkSetDesign(lib)]).toEqual([f, []]);
    }
    const diner = Set3D.parse(JSON.parse(readFileSync(`${dir}roadside-diner.json`, "utf8")));
    const broken = {
      ...diner,
      spots: [...diner.spots, { id: "in-counter", pos: [0, -2.6] as [number, number], facing: "camera" as const }],
    };
    expect(checkSetDesign(broken).join()).toMatch(/in-counter" stands inside or against a counter/);
  });
});
