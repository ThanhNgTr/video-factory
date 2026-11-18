// Where a set's furniture stands, shared by the director's checks and the renderer's camera. Pure.
import type { Set3D } from "./library.ts";

type Prop = Set3D["props"][number];
type V3 = [number, number, number];

// size when a prop leaves it out: [width, height, depth]; a cylinder's width is its radius
export const PROP_SIZE: Record<Prop["type"], V3> = {
  box: [1, 1, 1],
  cylinder: [0.2, 2.6, 0],
  shelf: [3, 2.2, 0.5],
  counter: [2.4, 1.05, 0.7],
  door: [1, 2.1, 0],
  window: [1.4, 1.2, 0],
  sofa: [2, 0.9, 0.9],
  plant: [0.5, 1.3, 0.5],
  elevator: [1.6, 2.4, 0],
  painting: [1, 0.8, 0],
  rug: [3, 0, 2],
  chair: [0.5, 0.95, 0.5],
};

// props with a body on the floor; doors, windows, paintings and elevators sit flat on a wall, rugs are walked on
const SOLID = new Set<Prop["type"]>(["box", "cylinder", "shelf", "counter", "sofa", "plant", "chair"]);

export type Obstacle = { i: number; type: Prop["type"]; min: V3; max: V3 }; // i: index in set.props

export function obstacles(set: Set3D): Obstacle[] {
  return set.props.flatMap((p, i) => {
    if (!SOLID.has(p.type)) return [];
    const [w, h, d] = p.size ?? PROP_SIZE[p.type];
    const [hw, hd] = p.type === "cylinder" ? [w, w] : [w / 2, d / 2];
    const c = Math.abs(Math.cos((p.rotY * Math.PI) / 180));
    const s = Math.abs(Math.sin((p.rotY * Math.PI) / 180));
    const ex = hw * c + hd * s;
    const ez = hw * s + hd * c;
    const [x, y, z] = p.pos;
    return [{ i, type: p.type, min: [x - ex, y, z - ez], max: [x + ex, y + h, z + ez] }];
  });
}

// Liang-Barsky: does the segment a->b pass through the box [min, max]? Any number of axes.
export function segmentHitsBox(a: number[], b: number[], min: number[], max: number[]): boolean {
  let t0 = 0;
  let t1 = 1;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const lo = min[i] ?? 0;
    const hi = max[i] ?? 0;
    const d = (b[i] ?? 0) - ai;
    if (Math.abs(d) < 1e-9) {
      if (ai < lo || ai > hi) return false;
      continue;
    }
    const u = (lo - ai) / d;
    const v = (hi - ai) / d;
    t0 = Math.max(t0, Math.min(u, v));
    t1 = Math.min(t1, Math.max(u, v));
    if (t0 > t1) return false;
  }
  return true;
}

const inside = (p: number[], min: number[], max: number[]) =>
  p.every((v, i) => v >= (min[i] ?? 0) && v <= (max[i] ?? 0));

// The floor prop a character would walk through going straight from one spot to another ([x, z] each).
// Props the character already stands against at either end do not count: the set was built that way.
export function walkBlocker(
  set: Set3D,
  from: [number, number],
  to: [number, number],
  body = 0.2,
): Obstacle | undefined {
  return obstacles(set).find((o) => {
    if (o.min[1] > 0.5) return false; // on a counter or shelf, not on the floor
    const min = [o.min[0] - body, o.min[2] - body];
    const max = [o.max[0] + body, o.max[2] + body];
    return !inside(from, min, max) && !inside(to, min, max) && segmentHitsBox(from, to, min, max);
  });
}

// Does furniture hide `target` from a camera at `eye`?
export const sightBlocked = (boxes: readonly Obstacle[], eye: V3, target: V3): boolean =>
  boxes.some((o) => !inside(target, o.min, o.max) && segmentHitsBox(eye, target, o.min, o.max));

// Floor props on the camera's side of the person a close shot frames, more than `keep` metres from them: the shot
// leaves them out, the way a film crew moves a stool out of frame. The person's own counter or stool stays. A prop
// more than 60 degrees off the camera's line is out of a close shot's frame anyway, so it is never touched.
export function foreground(set: Set3D, subject: [number, number], camera: [number, number], keep = 1): number[] {
  const [sx, sz] = subject;
  const vx = camera[0] - sx;
  const vz = camera[1] - sz;
  const vl = Math.hypot(vx, vz);
  return obstacles(set)
    .filter((o) => {
      const cx = (o.min[0] + o.max[0]) / 2 - sx;
      const cz = (o.min[2] + o.max[2]) / 2 - sz;
      const near = Math.hypot(Math.max(o.min[0] - sx, 0, sx - o.max[0]), Math.max(o.min[2] - sz, 0, sz - o.max[2]));
      return near > keep && cx * vx + cz * vz > 0.5 * vl * Math.hypot(cx, cz);
    })
    .map((o) => o.i);
}

// How someone leaving the room goes: to the door (or elevator) nearest `at`, within `reach` metres, and on to `out`,
// just beyond the wall it sits on, so the wall hides them as they pass. Undefined when no door is near.
export function exitPoint(
  set: Set3D,
  at: [number, number],
  reach = 2.5,
): { door: [number, number]; out: [number, number] } | undefined {
  const door = set.props
    .filter((p) => p.type === "door" || p.type === "elevator")
    .map((p) => ({ x: p.pos[0], z: p.pos[2], d: Math.hypot(p.pos[0] - at[0], p.pos[2] - at[1]) }))
    .filter((p) => p.d <= reach)
    .sort((a, b) => a.d - b.d)[0];
  if (!door) return undefined;
  const { w, back, front } = set.room;
  const beyond = 0.7;
  const walls: [number, [number, number]][] = [
    [w / 2 - door.x, [w / 2 + beyond, door.z]],
    [door.x + w / 2, [-w / 2 - beyond, door.z]],
    [door.z - back, [door.x, back - beyond]],
    [front - door.z, [door.x, front + beyond]],
  ];
  const out = walls.sort((a, b) => a[0] - b[0])[0]?.[1];
  return out && { door: [door.x, door.z], out };
}

const WALL_PROPS = new Set<Prop["type"]>(["door", "window", "painting", "elevator"]);

// What a set Claude designed must satisfy before anyone stands in it (ADR 0018): everything inside the room, wall
// props on a wall, spots on open floor, and the front clear for the camera.
export function checkSetDesign(set: Set3D): string[] {
  const errs: string[] = [];
  const { w, h, front, back } = set.room;
  if (w < 4 || w > 16 || h < 2.6 || h > 5 || front - back < 7 || front - back > 20)
    errs.push("room: w 4-16, h 2.6-5, and 7-20 m from back to front");
  const inside = (x: number, z: number, margin = 0) =>
    Math.abs(x) <= w / 2 - margin && z >= back + margin && z <= front - margin;
  set.props.forEach((p, i) => {
    const [x, , z] = p.pos;
    if (!inside(x, z)) errs.push(`props[${i}] (${p.type}) at [${x}, ${z}] is outside the room`);
    if (WALL_PROPS.has(p.type)) {
      const gap = Math.min(w / 2 - Math.abs(x), z - back);
      if (gap > 0.3) errs.push(`props[${i}] (${p.type}) must sit flat on the back or a side wall`);
    }
  });
  const boxes = obstacles(set);
  for (const b of boxes)
    if (b.max[1] > 1 && b.max[2] > front - 2.5)
      errs.push(
        `a ${b.type} ${b.max[1].toFixed(1)} m tall stands in the front 2.5 m: the camera is there, move it back`,
      );
  const ids = new Set<string>();
  for (const s of set.spots) {
    if (ids.has(s.id)) errs.push(`spot "${s.id}" is listed twice`);
    ids.add(s.id);
    const [x, z] = s.pos;
    if (!inside(x, z, 0.4)) errs.push(`spot "${s.id}" is outside the room or against a wall`);
    const body = 0.15; // half a body: closer than this, the card cuts into the furniture
    const hit = boxes.find(
      (b) => x > b.min[0] - body && x < b.max[0] + body && z > b.min[2] - body && z < b.max[2] + body,
    );
    // a seat spot sits in its chair, sofa, stool or bed
    if (hit && !s.seat) errs.push(`spot "${s.id}" stands inside or against a ${hit.type}: move it to open floor`);
  }
  if (set.spots.length < 4) errs.push("at least 4 spots");
  // a work spot fenced in by furniture (behind a counter) is fine: the director's walk check keeps people off
  // impossible paths
  if (!set.lamps.length) errs.push("at least one ceiling lamp");
  return errs;
}
