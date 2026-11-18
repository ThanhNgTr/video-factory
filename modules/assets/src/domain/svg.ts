// What a drawn icon's SVG may contain (ADR 0017). Pure. Anything outside the allowlist is an error the drawer must fix,
// so a drawing never carries script, external links, text or embedded images into the renderer or the rasterizer.

const TAGS = new Set([
  "svg",
  "g",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "defs",
  "lineargradient",
  "radialgradient",
  "stop",
  "clippath",
]);
const ATTRS = new Set([
  "xmlns",
  "viewbox",
  "id",
  "d",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "fx",
  "fy",
  "width",
  "height",
  "points",
  "transform",
  "fill",
  "fill-opacity",
  "fill-rule",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-opacity",
  "stroke-dasharray",
  "stroke-miterlimit",
  "opacity",
  "clip-path",
  "clip-rule",
  "offset",
  "stop-color",
  "stop-opacity",
  "gradientunits",
  "gradienttransform",
  "spreadmethod",
]);
const SHAPES = new Set(["path", "rect", "circle", "ellipse", "line", "polyline", "polygon"]);
export const MAX_SVG = 40_000;

export function checkSvg(raw: string): string[] {
  const svg = raw.trim();
  const errs: string[] = [];
  if (!/^<svg[\s>]/.test(svg) || !svg.endsWith("</svg>"))
    errs.push("the answer must be one <svg ...>...</svg> element");
  if (svg.length > MAX_SVG) errs.push(`the SVG is ${svg.length} characters, keep it under ${MAX_SVG}`);
  if (svg.includes("<!") || svg.includes("<?")) errs.push("no comments, CDATA, DOCTYPE or processing instructions");
  if (!/^<svg[^>]*\sviewBox="[\d.\s-]+"/.test(svg))
    errs.push('the root <svg> needs a numeric viewBox, like viewBox="0 0 512 512"');
  let shapes = 0;
  const bad = new Set<string>();
  for (const m of svg.matchAll(/<\/?([a-zA-Z][\w:-]*)([^>]*)>/g)) {
    const tag = (m[1] ?? "").toLowerCase();
    if (!TAGS.has(tag)) bad.add(`tag <${m[1]}>`);
    if (SHAPES.has(tag)) shapes++;
    for (const a of (m[2] ?? "").matchAll(/([^\s=/]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      const name = (a[1] ?? "").toLowerCase();
      const value = (a[2] ?? a[3] ?? "").toLowerCase();
      if (!ATTRS.has(name)) bad.add(`attribute ${a[1]}`);
      for (const u of value.matchAll(/url\(([^)]*)\)/g))
        if (!/^\s*#[\w.-]+\s*$/.test(u[1] ?? "")) bad.add(`url(${u[1]}) (only url(#id) is allowed)`);
      if (/javascript:|data:|expression\(/.test(value)) bad.add(`value of ${a[1]}`);
    }
  }
  if (bad.size)
    errs.push(`not allowed: ${[...bad].slice(0, 12).join(", ")}. Use only plain shapes, groups and gradients`);
  if (/>[^<]*[^\s<][^<]*</.test(svg)) errs.push("no text between tags: draw shapes only, never letters or words");
  if (shapes < 3) errs.push("draw the subject with at least a few shapes");
  return errs;
}

// the same drawing at a fixed pixel size, for the rasterizer (a viewBox alone renders tiny)
export const sized = (svg: string, px: number): string =>
  svg.trim().replace(/^<svg\b([^>]*)>/, (_, attrs: string) => {
    const rest = attrs.replace(/\s(width|height)="[^"]*"/g, "");
    return `<svg width="${px}" height="${px}"${rest}>`;
  });
