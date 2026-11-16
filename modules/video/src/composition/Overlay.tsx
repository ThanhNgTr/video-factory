// 2D layer: vignette, HUD, text cards, word-by-word captions, end card. Pure function of (props, frame).

import type React from "react";
import { AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { captionChunks } from "../domain/timeline.ts";
import type { RenderProps } from "./props.ts";

const FONT = '"Noto Sans", "DejaVu Sans", "Liberation Sans", sans-serif';
const HIGHLIGHT = "#ffd60a";
const RED = "#e63946";
const outlined = (size: number): React.CSSProperties => ({
  fontFamily: FONT,
  fontWeight: 900,
  fontSize: size,
  color: "#fff",
  textAlign: "center",
  lineHeight: 1.12,
  textTransform: "uppercase",
  WebkitTextStroke: `${size * 0.14}px #111`,
  paintOrder: "stroke fill",
  textShadow: "0 4px 18px rgba(0,0,0,0.6)",
});
// "an *old man*" -> old man in yellow
const marked = (t: string) =>
  t.split("*").map((part, i) => (
    <span key={`${i % 2 ? "hi" : "lo"}:${part}`} style={{ color: i % 2 ? HIGHLIGHT : undefined }}>
      {part}
    </span>
  ));
const isRule = (t: string) => /^rule\s*\d/i.test(t.replaceAll("*", ""));

export const Overlay: React.FC<{ p: RenderProps }> = ({ p }) => {
  const f = useCurrentFrame();
  const { height: H, width: W } = useVideoConfig();
  const chunks = captionChunks(p.timeline.captions, (id) => {
    const r = p.timeline.shots.find((s) => s.id === id);
    return r ? r.from + r.frames : 0;
  });
  const chunk = chunks.find((c) => f >= c.from && f < c.to);
  const last = p.timeline.shots.at(-1);
  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      {p.scene.mood !== "bright" && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse at 50% 45%, transparent 35%, rgba(0,0,0,${p.scene.mood === "horror" ? 0.85 : 0.6}) 100%)`,
          }}
        />
      )}
      {p.timeline.shots.map((row) => {
        const s = p.scene.shots.find((sh) => sh.id === row.id);
        if (!s) return null;
        return (
          <Sequence key={row.id} from={row.from} durationInFrames={row.frames} layout="none">
            <ShotLayer
              p={p}
              clock={row.clock}
              counter={row.counter}
              text={s.text}
              H={H}
              W={W}
              isLast={row.id === last?.id}
            />
          </Sequence>
        );
      })}
      {chunk && (
        <AbsoluteFill
          style={{ top: H * 0.6, height: H * 0.16, alignItems: "center", justifyContent: "center", padding: "0 60px" }}
        >
          <div style={outlined(chunk.words.length > 2 ? 72 : 84)}>
            {chunk.words.map((w) => (
              <span
                key={`${w.frame}:${w.text}`}
                style={{ color: w.highlight ? HIGHLIGHT : "#fff", opacity: f >= w.frame ? 1 : 0.35, marginRight: 18 }}
              >
                {w.text}
              </span>
            ))}
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

const ShotLayer: React.FC<{
  p: RenderProps;
  clock?: string;
  counter?: number;
  text?: string;
  H: number;
  W: number;
  isLast: boolean;
}> = ({ p, clock, counter, text, H, W, isLast }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cardIn = spring({ frame: f, fps, config: { damping: 12 } });
  const hud = p.scene.hud;
  const rule = text && isRule(text);
  return (
    <AbsoluteFill>
      {hud && (
        <AbsoluteFill
          style={{
            padding: `${H * 0.035}px 56px`,
            flexDirection: "row",
            justifyContent: "space-between",
            color: "#fff",
            textShadow: "0 2px 8px #000",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: 3,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span
                style={{ width: 14, height: 14, borderRadius: 7, background: RED, opacity: f % 30 < 18 ? 1 : 0.3 }}
              />
              {hud.title.toUpperCase()}
            </div>
            {clock && <div style={{ fontSize: 66, fontWeight: 900, letterSpacing: 1 }}>{clock}</div>}
          </div>
          {hud.counterLabel && counter !== undefined && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 3 }}>{hud.counterLabel.toUpperCase()}</div>
              <div style={{ fontSize: 66, fontWeight: 900, color: RED }}>{counter}</div>
            </div>
          )}
        </AbsoluteFill>
      )}
      {text && !rule && !(isLast && p.choice) && (
        <AbsoluteFill
          style={{
            top: H * (hud ? 0.12 : 0.06),
            height: H * 0.14,
            alignItems: "center",
            justifyContent: "center",
            padding: "0 60px",
          }}
        >
          <div style={{ ...outlined(hud ? 64 : 88), transform: `scale(${cardIn}) rotate(${(1 - cardIn) * -5}deg)` }}>
            {marked(text)}
          </div>
        </AbsoluteFill>
      )}
      {text && rule && (
        <AbsoluteFill style={{ top: H * 0.3, alignItems: "center", padding: "0 80px" }}>
          <div
            style={{
              transform: `scale(${cardIn})`,
              background: "#f6f1e7",
              borderRadius: 18,
              padding: "26px 34px",
              maxWidth: W - 160,
              boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
            }}
          >
            <div
              style={{
                display: "inline-block",
                background: RED,
                color: "#fff",
                fontSize: 24,
                fontWeight: 800,
                letterSpacing: 2,
                padding: "4px 12px",
                borderRadius: 6,
                marginBottom: 10,
              }}
            >
              SURVIVAL RULE
            </div>
            <div style={{ fontSize: 48, fontWeight: 800, color: "#161616", lineHeight: 1.15 }}>
              {marked(text.replace(/^rule\s*\d+\s*[:.-]\s*/i, ""))}
            </div>
          </div>
        </AbsoluteFill>
      )}
      {isLast && p.choice && (
        <AbsoluteFill style={{ top: H * 0.14, alignItems: "center", padding: "0 70px", gap: 22 }}>
          <div style={outlined(92)}>Part {shotPart(p) ?? 2}</div>
          <div style={{ ...outlined(44), color: HIGHLIGHT }}>{text ? marked(text) : "COMMENT 1 OR 2?"}</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#fff", letterSpacing: 2, opacity: 0.85 }}>
            MOST VOTES DECIDES THE NEXT PART
          </div>
          {[p.choice.option1, p.choice.option2].map((o, i) => (
            <div
              key={o}
              style={{
                transform: `translateX(${(1 - cardIn) * (i ? 300 : -300)}px)`,
                display: "flex",
                alignItems: "center",
                gap: 16,
                background: "rgba(10,10,14,0.85)",
                border: "3px solid #fff",
                borderRadius: 999,
                padding: "14px 30px",
                color: "#fff",
                fontSize: 38,
                fontWeight: 800,
                marginTop: i ? 0 : 30,
              }}
            >
              <span
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 27,
                  background: i ? "#4cc9f0" : RED,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 32,
                }}
              >
                {i + 1}
              </span>
              {o.toUpperCase()}
            </div>
          ))}
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

// "The Night Desk - Part 1" -> 2 (the part the vote decides)
function shotPart(p: RenderProps): number | undefined {
  const m = p.scene.title.match(/part\s*(\d+)/i);
  return m?.[1] ? Number(m[1]) + 1 : undefined;
}
