// What a story prop does during a shot (ADR 0022): its lift, lean, scale and opacity at a frame. Pure.
import type { PROP_MOTIONS } from "@vf/contracts";

export type PropMotion = (typeof PROP_MOTIONS)[number];
export type PropState = { y: number; rot: number; scale: number; opacity: number }; // metres, degrees, 0..1, 0..1

const REST: PropState = { y: 0, rot: 0, scale: 1, opacity: 1 };
const clamp01 = (u: number) => Math.min(1, Math.max(0, u));
const easeOut = (u: number) => 1 - (1 - u) ** 3;
const DROP_FROM = 3; // metres above the floor
export const DROP_SECONDS = 0.5; // the fall; the thud cue lands here

// `at` is the second of the shot the motion starts; `size` the prop's height, so a big thing sinks and bobs more
export function propState(motion: PropMotion, lf: number, fps: number, at: number, size: number): PropState {
  const t = lf / fps - at; // seconds since the motion started (negative: not yet)
  switch (motion) {
    case "still":
      return REST;
    case "drop": {
      // gravity down, one small bounce, then it sits; before `at` it is not there yet
      if (t < 0) return { ...REST, y: DROP_FROM, opacity: 0 };
      const u = clamp01(t / DROP_SECONDS);
      const bounce = t > DROP_SECONDS && t < DROP_SECONDS + 0.3 ? Math.sin((Math.PI * (t - DROP_SECONDS)) / 0.3) : 0;
      return { ...REST, y: DROP_FROM * (1 - u) ** 2 + 0.12 * size * bounce };
    }
    case "sink": {
      const u = easeOut(clamp01(t / 1.5));
      return { ...REST, y: -0.6 * size * u, rot: 12 * u };
    }
    case "tilt":
      return { ...REST, rot: 18 * easeOut(clamp01(t / 0.6)) };
    case "shake":
      return t < 0 || t > 0.8 ? REST : { ...REST, rot: Math.sin(t * 40) * 5 * (1 - t / 0.8) };
    case "float":
      return { ...REST, y: 0.1 * size + 0.08 * size * Math.sin((lf / fps) * 2.4) };
    case "grow": {
      // pops up with a little overshoot
      if (t < 0) return { ...REST, scale: 0, opacity: 0 };
      const u = clamp01(t / 0.5);
      return { ...REST, scale: u < 1 ? easeOut(u) * (1 + 0.12 * Math.sin(Math.PI * u)) : 1 };
    }
    case "vanish": {
      if (t < 0) return REST;
      const u = clamp01(t / 0.4);
      return { ...REST, scale: 1 - u, opacity: 1 - u };
    }
  }
}
