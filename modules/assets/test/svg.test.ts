import { describe, expect, it } from "vitest";
import { checkSvg, sized } from "../src/domain/svg.ts";

const moon =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><radialGradient id="g"><stop offset="0" stop-color="#fff"/></radialGradient></defs><circle cx="256" cy="256" r="200" fill="url(#g)" stroke="#1a1a24" stroke-width="8"/><circle cx="200" cy="200" r="30" fill="#ccc"/><ellipse cx="300" cy="320" rx="40" ry="24" fill="#ccc"/></svg>';

describe("drawn icon SVG", () => {
  it("accepts plain shapes with gradients", () => {
    expect(checkSvg(moon)).toEqual([]);
  });
  it("rejects script, text, images, external links and event handlers", () => {
    const errs = checkSvg(
      '<svg viewBox="0 0 10 10"><script>alert(1)</script><text>Hi</text><image href="http://x/y.png"/><rect onload="x()" fill="url(http://evil)"/></svg>',
    ).join("\n");
    expect(errs).toMatch(/tag <script>/);
    expect(errs).toMatch(/tag <text>/);
    expect(errs).toMatch(/tag <image>/);
    expect(errs).toMatch(/attribute onload/);
    expect(errs).toMatch(/url\(http:\/\/evil\)/);
    expect(errs).toMatch(/no text between tags/);
  });
  it("needs a viewBox and a single svg element", () => {
    expect(checkSvg("<svg><rect/><rect/><rect/></svg>").join()).toMatch(/viewBox/);
    expect(checkSvg(`Here you go: ${moon}`).join()).toMatch(/one <svg/);
  });
  it("sizes the root for the rasterizer", () => {
    expect(sized('<svg width="10" viewBox="0 0 1 1"></svg>', 512)).toBe(
      '<svg width="512" height="512" viewBox="0 0 1 1"></svg>',
    );
  });
});
