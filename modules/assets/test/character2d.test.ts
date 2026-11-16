import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { flatGeometry } from "../src/render/Character2D.tsx";

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
