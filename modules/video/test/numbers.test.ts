import { describe, expect, it } from "vitest";
import {
  fmtLength,
  fmtNumber,
  fmtTick,
  growth,
  logTicks,
  niceTicks,
  spreadLabels,
  superscripts,
} from "../src/domain/numbers.ts";

describe("numbers on screen", () => {
  it("groups digits, keeps two significant decimals and names numbers too long to read", () => {
    expect(fmtNumber(4398046511104)).toBe("4,398,046,511,104");
    expect(fmtNumber(439804.65)).toBe("439,805");
    expect(fmtNumber(0.1)).toBe("0.1");
    expect(fmtNumber(0.0012)).toBe("0.0012");
    expect(fmtNumber(4.4e15)).toBe("4.4 quadrillion");
  });
  it("says a length in the unit a person would use", () => {
    expect(fmtLength(0.0001)).toBe("0.1 mm");
    expect(fmtLength(8849)).toBe("8,849 m");
    expect(fmtLength(384_400_000)).toBe("384,400 km");
  });
  it("keeps axis ticks short", () => {
    expect(fmtTick(1e11, "m")).toBe("100M km");
    expect(fmtTick(1000, "folds")).toBe("1K folds");
    expect(fmtTick(1000, "m")).toBe("1 km");
    expect(fmtTick(0.001, "m")).toBe("1 mm");
  });
  it("grows exponentially across orders of magnitude, linearly within one", () => {
    expect(growth(1, 1e6, 0.5)).toBeCloseTo(1000);
    expect(growth(0, 10, 0.5)).toBe(5);
  });
  it("puts at most a handful of power-of-ten ticks on a log axis", () => {
    expect(logTicks(0.5, 2000)).toEqual([1, 10, 100, 1000]);
    expect(logTicks(1e-4, 1e9).length).toBeLessThanOrEqual(7);
  });
  it("puts round ticks on a linear axis", () => {
    expect(niceTicks(0, 42)).toEqual([0, 20, 40]);
    expect(niceTicks(0, 7.5)).toEqual([0, 2, 4, 6]);
  });
  it("raises what follows a caret", () => {
    expect(superscripts("2^42 x 0.1 mm")).toEqual([
      { text: "2", up: false },
      { text: "42", up: true },
      { text: " x 0.1 mm", up: false },
    ]);
  });
  it("pushes crowded labels apart, upward, inside the plot", () => {
    expect(spreadLabels([500, 490, 300], 40, 0, 600)).toEqual([500, 460, 300]);
  });
});
