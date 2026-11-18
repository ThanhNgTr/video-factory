// Numbers on screen for motion graphics: formatting, growth curves and axis ticks. Pure.

const WORDS: [number, string][] = [
  [1e18, "quintillion"],
  [1e15, "quadrillion"],
];

// 439804.65 -> "439,805"; 0.1 -> "0.1"; 4.4e15 -> "4.4 quadrillion" (past what digit grouping can show)
export function fmtNumber(v: number): string {
  const a = Math.abs(v);
  for (const [n, w] of WORDS) if (a >= n) return `${trim(v / n, 1)} ${w}`;
  if (a >= 100) return Math.round(v).toLocaleString("en-US");
  if (a >= 1) return trim(v, 1);
  if (a === 0) return "0";
  return trim(v, Math.max(1, 1 - Math.floor(Math.log10(a)))); // 0.0012 -> "0.0012", 0.1 -> "0.1"
}

const trim = (v: number, digits: number) =>
  v.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 0 });

// a length in metres in the unit a person would say: 0.0001 -> "0.1 mm", 384400000 -> "384,400 km"
export function fmtLength(m: number): string {
  const a = Math.abs(m);
  if (a >= 10_000) return `${fmtNumber(m / 1000)} km`; // Everest is "8,849 m", not "8.8 km"
  if (a >= 1) return `${fmtNumber(m)} m`;
  if (a >= 0.01) return `${fmtNumber(m * 100)} cm`;
  if (a >= 1e-4 || a === 0) return `${fmtNumber(m * 1000)} mm`;
  return `${fmtNumber(m * 1e6)} um`;
}

// a value with its unit; "m" is shown as a human length
export const fmtValue = (v: number, unit?: string): string =>
  unit === "m" ? fmtLength(v) : unit ? `${fmtNumber(v)} ${unit}` : fmtNumber(v);

// an axis tick, short: 100000000 km -> "100M km"
export function fmtTick(v: number, unit?: string): string {
  const c = (n: number) => n.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 });
  if (unit !== "m") return unit ? `${c(v)} ${unit}` : c(v);
  const a = Math.abs(v);
  if (a >= 1000) return `${c(v / 1000)} km`; // a tick reads "1 km", never "1K m"
  if (a >= 1) return `${c(v)} m`;
  if (a >= 0.01) return `${c(v * 100)} cm`;
  if (a >= 1e-4) return `${c(v * 1000)} mm`;
  return `${c(v * 1e6)} um`;
}

// where a growing number is at progress k (0..1): exponential across big ranges, so every order of magnitude gets
// the same screen time (the point of a doubling story), linear otherwise
export function growth(from: number, to: number, k: number): number {
  if (from > 0 && to > 0 && to / from > 50) return from * (to / from) ** k;
  return from + (to - from) * k;
}

// powers of ten from lo to hi, at most `max` of them (every 2nd, 3rd... when there are more)
export function logTicks(lo: number, hi: number, max = 7): number[] {
  const a = Math.ceil(Math.log10(lo));
  const b = Math.floor(Math.log10(hi));
  const step = Math.max(1, Math.ceil((b - a + 1) / max));
  const out: number[] = [];
  for (let e = a; e <= b; e += step) out.push(10 ** e);
  return out;
}

// round ticks from 0 (or lo) to at least hi: steps of 1, 2 or 5 times a power of ten, about n of them
export function niceTicks(lo: number, hi: number, n = 4): number[] {
  const raw = (hi - lo) / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 5, 10].find((m) => m * mag >= raw) ?? 10) * mag;
  const out: number[] = [];
  for (let v = Math.floor(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(Number(v.toPrecision(12)));
  return out;
}

// "2^42 x 0.1 mm" -> 2, 42 raised, " x 0.1 mm"
export function superscripts(s: string): { text: string; up: boolean }[] {
  return s
    .split(/\^([0-9a-zA-Z.+-]+)/)
    .map((text, i) => ({ text, up: i % 2 === 1 }))
    .filter((t) => t.text !== "");
}

// spread labels at sorted positions so neighbours keep `gap` apart, staying inside [lo, hi] (screen y grows down)
export function spreadLabels(ys: number[], gap: number, lo: number, hi: number): number[] {
  const out = [...ys];
  for (let i = 1; i < out.length; i++) out[i] = Math.min(out[i] as number, (out[i - 1] as number) - gap);
  const over = lo - (out.at(-1) ?? lo);
  if (over > 0) for (let i = 0; i < out.length; i++) out[i] = (out[i] as number) + over;
  return out.map((y) => Math.min(hi, y));
}
