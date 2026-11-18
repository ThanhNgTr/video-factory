// Where a room shot's camera stands so everyone in it fits. Pure.
// The camera looks straight down -z, from x = cx unless it is backed against the front wall. Each person is checked
// at their own depth: someone nearer the lens takes more of the frame, so fitting everyone at the group's average
// depth cut the nearest one in half.
const DEG = Math.PI / 180;

export type FitOptions = {
  cx: number;
  fov: number; // vertical, degrees
  aspect: number; // width / height
  pad: number; // half a body plus a margin, metres
  slide: number; // sideways travel of a pan, metres
  push: number; // forward travel of a push: the end of the move must fit too
  minZ: number;
  maxZ: number; // the front wall
};

// A dolly zoom moves the camera and changes the lens so the subject keeps its size and only the depth around it
// changes: distance x tan(fov / 2) stays the same
export function dollyZoomFov(fov: number, from: number, to: number): number {
  return (2 * Math.atan((Math.tan((fov / 2) * DEG) * from) / Math.max(0.1, to))) / DEG;
}

export function fitRoom(people: { x: number; z: number }[], o: FitOptions): { x: number; z: number; fov: number } {
  const t = Math.tan((o.fov / 2) * DEG) * o.aspect; // half the visible width per metre of depth
  const half = (a: { x: number }, cx: number) => Math.abs(a.x - cx) + o.pad + o.slide;
  const need = Math.max(...people.map((a) => a.z + o.push + half(a, o.cx) / t));
  const z = Math.max(o.minZ, Math.min(need, o.maxZ));
  if (z >= need) return { x: o.cx, z, fov: o.fov };
  // backed against the wall: widen the lens instead, from the x that needs the least widening (toward whoever is
  // nearest the lens). The widening is the max of V-shaped terms in x, so it is convex: a ternary search finds it
  const tan = (cx: number) =>
    Math.max(...people.map((a) => half(a, cx) / (Math.max(0.5, z - o.push - a.z) * o.aspect)));
  let lo = Math.min(...people.map((a) => a.x));
  let hi = Math.max(...people.map((a) => a.x));
  for (let i = 0; i < 40; i++) {
    const m1 = lo + (hi - lo) / 3;
    const m2 = hi - (hi - lo) / 3;
    if (tan(m1) <= tan(m2)) hi = m2;
    else lo = m1;
  }
  const x = (lo + hi) / 2;
  return { x, z, fov: (2 * Math.atan(tan(x))) / DEG };
}
