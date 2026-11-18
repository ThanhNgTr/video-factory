// Motion-graphics shots (ADR 0017): a graphic fills the frame over moving graph paper, between the HUD and the
// captions. Pure function of (props, frame); every reveal is timed against the shot so it lands by about 70% of it.
// ds-allow-hardcode:start -- motion-graphics styling burned into 1080x1920 video frames, not UI tokens

import type { Graphic, Icon } from "@vf/contracts";
import type React from "react";
import { AbsoluteFill, Easing, Img, random, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { GROW, ICONS_SHARE, LAYERS_SHARE, LIST_SHARE } from "../domain/graphic-timing.ts";
import {
  fmtNumber,
  fmtTick,
  fmtValue,
  growth,
  logTicks,
  niceTicks,
  spreadLabels,
  superscripts,
} from "../domain/numbers.ts";
import type { RenderProps } from "./props.ts";

const FONT = '"Noto Sans", "DejaVu Sans", "Liberation Sans", sans-serif';
const ACCENT = "#ffd60a";
const SECOND = "#4cc9f0";
type Mood = RenderProps["scene"]["mood"];
// accent: the highlight colour; yellow reads on dark paper but washes out on bright paper, so amber there
const THEME: Record<
  Mood,
  { bg: [string, string]; ink: string; dim: string; grid: string; panel: string; accent: string }
> = {
  night: {
    bg: ["#0b1020", "#18213f"],
    ink: "#f4f1ea",
    dim: "#9aa3bd",
    grid: "rgba(255,255,255,0.06)",
    panel: "#1b2444",
    accent: ACCENT,
  },
  horror: {
    bg: ["#12060a", "#2c0d13"],
    ink: "#f4ece8",
    dim: "#b39a9c",
    grid: "rgba(255,255,255,0.05)",
    panel: "#2a1117",
    accent: ACCENT,
  },
  bright: {
    bg: ["#f6f1e7", "#e7ddcb"],
    ink: "#1d1b22",
    dim: "#6b6475",
    grid: "rgba(0,0,0,0.07)",
    panel: "#ffffff",
    accent: "#d06b00",
  },
};
type Theme = (typeof THEME)[Mood];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
// text widths measured on a canvas in the render's own fonts, at 100 px (counting characters overflowed wide digits
// and wasted room on narrow ones)
const widths = new Map<string, number>();
function width100(text: string, weight = 900): number {
  const key = `${weight}|${text}`;
  let w = widths.get(key);
  if (w === undefined) {
    const ctx = document.createElement("canvas").getContext("2d");
    if (ctx) ctx.font = `${weight} 100px ${FONT}`;
    w = ctx ? ctx.measureText(text).width * 1.04 : text.length * 62; // 4%: tabular digits run a little wider
    widths.set(key, w);
  }
  return w;
}
// the font size at which `text` fills `width`, capped at `max`
const fitSize = (text: string, width: number, max: number, weight = 900) =>
  Math.min(max, (width / Math.max(1, width100(text, weight))) * 100);

// a hand-drawn ellipse around a w x h box, drawn in over `progress` (0..1): the explainer's "look here" circle.
// Its wobble comes from random(seed), so every frame draws the same stroke
const Scribble: React.FC<{ w: number; h: number; progress: number; seed: string; color: string }> = ({
  w,
  h,
  progress,
  seed,
  color,
}) => {
  const rx = w / 2 + 62;
  const ry = h / 2 + 34;
  const n = 40;
  const pts = Array.from({ length: n + 1 }, (_, i) => {
    const a = -2.2 + (i / n) * (Math.PI * 2 + 0.5); // a little more than a full turn: the ends overlap like a pen's
    const wob = 1 + (random(`${seed}${i}`) - 0.5) * 0.06;
    return [rx + 6 + Math.cos(a) * rx * wob, ry + 6 + Math.sin(a) * ry * wob] as const;
  });
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1] ?? [0, 0];
    const [bx, by] = pts[i] ?? [0, 0];
    len += Math.hypot(bx - ax, by - ay);
  }
  return (
    <svg
      width={rx * 2 + 12}
      height={ry * 2 + 12}
      style={{
        position: "absolute",
        left: `calc(50% - ${rx + 6}px)`,
        top: `calc(50% - ${ry + 6}px)`,
        overflow: "visible",
      }}
    >
      <title>circled</title>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={7}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={len}
        strokeDashoffset={len * (1 - progress)}
      />
    </svg>
  );
};

// a graphic's small title: balanced lines, so a long one never leaves a word alone on the second line
const LABEL = {
  fontSize: 40,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: 2,
  lineHeight: 1.15,
  textWrap: "balance",
} as React.CSSProperties;
const ease = Easing.out(Easing.cubic);
// a growing number moves evenly through its orders of magnitude, easing only at the ends
const grow = Easing.inOut(Easing.sin);
const growAt = (lf: number, start: number, len: number) => grow(clamp01((lf - start) / Math.max(1, len)));
// a growing number lands by this share of its shot: while the narrator says it, then it holds long enough to read
// GROW and the reveal shares live in domain/graphic-timing.ts, shared with the sound cues
// progress of a reveal that starts at `start` and lasts `len` frames
const at = (lf: number, start: number, len: number) => ease(clamp01((lf - start) / Math.max(1, len)));

export const Graphics: React.FC<{ p: RenderProps }> = ({ p }) => (
  <>
    {p.timeline.shots.map((row) => {
      const s = p.scene.shots.find((sh) => sh.id === row.id);
      if (s?.inset && !s.graphic)
        return (
          <Sequence key={row.id} from={row.from} durationInFrames={row.frames} layout="none">
            <Inset g={s.inset} frames={row.frames} mood={p.scene.mood} icons={p.assets.icons} />
          </Sequence>
        );
      if (!s?.graphic) return null;
      return (
        <Sequence key={row.id} from={row.from} durationInFrames={row.frames} layout="none">
          <GraphicShot
            g={s.graphic}
            frames={row.frames}
            mood={p.scene.mood}
            icons={p.assets.icons}
            top={top(p, s, row.id === p.timeline.shots[0]?.id)}
          />
        </Sequence>
      );
    })}
  </>
);

// the graphic sits between the HUD (and a shot's text card) and the captions at 60% of the height
// (a later shot's text is a small badge, the opening card is big)
const top = (p: RenderProps, s: { text?: string }, first: boolean) =>
  s.text ? (first ? 0.25 : 0.18) : p.scene.hud ? 0.13 : 0.07;
const BOTTOM = 0.585;

const GraphicShot: React.FC<{
  g: Graphic;
  frames: number;
  mood: Mood;
  icons: Record<string, Icon>;
  top: number;
}> = ({ g, frames, mood, icons, top: t }) => {
  const lf = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const th = THEME[mood];
  const box = { x: 70, y: H * t, w: W - 140, h: H * (BOTTOM - t) };
  const enter = at(lf, 0, 8);
  const drift = (lf * 0.4) % 60;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% 35%, ${th.bg[1]} 0%, ${th.bg[0]} 70%)`,
        fontFamily: FONT,
        color: th.ink,
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${th.grid} 2px, transparent 2px), linear-gradient(90deg, ${th.grid} 2px, transparent 2px)`,
          backgroundSize: "60px 60px",
          backgroundPosition: `0 ${drift}px`,
        }}
      />
      {/* the HUD is white: a dark band behind it keeps it readable over bright graph paper */}
      <AbsoluteFill
        style={{ height: H * 0.12, background: "linear-gradient(rgba(14,16,26,0.82), rgba(14,16,26,0))" }}
      />
      <div
        style={{
          position: "absolute",
          left: box.x,
          top: box.y,
          width: box.w,
          height: box.h,
          opacity: enter,
          transform: `translateY(${(1 - enter) * 30}px)`,
        }}
      >
        {g.kind === "count" && <Count g={g} lf={lf} frames={frames} th={th} icons={icons} box={box} />}
        {g.kind === "scale" && <Scale g={g} lf={lf} frames={frames} th={th} icons={icons} box={box} />}
        {g.kind === "chart" && <Chart g={g} lf={lf} frames={frames} th={th} box={box} />}
        {g.kind === "formula" && <Formula g={g} lf={lf} frames={frames} th={th} />}
        {g.kind === "list" && <List g={g} lf={lf} frames={frames} th={th} />}
        {g.kind === "icons" && <Icons g={g} lf={lf} frames={frames} th={th} icons={icons} box={box} />}
        {g.kind === "layers" && <Layers g={g} lf={lf} frames={frames} th={th} icons={icons} box={box} />}
      </div>
    </AbsoluteFill>
  );
};

type Box = { w: number; h: number };
type Part<K extends Graphic["kind"]> = {
  g: Extract<Graphic, { kind: K }>;
  lf: number;
  frames: number;
  th: Theme;
};

// an icon drawing, or nothing when it was never drawn (the label still says what it is)
const IconImg: React.FC<{ icon?: Icon; size: number; style?: React.CSSProperties }> = ({ icon, size, style }) =>
  icon ? (
    <Img
      src={`data:image/svg+xml;utf8,${encodeURIComponent(icon.svg)}`}
      style={{ width: size, height: size, objectFit: "contain", ...style }}
    />
  ) : null;

const Count: React.FC<Part<"count"> & { icons: Record<string, Icon>; box: Box }> = ({
  g,
  lf,
  frames,
  th,
  icons,
  box,
}) => {
  const k = growAt(lf, 4, frames * GROW);
  const raw = growth(g.from, g.to, k);
  // counting things: whole numbers only ("1.9 layers" read as a glitch)
  const text = fmtNumber(Number.isInteger(g.from) && Number.isInteger(g.to) ? Math.round(raw) : raw);
  // sized for the final value, so the number does not shrink while it grows
  const size = fitSize(fmtNumber(g.to), box.w, 230);
  const pop = k >= 1 ? 1 + 0.06 * Math.sin(Math.min(Math.PI, ((lf - frames * GROW - 4) / 10) * Math.PI)) : 1;
  const icon = g.icon ? icons[g.icon] : undefined;
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 26,
      }}
    >
      {icon && (
        <IconImg icon={icon} size={Math.min(300, box.h * 0.36)} style={{ transform: `scale(${at(lf, 0, 12)})` }} />
      )}
      {g.label && (
        <div
          style={{
            fontSize: 50,
            fontWeight: 800,
            color: th.dim,
            textTransform: "uppercase",
            letterSpacing: 3,
            textAlign: "center",
          }}
        >
          {g.label}
        </div>
      )}
      <div
        style={{
          fontSize: size,
          fontWeight: 900,
          color: th.accent,
          lineHeight: 1,
          transform: `scale(${pop})`,
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </div>
      {g.unit && <div style={{ fontSize: 66, fontWeight: 800 }}>{g.unit}</div>}
    </div>
  );
};

const Scale: React.FC<Part<"scale"> & { icons: Record<string, Icon>; box: Box }> = ({
  g,
  lf,
  frames,
  th,
  icons,
  box,
}) => {
  const values = [g.from, g.to, ...g.marks.map((m) => m.value)];
  const lo = Math.log10(Math.min(...values) / 2);
  const hi = Math.log10(Math.max(...values) * 2);
  // the current value reads big above the plot (a pill on the bar covered the marks' labels)
  const head = g.label ? 190 : 130;
  const bottom = 24;
  const y = (v: number) => box.h - bottom - ((Math.log10(v) - lo) / (hi - lo)) * (box.h - bottom - head - 20);
  const k = growAt(lf, 6, frames * GROW);
  const raw = growth(g.from, g.to, k);
  const axisX = 176;
  const barX = axisX + 16;
  const barW = 150;
  const labelX = barX + barW + 70;
  const marks = [...g.marks].sort((a, b) => a.value - b.value);
  const labelY = spreadLabels(
    marks.map((m) => y(m.value)),
    128,
    head + 50,
    box.h - 60,
  );
  const ticks = logTicks(10 ** lo, 10 ** hi, 5);
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, textAlign: "center" }}>
        {g.label && <div style={{ ...LABEL, color: th.dim }}>{g.label}</div>}
        <div
          style={{
            fontSize: fitSize(fmtValue(g.to, g.unit), box.w, 92),
            fontWeight: 900,
            color: th.accent,
            lineHeight: 1.1,
            whiteSpace: "nowrap",
          }}
        >
          {fmtValue(raw, g.unit)}
        </div>
      </div>
      <svg width={box.w} height={box.h} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <title>{g.label ?? "scale"}</title>
        <line
          x1={axisX}
          y1={head + 10}
          x2={axisX}
          y2={box.h - bottom}
          stroke={th.dim}
          strokeWidth={4}
          strokeLinecap="round"
        />
        {ticks.map((v) => (
          <g key={v}>
            <line x1={axisX - 14} y1={y(v)} x2={axisX} y2={y(v)} stroke={th.dim} strokeWidth={3} />
            <text
              x={axisX - 22}
              y={y(v) + 11}
              fill={th.dim}
              fontSize={32}
              fontWeight={700}
              textAnchor="end"
              fontFamily={FONT}
            >
              {fmtTick(v, g.unit)}
            </text>
          </g>
        ))}
        <rect x={barX} y={y(raw)} width={barW} height={Math.max(8, box.h - bottom - y(raw))} rx={20} fill={th.accent} />
        <rect
          x={barX + 18}
          y={y(raw) + 14}
          width={22}
          height={Math.max(0, box.h - bottom - y(raw) - 28)}
          rx={11}
          fill="#fff"
          opacity={0.35}
        />
        {marks.map((m, i) => {
          const reached = raw >= m.value;
          const ly = labelY[i] ?? y(m.value);
          return (
            <g key={m.label} opacity={reached ? 1 : 0.4}>
              <line
                x1={barX}
                y1={y(m.value)}
                x2={barX + barW + 24}
                y2={y(m.value)}
                stroke={th.ink}
                strokeWidth={4}
                strokeDasharray="12 9"
              />
              <path
                d={`M ${barX + barW + 24} ${y(m.value)} L ${labelX - 10} ${ly}`}
                stroke={th.ink}
                strokeWidth={4}
                fill="none"
              />
            </g>
          );
        })}
      </svg>
      {marks.map((m, i) => {
        const reached = raw >= m.value;
        const ly = labelY[i] ?? y(m.value);
        const icon = m.icon ? icons[m.icon] : undefined;
        const pop = reached ? 1 + 0.12 * Math.max(0, 1 - (lf - crossing(g, m.value, frames)) / 8) : 0.92;
        return (
          <div
            key={m.label}
            style={{
              position: "absolute",
              left: labelX,
              top: ly - 60,
              height: 120,
              right: 0,
              display: "flex",
              alignItems: "center",
              gap: 20,
              opacity: reached ? 1 : 0.4,
              transform: `scale(${pop})`,
              transformOrigin: "left center",
            }}
          >
            <IconImg icon={icon} size={112} />
            <div style={{ lineHeight: 1.05, minWidth: 0 }}>
              <div style={{ fontSize: 46, fontWeight: 900 }}>{m.label}</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: reached ? th.accent : th.dim }}>
                {fmtValue(m.value, g.unit)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// the frame (within the shot) where a growing scale passes `v`: its mark pops then
function crossing(g: Extract<Graphic, { kind: "scale" }>, v: number, frames: number): number {
  const len = frames * GROW;
  for (let f = 6; f <= 6 + len; f++) if (growth(g.from, g.to, grow(clamp01((f - 6) / len))) >= v) return f;
  return Number.POSITIVE_INFINITY;
}

const Chart: React.FC<Part<"chart"> & { box: Box }> = ({ g, lf, frames, th, box }) => {
  const left = 130;
  const bottom = 80;
  const topPad = g.label ? 80 : 30;
  const w = box.w - left - 20;
  const h = box.h - bottom - topPad;
  const vals = g.points.map((pt) => pt.value);
  const yLo = g.log ? Math.min(...vals) / 1.5 : Math.min(0, ...vals);
  const yHi = g.log ? Math.max(...vals) * 1.5 : Math.max(...vals) * 1.12 || 1;
  const yTicks = g.log ? logTicks(yLo, yHi, 5) : niceTicks(yLo, yHi / 1.12, 4).filter((v) => v <= yHi);
  const toY = g.log
    ? (() => {
        const lo = Math.log10(Math.min(...vals) / 1.5);
        const hi = Math.log10(Math.max(...vals) * 1.5);
        return (v: number) => topPad + h - ((Math.log10(v) - lo) / (hi - lo)) * h;
      })()
    : (() => {
        const lo = Math.min(0, ...vals);
        const hi = Math.max(...vals) * 1.12 || 1;
        return (v: number) => topPad + h - ((v - lo) / (hi - lo)) * h;
      })();
  const n = g.points.length;
  const x = (i: number) => left + (g.style === "bar" ? ((i + 0.5) / n) * w : (i / (n - 1)) * w);
  const k = at(lf, 4, frames * 0.62);
  const every = Math.ceil(n / 7);
  const shown = k * (n - 1); // how far along the line the pen is, in points
  const path = g.points
    .slice(0, Math.floor(shown) + 1)
    .map((pt, i) => `${i ? "L" : "M"} ${x(i)} ${toY(pt.value)}`)
    .join(" ");
  const i0 = Math.floor(shown);
  const p0 = g.points[i0];
  const p1 = g.points[Math.min(n - 1, i0 + 1)];
  const tip =
    p0 && p1
      ? {
          x: x(i0) + (x(i0 + 1) - x(i0)) * (shown - i0),
          y: toY(p0.value) + (toY(p1.value) - toY(p0.value)) * (shown - i0),
        }
      : undefined;
  const hl = g.highlight !== undefined ? g.points[g.highlight] : undefined;
  const hlOn = g.highlight !== undefined && (g.style === "bar" ? k >= 1 : shown >= g.highlight);
  const barW = Math.min(110, (w / n) * 0.66);
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {g.label && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            textAlign: "center",
            fontSize: 44,
            fontWeight: 800,
            color: th.dim,
            textTransform: "uppercase",
            letterSpacing: 2,
          }}
        >
          {g.label}
        </div>
      )}
      <svg width={box.w} height={box.h} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <title>{g.label ?? "chart"}</title>
        <line x1={left} y1={topPad + h} x2={left + w} y2={topPad + h} stroke={th.dim} strokeWidth={4} />
        <line x1={left} y1={topPad} x2={left} y2={topPad + h} stroke={th.dim} strokeWidth={4} />
        {yTicks.map((v) => (
          <g key={`y${v}`}>
            <line x1={left} y1={toY(v)} x2={left + w} y2={toY(v)} stroke={th.grid} strokeWidth={2} />
            <text
              x={left - 14}
              y={toY(v) + 10}
              fill={th.dim}
              fontSize={26}
              fontWeight={700}
              textAnchor="end"
              fontFamily={FONT}
            >
              {fmtValue(v, g.unit).replace(/ (\w+)$/, "\u2009$1")}
            </text>
          </g>
        ))}
        {g.points.map((pt, i) =>
          i % every === 0 || i === n - 1 ? (
            <text
              key={`x${pt.label}`}
              x={x(i)}
              y={topPad + h + 48}
              fill={th.dim}
              fontSize={30}
              fontWeight={700}
              textAnchor="middle"
              fontFamily={FONT}
            >
              {pt.label}
            </text>
          ) : null,
        )}
        {g.style === "line" && (
          <>
            <path
              d={tip ? `${path} L ${tip.x} ${tip.y}` : path}
              stroke={th.accent}
              strokeWidth={10}
              fill="none"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {g.points.slice(0, Math.floor(shown) + 1).map((pt, i) => (
              <circle key={`p${pt.label}`} cx={x(i)} cy={toY(pt.value)} r={9} fill={th.ink} />
            ))}
          </>
        )}
        {g.style === "bar" &&
          g.points.map((pt, i) => {
            const kk = at(lf, 4 + (i * frames * 0.4) / n, frames * 0.3);
            const y0 = toY(g.log ? Math.min(...vals) / 1.5 : 0);
            const y1 = y0 + (toY(pt.value) - y0) * kk;
            return (
              <rect
                key={`b${pt.label}`}
                x={x(i) - barW / 2}
                y={Math.min(y0, y1)}
                width={barW}
                height={Math.abs(y0 - y1)}
                rx={10}
                fill={i === g.highlight ? th.accent : SECOND}
              />
            );
          })}
        {hl && hlOn && g.highlight !== undefined && g.style === "line" && (
          <circle
            cx={x(g.highlight)}
            cy={toY(hl.value)}
            r={22 + 6 * Math.sin(lf / 4)}
            fill="none"
            stroke={th.accent}
            strokeWidth={6}
          />
        )}
      </svg>
      {hl && hlOn && g.highlight !== undefined && (
        <div
          style={{
            position: "absolute",
            left: x(g.highlight),
            top: Math.max(topPad + 6, toY(hl.value) - 100),
            // near the right edge the pill hangs to the left of its point, so it never leaves the frame
            transform: `translateX(${x(g.highlight) > box.w * 0.6 ? "-100%" : "-50%"})`,
            background: th.accent,
            color: "#111",
            borderRadius: 16,
            padding: "8px 22px",
            fontSize: 40,
            fontWeight: 900,
            whiteSpace: "nowrap",
          }}
        >
          {fmtValue(hl.value, g.unit)}
        </div>
      )}
    </div>
  );
};

const Formula: React.FC<Part<"formula">> = ({ g, lf, frames, th }) => {
  const step = (frames * LIST_SHARE) / g.lines.length;
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: 34,
      }}
    >
      {g.lines.map((line, i) => {
        const k = at(lf, 4 + i * step, 10);
        const last = i === g.lines.length - 1 && g.lines.length > 1;
        const plain = line.replaceAll("^", "");
        const size = fitSize(plain, last ? 760 : 900, last ? 104 : 88); // the result leaves room for its circle
        const circle = last ? at(lf, 4 + i * step + 8, 14) : 0; // circled by hand once it is on screen
        return (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list that never reorders; lines may repeat
            key={`${i}:${line}`}
            style={{
              opacity: k,
              transform: `translateY(${(1 - k) * 24}px)`,
              fontSize: size,
              fontWeight: 900,
              color: last ? th.accent : th.ink,
              whiteSpace: "nowrap",
              fontVariantNumeric: "tabular-nums",
              position: "relative",
            }}
          >
            {last && (
              <Scribble
                w={(width100(plain) * size) / 100}
                h={size * 1.1}
                progress={circle}
                seed={line}
                color={th.accent}
              />
            )}
            {superscripts(line).map((t, j) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list that never reorders; pieces may repeat
              <span key={`${j}:${t.text}`} style={t.up ? { fontSize: "0.58em", verticalAlign: "0.85em" } : undefined}>
                {t.text}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
};

const List: React.FC<Part<"list">> = ({ g, lf, frames, th }) => {
  const step = (frames * LIST_SHARE) / g.items.length;
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 30 }}>
      {g.title && (
        <div
          style={{ fontSize: 54, fontWeight: 900, textTransform: "uppercase", textAlign: "center", marginBottom: 10 }}
        >
          {g.title}
        </div>
      )}
      {g.items.map((item, i) => {
        const k = at(lf, 4 + i * step, 10);
        return (
          <div
            key={item}
            style={{
              opacity: k,
              transform: `translateX(${(1 - k) * -40}px)`,
              display: "flex",
              alignItems: "center",
              gap: 26,
              background: th.panel,
              borderRadius: 22,
              padding: "20px 26px",
            }}
          >
            <div
              style={{
                flexShrink: 0,
                width: 70,
                height: 70,
                borderRadius: 35,
                background: th.accent,
                color: "#111",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 40,
                fontWeight: 900,
              }}
            >
              {i + 1}
            </div>
            <div style={{ fontSize: 46, fontWeight: 800, lineHeight: 1.15 }}>{item}</div>
          </div>
        );
      })}
    </div>
  );
};

const Icons: React.FC<Part<"icons"> & { icons: Record<string, Icon>; box: Box }> = ({
  g,
  lf,
  frames,
  th,
  icons,
  box,
}) => {
  const n = g.items.length;
  const cols = n === 4 ? 2 : n;
  const size = n === 1 ? Math.min(460, box.h * 0.62) : n === 2 ? 380 : n === 3 ? 270 : Math.min(260, box.h * 0.3);
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        height: "100%",
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        alignContent: "center",
        rowGap: 30,
      }}
    >
      {g.items.map((it, i) => {
        const s = spring({ frame: lf - 4 - (i * frames * ICONS_SHARE) / n, fps, config: { damping: 12 } });
        const icon = icons[it.icon];
        return (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list that never reorders; an icon may repeat
            key={`${it.icon}:${i}`}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              transform: `scale(${s})`,
            }}
          >
            {icon ? (
              <IconImg icon={icon} size={size} />
            ) : (
              <div style={{ width: size * 0.7, height: size * 0.7, borderRadius: 32, background: th.panel }} />
            )}
            {it.value && (
              <div
                style={{
                  fontSize: fitSize(it.value, box.w / cols - 24, n === 1 ? 92 : 64),
                  fontWeight: 900,
                  color: th.accent,
                  whiteSpace: "nowrap",
                }}
              >
                {it.value}
              </div>
            )}
            {it.label && (
              <div
                style={{
                  fontSize: n === 1 ? 56 : 42,
                  fontWeight: 800,
                  textAlign: "center",
                  textTransform: "uppercase",
                  lineHeight: 1.1,
                }}
              >
                {it.label}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// earth, clay, gravel, concrete, steel, water, grass: the default fill of each layer by its position
const STRATA = ["#7a5a3a", "#a8834f", "#9a958c", "#bfbab0", "#6f7d8c", "#5d86a6", "#6b8f5a"];

// A cross-section that builds up, bottom first: settled layers sit still, new ones drop in with a little bounce and
// the newest is outlined and its label lit; an icon can stand on top (the thing being built)
const Layers: React.FC<Part<"layers"> & { icons: Record<string, Icon>; box: Box }> = ({
  g,
  lf,
  frames,
  th,
  icons,
  box,
}) => {
  const { fps } = useVideoConfig();
  const head = g.title ? 80 : 20;
  const topIcon = g.top ? icons[g.top] : undefined;
  const iconH = topIcon ? Math.min(240, box.h * 0.3) : 0;
  const panelW = box.w * 0.6;
  const total = g.layers.reduce((n, l) => n + l.thick, 0);
  const unit = Math.min(170, (box.h - head - iconH - 30) / total);
  const fresh = g.layers.length - g.reveal;
  const step = fresh > 0 ? (frames * LAYERS_SHARE) / fresh : 0;
  let y = box.h - 10;
  const rows = g.layers.map((l, i) => {
    const h = l.thick * unit;
    y -= h;
    const n = i - g.reveal; // how many new layers came before this one
    const drop = n < 0 ? 1 : spring({ frame: lf - 4 - n * step, fps, config: { damping: 11 } });
    const called = g.focus ?? (fresh > 0 ? g.layers.length - 1 : -1);
    return { l, i, top: y, h, drop, isNew: n >= 0, newest: i === called };
  });
  const stackTop = rows.at(-1)?.top ?? box.h;
  const lastDrop = rows.at(-1)?.drop ?? 1;
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {g.title && <div style={{ ...LABEL, color: th.dim, textAlign: "center" }}>{g.title}</div>}
      {rows.map(({ l, i, top, h, drop, newest }) => (
        <div key={`${i}:${l.label}`}>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: top - (1 - drop) * 260,
              width: panelW,
              height: h,
              opacity: Math.min(1, drop * 1.5),
              background: l.color ?? STRATA[i % STRATA.length],
              borderRadius: 10,
              boxShadow: "inset 0 -10px 0 rgba(0,0,0,0.16), inset 0 6px 0 rgba(255,255,255,0.12)",
              outline: newest ? `6px solid ${th.accent}` : "3px solid rgba(0,0,0,0.25)",
              outlineOffset: newest ? 2 : -3,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: panelW + 30,
              top: top + h / 2 - 50,
              height: 100,
              right: 0,
              display: "flex",
              alignItems: "center",
              gap: 14,
              opacity: Math.min(1, drop * 1.5),
              transform: `translateX(${(1 - drop) * 40}px)`,
            }}
          >
            <div style={{ width: 26, height: 4, background: newest ? th.accent : th.dim, flexShrink: 0 }} />
            <div
              style={
                {
                  // a long label wraps onto two lines rather than shrinking out of reach
                  fontSize: Math.max(32, fitSize(l.label, box.w - panelW - 80, newest ? 46 : 38)),
                  fontWeight: newest ? 900 : 700,
                  color: newest ? th.accent : th.ink,
                  lineHeight: 1.05,
                  textWrap: "balance",
                } as React.CSSProperties
              }
            >
              {l.label}
            </div>
          </div>
        </div>
      ))}
      {topIcon && (
        <div
          style={{
            position: "absolute",
            left: panelW / 2 - iconH / 2,
            top: stackTop - iconH + 8 - (1 - lastDrop) * 260,
          }}
        >
          <IconImg icon={topIcon} size={iconH} />
        </div>
      )}
    </div>
  );
};

// A graphic kept on screen while the scene plays (the diagram of the build so far): drawn at full size on a virtual
// box, scaled into a card at the top right, so the parts keep their proportions and timing
const INSET_BOX = { w: 700, h: 640 }; // a smaller virtual box draws the parts larger in the card
const Inset: React.FC<{ g: Graphic; frames: number; mood: Mood; icons: Record<string, Icon> }> = ({
  g,
  frames,
  mood,
  icons,
}) => {
  const lf = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const th = THEME[mood];
  const cardW = W * 0.46;
  const k = cardW / INSET_BOX.w;
  const enter = at(lf, 0, 8);
  const box = INSET_BOX;
  return (
    <div
      style={{
        position: "absolute",
        right: 40,
        top: H * 0.115,
        width: cardW,
        height: box.h * k,
        background: th.bg[0],
        backgroundImage: `linear-gradient(${th.grid} 2px, transparent 2px), linear-gradient(90deg, ${th.grid} 2px, transparent 2px)`,
        backgroundSize: "30px 30px",
        borderRadius: 22,
        border: `4px solid ${th.accent}`,
        boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
        overflow: "hidden",
        fontFamily: FONT,
        color: th.ink,
        opacity: enter,
        transform: `translateY(${(1 - enter) * -20}px)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 30,
          top: 24,
          width: box.w - 60,
          height: box.h - 48,
          scale: `${k}`,
          transformOrigin: "0 0",
        }}
      >
        {g.kind === "layers" && (
          <Layers g={g} lf={lf} frames={frames} th={th} icons={icons} box={{ w: box.w - 60, h: box.h - 48 }} />
        )}
        {g.kind === "count" && (
          <Count g={g} lf={lf} frames={frames} th={th} icons={icons} box={{ w: box.w - 60, h: box.h - 48 }} />
        )}
        {g.kind === "scale" && (
          <Scale g={g} lf={lf} frames={frames} th={th} icons={icons} box={{ w: box.w - 60, h: box.h - 48 }} />
        )}
        {g.kind === "chart" && <Chart g={g} lf={lf} frames={frames} th={th} box={{ w: box.w - 60, h: box.h - 48 }} />}
        {g.kind === "formula" && <Formula g={g} lf={lf} frames={frames} th={th} />}
        {g.kind === "list" && <List g={g} lf={lf} frames={frames} th={th} />}
        {g.kind === "icons" && (
          <Icons g={g} lf={lf} frames={frames} th={th} icons={icons} box={{ w: box.w - 60, h: box.h - 48 }} />
        )}
      </div>
    </div>
  );
};
