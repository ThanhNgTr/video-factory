// Parsers for ffmpeg detector output and the pass/fail rule. Pure.
import type { Qa } from "@vf/contracts";

type Issue = Qa["issues"][number];

export function parseBlackdetect(log: string, minSeconds = 1.5): Issue[] {
  const out: Issue[] = [];
  for (const m of log.matchAll(/black_start:([\d.]+) black_end:([\d.]+) black_duration:([\d.]+)/g)) {
    const dur = Number(m[3]);
    if (dur >= minSeconds)
      out.push({ code: "black-frames", at: Number(m[1]), detail: `${dur.toFixed(1)}s of black from ${m[1]}s` });
  }
  return out;
}

export function parseSilencedetect(log: string, minSeconds = 6): Issue[] {
  const out: Issue[] = [];
  for (const m of log.matchAll(/silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+) \| silence_duration: ([\d.]+)/g)) {
    const dur = Number(m[3]);
    if (dur >= minSeconds)
      out.push({ code: "silence", at: Number(m[1]), detail: `${dur.toFixed(1)}s of silence from ${m[1]}s` });
  }
  return out;
}

export function judge(o: {
  seconds: number;
  expectedSeconds: number;
  issues: Issue[];
  lengthRange: { min: number; max: number };
}): Qa {
  const issues = [...o.issues];
  if (Math.abs(o.seconds - o.expectedSeconds) > 0.5)
    issues.push({
      code: "length-mismatch",
      detail: `video is ${o.seconds.toFixed(2)}s, timeline says ${o.expectedSeconds.toFixed(2)}s`,
    });
  if (o.seconds < o.lengthRange.min || o.seconds > o.lengthRange.max)
    issues.push({
      code: "length-out-of-range",
      detail: `${o.seconds.toFixed(1)}s not in ${o.lengthRange.min}-${o.lengthRange.max}s`,
    });
  return { schemaVersion: 1, pass: issues.length === 0, seconds: o.seconds, issues };
}
