// Pauses in a TTS clip: read ffmpeg's silencedetect log, plan what to cut, shift the word timings. Pure.
// edge-tts leaves ~1 s after every sentence and ~0.9 s at the end of a clip; that was a quarter of an episode.
import type { Word } from "@vf/contracts";

export type Span = { start: number; end: number };
export const PAUSE = { lead: 0.15, inner: 0.4, tail: 0.15 }; // seconds kept before the first word, per pause, after the last

export function parseSilences(log: string, total: number): Span[] {
  const out: Span[] = [];
  for (const m of log.matchAll(/silence_start: ([\d.]+)(?:[\s\S]*?silence_end: ([\d.]+))?/g))
    out.push({ start: Number(m[1]), end: m[2] === undefined ? total : Number(m[2]) });
  return out;
}

export function planCuts(silences: Span[], total: number, p = PAUSE): Span[] {
  const cuts: Span[] = [];
  for (const s of silences) {
    const end = Math.min(s.end, total);
    if (s.start <= 0.01) {
      if (end > p.lead) cuts.push({ start: 0, end: end - p.lead });
    } else if (end >= total - 0.01) {
      if (end - s.start > p.tail) cuts.push({ start: s.start + p.tail, end });
    } else if (end - s.start > p.inner) cuts.push({ start: s.start + p.inner, end });
  }
  return cuts;
}

// What remains, in order, for ffmpeg atrim + concat.
export function keptSpans(cuts: Span[], total: number): Span[] {
  const out: Span[] = [];
  let at = 0;
  for (const c of cuts) {
    if (c.start > at) out.push({ start: at, end: c.start });
    at = c.end;
  }
  if (total > at) out.push({ start: at, end: total });
  return out;
}

// Each word moves up by the silence removed before it.
export function shiftWords(words: Word[], cuts: Span[]): Word[] {
  const removed = (t: number) => cuts.reduce((n, c) => n + Math.max(0, Math.min(c.end, t) - c.start), 0);
  return words.map((w) => ({ text: w.text, start: w.start - removed(w.start), end: w.end - removed(w.end) }));
}
