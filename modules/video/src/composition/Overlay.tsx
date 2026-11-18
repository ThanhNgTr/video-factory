// 2D layer: vignette, HUD, text cards, word-by-word captions, end card. Pure function of (props, frame).
// ds-allow-hardcode:start -- caption and HUD styling burned into 1080x1920 video frames, not UI tokens

import type React from "react";
import { AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { superscripts } from "../domain/numbers.ts";
import { captionChunks } from "../domain/timeline.ts";
import { voteLabels, voteText } from "../domain/vote.ts";
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
// "an *old man*" -> old man in yellow; "x^2" -> x with a raised 2, as the graphics write it
const marked = (t: string) =>
  t.split("*").map((part, i) => (
    <span key={`${i % 2 ? "hi" : "lo"}:${part}`} style={{ color: i % 2 ? HIGHLIGHT : undefined }}>
      {superscripts(part).map((piece, j) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list that never reorders; pieces may repeat
        <span key={`${j}:${piece.text}`} style={piece.up ? { fontSize: "0.6em", verticalAlign: "0.8em" } : undefined}>
          {piece.text}
        </span>
      ))}
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
      {p.timeline.shots.map((row, i) => {
        const s = p.scene.shots.find((sh) => sh.id === row.id);
        if (!s) return null;
        const next = p.scene.shots.find((sh) => sh.id === p.timeline.shots[i + 1]?.id);
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
              isFirst={row.id === p.timeline.shots[0]?.id}
              hasInset={!!s.inset}
              transition={s.transition}
              fadeOut={next?.transition === "fade"}
              frames={row.frames}
            />
          </Sequence>
        );
      })}
      {chunk && (
        // captions wear the format's style (ADR 0025): an explainer reads in a quiet lower-third pill, a skit in
        // bold caps a little lower than the series' shout
        <AbsoluteFill
          style={{
            top: H * (p.kind === "explainer" ? 0.7 : p.kind === "skit" ? 0.64 : 0.6),
            height: H * 0.16,
            alignItems: "center",
            justifyContent: "center",
            padding: "0 60px",
          }}
        >
          {/* the word spans have no spaces between them, so wrapping must come from flex */}
          <div
            style={{
              ...outlined(chunk.words.length > 2 ? 72 : 84),
              ...(p.kind === "explainer"
                ? {
                    fontSize: chunk.words.length > 2 ? 54 : 62,
                    fontWeight: 700,
                    textTransform: "none",
                    WebkitTextStroke: "0",
                    textShadow: "none",
                    background: "rgba(10,12,20,0.72)",
                    borderRadius: 20,
                    padding: "14px 30px",
                  }
                : p.kind === "skit"
                  ? { fontSize: chunk.words.length > 2 ? 66 : 76 }
                  : {}),
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
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
  isFirst: boolean;
  hasInset: boolean;
  transition: "cut" | "fade" | "flash" | "whip";
  fadeOut: boolean;
  frames: number;
}> = ({ p, clock, counter, text, H, W, isLast, isFirst, hasInset, transition, fadeOut, frames }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cardIn = spring({ frame: f, fps, config: { damping: 12 } });
  const hud = p.scene.hud;
  const rule = text && isRule(text);
  // the vote in the script's own words and labels (A/B or 1/2), as the narrator says it
  const vote = isLast ? voteText(p.scene) : undefined;
  const labels = voteLabels(vote);
  return (
    <AbsoluteFill>
      {/* how the shot comes in (ADR 0025): through black, or on a white flash; a fade also takes the shot before out */}
      {/* a whip pan smears as it turns (ADR 0026): the blur dies with the turn, over 8 frames */}
      {transition === "whip" && f < 8 && (
        <AbsoluteFill style={{ backdropFilter: `blur(${(18 * (1 - f / 8)).toFixed(1)}px)` }} />
      )}
      {transition === "fade" && f < 8 && <AbsoluteFill style={{ background: "#000", opacity: 1 - f / 8 }} />}
      {fadeOut && f >= frames - 8 && <AbsoluteFill style={{ background: "#000", opacity: (f - (frames - 8)) / 8 }} />}
      {transition === "flash" && f < 5 && <AbsoluteFill style={{ background: "#fff", opacity: 0.9 * (1 - f / 5) }} />}
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
      {text && !rule && !(isLast && p.choice) && !isFirst && (
        // a step's title is a badge under the HUD, in a style the captions do not share: the middle of the frame
        // stays free for the picture (only the opening card is big)
        // beside an inset card (top right) the badge keeps to the left half
        // (AbsoluteFill is 100% wide, so the width is set, not `right`)
        <AbsoluteFill
          style={{ top: H * 0.115, left: 56, width: hasInset ? W * 0.44 : W - 112, alignItems: "flex-start" }}
        >
          <div
            style={{
              transform: `scale(${cardIn})`,
              transformOrigin: "left center",
              background: "rgba(15,17,26,0.86)",
              color: "#fff",
              fontFamily: FONT,
              fontWeight: 800,
              fontSize: 44,
              lineHeight: 1.15,
              textTransform: "uppercase",
              letterSpacing: 1,
              padding: "12px 26px",
              borderRadius: 18,
              borderLeft: `10px solid ${HIGHLIGHT}`,
            }}
          >
            {marked(text)}
          </div>
        </AbsoluteFill>
      )}
      {text && !rule && !(isLast && p.choice) && isFirst && (
        // beside an inset card (top right) the opening card keeps to the left half
        <AbsoluteFill
          style={{
            top: H * (hud ? 0.12 : 0.06),
            height: H * 0.14,
            width: hasInset ? W * 0.5 : W,
            alignItems: "center",
            justifyContent: "center",
            padding: hasInset ? "0 20px 0 50px" : "0 60px",
          }}
        >
          <div style={{ ...outlined(hud ? 64 : 88), transform: `scale(${cardIn}) rotate(${(1 - cardIn) * -5}deg)` }}>
            {marked(text)}
          </div>
        </AbsoluteFill>
      )}
      {text && rule && (
        // just under the HUD: lower, it covered the eyes in close-ups
        <AbsoluteFill style={{ top: H * 0.12, alignItems: "center", padding: "0 80px" }}>
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
        // compact: everything above about 37% of the height, so the faces below stay clear (the camera tilts up too)
        <AbsoluteFill style={{ top: H * 0.13, alignItems: "center", padding: "0 56px", gap: 12 }}>
          {/* a series part announces the next part; a one-off video just asks */}
          {shotPart(p) && <div style={outlined(76)}>Part {shotPart(p)}</div>}
          <div style={{ ...outlined(shotPart(p) ? 40 : 58), color: HIGHLIGHT }}>
            {vote ? marked(vote) : `COMMENT ${labels[0]} OR ${labels[1]}?`}
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#fff", letterSpacing: 2, opacity: 0.85 }}>
            {shotPart(p) ? "MOST VOTES DECIDES THE NEXT PART" : `COMMENT ${labels[0]} OR ${labels[1]}`}
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
                padding: "10px 24px",
                color: "#fff",
                fontSize: 32,
                fontWeight: 800,
                marginTop: i ? 0 : 12,
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  width: 46,
                  height: 46,
                  borderRadius: 23,
                  background: i ? "#4cc9f0" : RED,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                }}
              >
                {labels[i]}
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
// ds-allow-hardcode:end
