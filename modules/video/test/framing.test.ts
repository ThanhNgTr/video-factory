import { describe, expect, it } from "vitest";
import { dollyZoomFov, type FitOptions, fitRoom } from "../src/domain/framing.ts";

const deg = Math.PI / 180;
// the shot s22 of night-diner part 1: the Driver behind the counter, Hank at the stools, Theo near the lens
const people = [
  { x: 0, z: -3.3 },
  { x: 1.3, z: -1.6 },
  { x: -1, z: 0.6 },
];
const base: FitOptions = { cx: 0.1, fov: 45, aspect: 9 / 16, pad: 0.8, slide: 0, push: 0, minZ: -1.4 + 6.2, maxZ: 7.5 };
// does everyone fit with their margin when the camera ends `push` metres forward?
const fits = (o: FitOptions, r: { x: number; z: number; fov: number }) =>
  people.every(
    (a) =>
      Math.abs(a.x - r.x) + o.pad + o.slide <= (r.z - o.push - a.z) * Math.tan((r.fov / 2) * deg) * o.aspect + 1e-6,
  );

describe("fitRoom", () => {
  it("backs up until the person nearest the lens fits, not just the group's middle", () => {
    const r = fitRoom(people, base);
    expect(fits(base, r)).toBe(true);
  });
  it("widens the lens for the end of a push when the front wall stops it backing up", () => {
    const o = { ...base, push: 1.6 };
    const r = fitRoom(people, o);
    expect(r.z).toBe(7.5);
    expect(r.fov).toBeGreaterThan(45); // the old fit narrowed it here
    expect(fits(o, r)).toBe(true);
    expect(r.x).toBeLessThan(o.cx); // it frames from nearer Theo, who is closest to the lens
    const centred =
      2 * Math.atan(Math.max(...people.map((a) => (Math.abs(a.x - o.cx) + o.pad) / ((r.z - 1.6 - a.z) * o.aspect))));
    expect(r.fov).toBeLessThan(centred / deg); // so the lens widens less than from the group's middle
  });
  it("keeps the lens when there is room to back up", () => {
    expect(
      fitRoom(
        [
          { x: 0, z: -3 },
          { x: 0.5, z: -3 },
        ],
        { ...base, cx: 0.25, maxZ: 20 },
      ).fov,
    ).toBe(45);
  });
});

describe("dollyZoomFov", () => {
  it("widens the lens as the camera closes in, so the subject keeps its size", () => {
    const size = (fov: number, d: number) => d * Math.tan(((fov / 2) * Math.PI) / 180);
    const fov = dollyZoomFov(38, 3, 1.65);
    expect(fov).toBeGreaterThan(38);
    expect(size(fov, 1.65)).toBeCloseTo(size(38, 3), 6);
    expect(dollyZoomFov(40, 2, 2)).toBeCloseTo(40, 6);
  });
});
