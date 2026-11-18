// Samples an action's keyframes at a time. Pure: used by the renderer on every frame.
import type { Action, Face } from "@vf/contracts";

export type Pose = {
  x: number;
  y: number;
  rot: number;
  sx: number;
  sy: number;
  armL: number;
  armR: number;
  legL: number;
  legR: number;
  kneeL: number;
  kneeR: number;
  face?: Face;
};

export const REST: Pose = {
  x: 0,
  y: 0,
  rot: 0,
  sx: 1,
  sy: 1,
  armL: 20,
  armR: 20,
  legL: 0,
  legR: 0,
  kneeL: 0,
  kneeR: 0,
};
const NUM = ["x", "y", "rot", "sx", "sy", "armL", "armR", "legL", "legR", "kneeL", "kneeR"] as const;

// Fill every key so a value missing in a key carries over from the previous one.
function keysOf(a: Action): { t: number; p: Pose }[] {
  const sorted = [...a.keys].sort((k1, k2) => k1.t - k2.t);
  let prev: Pose = { ...REST };
  return sorted.map((k) => {
    const p: Pose = { ...prev, face: k.face ?? prev.face };
    for (const n of NUM) {
      const v = k[n];
      if (v !== undefined) p[n] = v;
    }
    prev = p;
    return { t: k.t, p };
  });
}

// Catmull-Rom through the keys: velocity is continuous at every key, so loops do not stall four times a cycle.
export function samplePose(a: Action | undefined, tSec: number): Pose {
  if (!a) return REST;
  const keys = keysOf(a);
  const first = keys[0];
  if (!first) return REST;
  const u = a.loop ? (tSec / a.dur) % 1 : Math.min(tSec / a.dur, 1);
  const i = keys.findLastIndex((k) => k.t <= u);
  if (i < 0) return first.p;
  const k0 = keys[i];
  const k1 = keys[i + 1];
  if (!k0 || !k1) return (k0 ?? first).p;
  // neighbours for the tangents; a loop's last key repeats its first, so wrap past that duplicate
  const n = keys.length;
  const at = (j: number) =>
    (a.loop ? keys[((j % (n - 1)) + (n - 1)) % (n - 1)] : keys[Math.max(0, Math.min(n - 1, j))]) ?? k0;
  const p0 = at(i - 1).p;
  const p3 = at(i + 2).p;
  const w = (u - k0.t) / (k1.t - k0.t || 1);
  const out: Pose = { ...k0.p };
  for (const v of NUM) {
    const [a0, a1, a2, a3] = [p0[v], k0.p[v], k1.p[v], p3[v]];
    out[v] =
      0.5 *
      (2 * a1 + (-a0 + a2) * w + (2 * a0 - 5 * a1 + 4 * a2 - a3) * w * w + (-a0 + 3 * a1 - 3 * a2 + a3) * w * w * w);
  }
  return out;
}

// Blend two poses (used when an actor walks: pose follows the action, position follows the path).
export const lerpPose = (a: Pose, b: Pose, w: number): Pose => {
  const out: Pose = { ...a, face: w < 0.5 ? a.face : b.face };
  for (const n of NUM) out[n] = a[n] + (b[n] - a[n]) * w;
  return out;
};
