import { loadLibrary } from "@vf/core";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { REST } from "../src/domain/pose.ts";
import { characterGeometry } from "../src/render/Character.tsx";
import { bodyLift, flatGeometry } from "../src/render/Character2D.tsx";

describe("flatGeometry", () => {
  it("bakes a top-left to bottom-right gradient into vertex colours and caches by parameters", () => {
    const make = () => {
      const s = new THREE.Shape();
      s.moveTo(0, 0);
      s.lineTo(1, 0);
      s.lineTo(1, 1);
      s.lineTo(0, 1);
      return s;
    };
    const g = flatGeometry("square", make, "#808080", 0.4);
    const pos = g.getAttribute("position");
    const col = g.getAttribute("color");
    const at = (x: number, y: number) => {
      for (let i = 0; i < pos.count; i++) if (pos.getX(i) === x && pos.getY(i) === y) return col.getX(i);
      throw new Error(`no vertex at ${x},${y}`);
    };
    expect(at(0, 1)).toBeGreaterThan(at(1, 0)); // top-left lighter than bottom-right
    expect(flatGeometry("square", make, "#808080", 0.4)).toBe(g);
    expect(flatGeometry("square", make, "#808080", 0.2)).not.toBe(g);
  });
});

describe("bodyLift", () => {
  const person = loadLibrary(new URL("../../../library", import.meta.url).pathname).people.trucker;
  if (!person) throw new Error("fixture");
  const g = characterGeometry(person);
  it("keeps a standing body where it is", () => {
    expect(bodyLift(person, REST)).toBeCloseTo(0);
  });
  it("lowers a kneeling body by a shin so the knees are on the floor", () => {
    expect(bodyLift(person, { ...REST, kneeL: 90, kneeR: 90 })).toBeCloseTo(-g.legLen / 2);
  });
  it("sets a sitter's hips on the seat, moving there as they sit down", () => {
    const sit = { ...REST, legL: -90, legR: -90, kneeL: 90, kneeR: 90 };
    expect(g.hipY + bodyLift(person, sit, 0.45)).toBeCloseTo(0.45);
    // halfway down, the hips are halfway between where the folded legs alone put them and the seat
    expect(bodyLift(person, sit, 0.45, 0.5)).toBeCloseTo((bodyLift(person, sit, 0.45) + bodyLift(person, sit)) / 2);
  });
  it("does not stand a lying body on its folded legs", () => {
    expect(bodyLift(person, { ...REST, rot: 90, kneeL: 30, kneeR: 40 })).toBeCloseTo(0);
  });
});
