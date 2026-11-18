// How a sample video moves, measured from small grey frames (ADR 0024): per second, does the whole picture move (a
// camera move, or layers sliding past each other), do only things in the frame move (characters acting while the
// camera holds), or is it still; and where the hard cuts are. A still frame cannot tell any of this.
// Pure: the ingest stage feeds it raw ffmpeg frames. Thresholds were calibrated on a 2.5D cartoon Short whose moves
// were checked by eye (motion maps and 6 fps filmstrips).

export const MOTION_FPS = 6;
export const MOTION_W = 72;
export const MOTION_H = 128;
const CELL = 8; // px: a 9 x 16 grid of cells
const CHANGED = 10; // grey levels between two frames 1/6 s apart: more than compression noise
const CELL_MOVING = 0.12; // share of a cell's pixels that changed
const TEXTURE = 6; // grey-level standard deviation: a cell with edges (a flat sky shows no movement)
// a hard cut is a spike: a big change between two frames, much bigger than the changes beside it. A dissolve or a
// fast camera move changes as much, but over several frames in a row
const CUT_MEAN = 35;
const CUT_SPIKE = 1.5;
// the whole picture moves when most textured cells change and so do the frame's edges; a character filling a
// close-up changes most cells but leaves the edges
const CAMERA_SHARE = 0.4;
const CAMERA_EDGE = 0.2;
const STILL = 0.03;

export const MOTION_KINDS = ["cut", "camera", "subject", "still"] as const;
export type MotionKind = (typeof MOTION_KINDS)[number];
export type Motion = {
  fps: number;
  seconds: {
    t: number;
    kind: MotionKind;
    moving: number; // share of the textured cells that change from frame to frame
    where?: string; // where things move while the camera holds ("lower left")
  }[];
  cuts: number[]; // seconds
  strips: { from: number; to: number; kind: MotionKind }[];
};
type Second = Motion["seconds"][number];
type Pair = { share: number; edge: number; x: number; y: number; moving: number };

export function measureMotion(raw: Uint8Array, w: number, h: number, fps: number): Motion {
  const size = w * h;
  const n = Math.floor(raw.length / size);
  const frame = (i: number) => raw.subarray(i * size, (i + 1) * size);
  const d = [0];
  for (let i = 1; i < n; i++) d.push(meanDiff(frame(i - 1), frame(i)));
  const cutAt = new Set<number>(); // frame indexes that start a new shot
  for (let i = 1; i < n; i++) {
    const v = d[i] ?? 0;
    if (v >= CUT_MEAN && v >= CUT_SPIKE * Math.max(d[i - 1] ?? 0, d[i + 1] ?? 0)) cutAt.add(i);
  }
  const r = (v: number) => Math.round(v * 100) / 100;
  const seconds: Second[] = [];
  for (let t = 0; t * fps + 1 < n; t++) {
    const pairs: Pair[] = [];
    let cut = false;
    for (let i = t * fps + 1; i <= Math.min(n - 1, (t + 1) * fps - 1); i++) {
      if (cutAt.has(i)) cut = true;
      else pairs.push(cells(frame(i - 1), frame(i), w, h));
    }
    if (cut) {
      seconds.push({ t, kind: "cut", moving: 1 });
      continue;
    }
    const k = Math.max(1, pairs.length);
    const share = pairs.reduce((s, p) => s + p.share, 0) / k;
    const edge = pairs.reduce((s, p) => s + p.edge, 0) / k;
    if (share >= CAMERA_SHARE && edge >= CAMERA_EDGE) seconds.push({ t, kind: "camera", moving: r(share) });
    else if (share < STILL) seconds.push({ t, kind: "still", moving: r(share) });
    else {
      const m = pairs.reduce((s, p) => s + p.moving, 0) || 1;
      const x = pairs.reduce((s, p) => s + p.x * p.moving, 0) / m;
      const y = pairs.reduce((s, p) => s + p.y * p.moving, 0) / m;
      seconds.push({
        t,
        kind: "subject",
        moving: r(share),
        where: `${third(y, ["upper", "middle", "lower"])} ${third(x, ["left", "center", "right"])}`,
      });
    }
  }
  return { fps, seconds, cuts: [...cutAt].map((i) => Math.round((i / fps) * 10) / 10), strips: [] };
}

const third = (v: number, names: [string, string, string]) =>
  names[Math.min(2, Math.max(0, Math.floor(v * 3)))] as string;

function meanDiff(a: Uint8Array, b: Uint8Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs((a[i] ?? 0) - (b[i] ?? 0));
  return s / Math.max(1, a.length);
}

// which textured cells changed between two frames, how many of them on the frame's edge, and their centre (0..1)
function cells(a: Uint8Array, b: Uint8Array, w: number, h: number): Pair {
  let textured = 0;
  let moving = 0;
  let edge = 0;
  let edgeMoving = 0;
  let sx = 0;
  let sy = 0;
  for (let y0 = 0; y0 + CELL <= h; y0 += CELL)
    for (let x0 = 0; x0 + CELL <= w; x0 += CELL) {
      let sum = 0;
      let sq = 0;
      let changed = 0;
      for (let y = y0; y < y0 + CELL; y++)
        for (let x = x0; x < x0 + CELL; x++) {
          const va = a[y * w + x] ?? 0;
          const vb = b[y * w + x] ?? 0;
          sum += vb;
          sq += vb * vb;
          if (Math.abs(va - vb) > CHANGED) changed++;
        }
      const n = CELL * CELL;
      const isMoving = changed / n > CELL_MOVING;
      // a flat cell shows nothing, unless something moved into it
      if (Math.sqrt(Math.max(0, sq / n - (sum / n) ** 2)) < TEXTURE && !isMoving) continue;
      textured++;
      const onEdge = x0 === 0 || y0 === 0 || x0 + 2 * CELL > w || y0 + 2 * CELL > h;
      if (onEdge) edge++;
      if (!isMoving) continue;
      moving++;
      if (onEdge) edgeMoving++;
      sx += (x0 + CELL / 2) / w;
      sy += (y0 + CELL / 2) / h;
    }
  return {
    share: textured ? moving / textured : 0,
    edge: edge ? edgeMoving / edge : 0,
    x: moving ? sx / moving : 0.5,
    y: moving ? sy / moving : 0.5,
    moving,
  };
}

// 2-second windows worth a filmstrip: where things in the frame move most while the camera holds (characters
// acting), and one camera move (how characters move while it moves). Never across a cut, never overlapping.
export function pickStrips(m: Motion, count = 3): Motion["strips"] {
  const end = m.seconds.length;
  const top = (k: Second["kind"]) => m.seconds.filter((s) => s.kind === k).sort((a, b) => b.moving - a.moving);
  const out: Motion["strips"] = [];
  const fits = (from: number) =>
    from + 2 <= end && m.seconds[from + 1]?.kind !== "cut" && !out.some((o) => from < o.to && o.from < from + 2);
  // the next best that fits, until `upTo` strips: a window overlapping one already taken makes way for the next
  const take = (list: Second[], upTo: number) => {
    for (const s of list) if (out.length < upTo && fits(s.t)) out.push({ from: s.t, to: s.t + 2, kind: s.kind });
  };
  take(top("subject"), count - 1);
  take(top("camera"), count);
  take(top("subject"), count);
  return out.sort((a, b) => a.from - b.from);
}

const label = (s: Second): string =>
  s.kind === "cut"
    ? "hard cut"
    : s.kind === "still"
      ? "nothing moves"
      : s.kind === "subject"
        ? `camera holds, characters or things move (${s.where})`
        : "the whole picture moves (camera push, pull or pan, or layers sliding)";

// the two numbers a format keeps and video.qa compares: the share of seconds the whole picture moves, and the
// seconds between hard cuts
export const motionNumbers = (m: Motion): { moving: number; secondsPerCut: number } => {
  const n = m.seconds.length || 1;
  return {
    moving: Math.round((100 * m.seconds.filter((s) => s.kind === "camera").length) / n) / 100,
    secondsPerCut: Math.round((10 * n) / (m.cuts.length + 1)) / 10,
  };
};

// Motion as text for the formula and format prompts: totals, then the seconds run by run.
export function describeMotion(m: Motion): string {
  const n = m.seconds.length || 1;
  const pct = (k: Second["kind"]) => Math.round((100 * m.seconds.filter((s) => s.kind === k).length) / n);
  const runs: string[] = [];
  for (let i = 0; i < m.seconds.length; ) {
    const s = m.seconds[i] as Second;
    let j = i;
    while (j + 1 < m.seconds.length && s.kind !== "cut" && label(m.seconds[j + 1] as Second) === label(s)) j++;
    runs.push(`- ${i === j ? `${s.t}s` : `${s.t}-${m.seconds[j]?.t}s`}: ${label(s)}`);
    i = j + 1;
  }
  return [
    `MOTION, measured from the video at ${m.fps} frames per second (trust it over the still frames: a still cannot show that anything moves): the whole picture moves in ${pct("camera")}% of the seconds, the camera holds while characters or things move in ${pct("subject")}%, nothing moves in ${pct("still")}%; ${m.cuts.length} hard cuts, about ${(n / (m.cuts.length + 1)).toFixed(1)} s per shot (dissolves are not counted as cuts).`,
    ...runs,
  ].join("\n");
}
