// Shared building blocks: smooth geometry (rounded boxes, spheres, capsules, lathes, tubes, arcs) with soft toon
// shading and no outline. Geometries are cached by their parameters so a component re-rendered every frame never
// rebuilds (or leaks) a buffer.
import type React from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export type V3 = [number, number, number];
export const deg = Math.PI / 180;

// Surface kinds name what a part is made of. The toon look shades them all the same; they are kept so a heavier
// physical-material look (ADR 0007, needs a GPU render machine) can come back by changing Paint alone.
export type Surface = "skin" | "cloth" | "eye" | "matte";

// 32 soft steps from a lifted shadow (0.42) to full light: faces stay readable in the dark, forms still round off.
const TOON = new THREE.DataTexture(
  new Uint8Array(Array.from({ length: 32 }, (_, i) => Math.round(255 * (0.42 + (0.58 * i) / 31)))),
  32,
  1,
  THREE.RedFormat,
);
TOON.minFilter = TOON.magFilter = THREE.NearestFilter;
TOON.needsUpdate = true;

type PaintProps = { c: string; m?: Surface; glow?: boolean; map?: THREE.Texture; side?: THREE.Side; opacity?: number };
const Paint: React.FC<PaintProps> = ({ c, glow, map, side, opacity }) => {
  const transparent = opacity !== undefined && opacity < 1;
  return glow ? (
    <meshBasicMaterial color={c} side={side} transparent={transparent} opacity={opacity ?? 1} />
  ) : (
    <meshToonMaterial
      color={c}
      gradientMap={TOON}
      map={map}
      side={side}
      transparent={transparent}
      opacity={opacity ?? 1}
      depthWrite={!transparent}
    />
  );
};

function cached<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = GEOMETRIES.get(key) as T | undefined;
  if (!g) {
    g = make();
    GEOMETRIES.set(key, g);
  }
  return g;
}
const GEOMETRIES = new Map<string, THREE.BufferGeometry>();

// Mesh density is tuned for CPU WebGL: enough faces that toon bands look round, few enough that a 2-minute
// episode renders in about 20 minutes (ADR 0008). BIG = metres above which a sphere gets the finer mesh.
const BIG = 0.12;
const sphere = (big: boolean, theta = Math.PI) =>
  cached(
    `sphere:${big}:${theta}`,
    () => new THREE.SphereGeometry(1, big ? 40 : 16, big ? 28 : 12, 0, Math.PI * 2, 0, theta),
  );

type Common = { p?: V3; rot?: V3; c: string; m?: Surface; glow?: boolean; noShadow?: boolean; opacity?: number };
// noShadow = lit but casts no shadow: small face details whose shadows read as dirt (a nose shadow looks like stubble).
const castOf = (o: Common) => !o.glow && !o.noShadow && (o.opacity ?? 1) >= 1;

// Rounded box. bare = room shell: receives shadows only.
export const Block: React.FC<Common & { s: V3; r?: number; bare?: boolean; map?: THREE.Texture }> = (o) => {
  const { s, r = 0.03 } = o;
  const rr = Math.max(0, Math.min(r, ...s.map((v) => v / 2 - 0.001)));
  const geo = cached(`rbox:${s.join()}:${rr}`, () => new RoundedBoxGeometry(s[0], s[1], s[2], 3, rr));
  return (
    <mesh geometry={geo} position={o.p} rotation={o.rot} castShadow={castOf(o) && !o.bare} receiveShadow={!o.glow}>
      <Paint c={o.c} m={o.m} glow={o.glow} map={o.map} opacity={o.opacity} />
    </mesh>
  );
};

export const Ball: React.FC<Common & { s: V3 | number }> = (o) => {
  const v: V3 = typeof o.s === "number" ? [o.s, o.s, o.s] : o.s;
  return (
    <mesh
      geometry={sphere(Math.max(...v) > BIG)}
      position={o.p}
      rotation={o.rot}
      scale={v}
      castShadow={castOf(o)}
      receiveShadow={!o.glow}
    >
      <Paint c={o.c} m={o.m} glow={o.glow} opacity={o.opacity} />
    </mesh>
  );
};

// Capsule along local Y, centred on p. len = straight part; total length = len + 2r.
export const Capsule: React.FC<Common & { r: number; len: number; s?: V3 }> = (o) => {
  const geo = cached(`capsule:${o.r}:${o.len}`, () => new THREE.CapsuleGeometry(o.r, Math.max(0.0001, o.len), 6, 20));
  return (
    <mesh geometry={geo} position={o.p} rotation={o.rot} scale={o.s} castShadow={castOf(o)} receiveShadow={!o.glow}>
      <Paint c={o.c} m={o.m} glow={o.glow} opacity={o.opacity} />
    </mesh>
  );
};

// Surface of revolution around local Y from a 2D profile [radius, height][] (hats, skirts, pots).
// sweep = [start, length] in radians, 0 = facing +Z; default is the full turn.
export const Lathe: React.FC<
  Common & { profile: readonly (readonly [number, number])[]; s?: V3; sweep?: readonly [number, number] }
> = (o) => {
  const [phi0, phiLen] = o.sweep ?? [0, Math.PI * 2];
  const key = `lathe:${o.profile.map((q) => q.join(",")).join(";")}:${phi0}:${phiLen}`;
  const geo = cached(
    key,
    () =>
      new THREE.LatheGeometry(
        o.profile.map(([x, y]) => new THREE.Vector2(x, y)),
        32,
        phi0,
        phiLen,
      ),
  );
  return (
    <mesh geometry={geo} position={o.p} rotation={o.rot} scale={o.s} castShadow={castOf(o)} receiveShadow={!o.glow}>
      <Paint c={o.c} m={o.m} glow={o.glow} side={THREE.DoubleSide} opacity={o.opacity} />
    </mesh>
  );
};

// A tube along a smooth Catmull-Rom curve through `points` (scarves, collars, cords).
export const Tube: React.FC<Common & { points: readonly V3[]; r: number; closed?: boolean; s?: V3 }> = (o) => {
  const key = `tube:${o.points.map((q) => q.join(",")).join(";")}:${o.r}:${o.closed ?? false}`;
  const geo = cached(key, () => {
    const curve = new THREE.CatmullRomCurve3(
      o.points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
      o.closed ?? false,
      "catmullrom",
      0.5,
    );
    return new THREE.TubeGeometry(curve, 48, o.r, 12, o.closed ?? false);
  });
  return (
    <mesh geometry={geo} position={o.p} rotation={o.rot} scale={o.s} castShadow={castOf(o)} receiveShadow={!o.glow}>
      <Paint c={o.c} m={o.m} glow={o.glow} opacity={o.opacity} />
    </mesh>
  );
};

// A flat plate cut from a 2D outline [x, y][] in the local XY plane (eyelids, decals).
export const Plate: React.FC<Common & { outline: readonly (readonly [number, number])[] }> = (o) => {
  const key = `plate:${o.outline.map((q) => q.map((v) => v.toFixed(5)).join(",")).join(";")}`;
  const geo = cached(
    key,
    () => new THREE.ShapeGeometry(new THREE.Shape(o.outline.map(([x, y]) => new THREE.Vector2(x, y))), 1),
  );
  return (
    <mesh geometry={geo} position={o.p} rotation={o.rot} castShadow={castOf(o)} receiveShadow={!o.glow}>
      <Paint c={o.c} m={o.m} glow={o.glow} side={THREE.DoubleSide} opacity={o.opacity} />
    </mesh>
  );
};

// Part of a torus: an arc of `arc` radians starting on +X and turning counter-clockwise (brows, lash lines, smiles).
export const Arc: React.FC<Common & { radius: number; tube: number; arc: number; s?: V3 }> = (o) => {
  const geo = cached(
    `arc:${o.radius}:${o.tube}:${o.arc}`,
    () => new THREE.TorusGeometry(o.radius, o.tube, 8, 32, o.arc),
  );
  return (
    <mesh geometry={geo} position={o.p} rotation={o.rot} scale={o.s} castShadow={castOf(o)} receiveShadow={!o.glow}>
      <Paint c={o.c} m={o.m} glow={o.glow} opacity={o.opacity} />
    </mesh>
  );
};

// Solid cylinder for set props (pillars, pots). With `sweep` = [thetaStart, thetaLength] (0 = facing +Z) it is an open,
// double-sided curved shell instead (an apron wrapped round a skirt). r = top radius, r2 = bottom radius.
export const Cylinder: React.FC<
  Common & { r: number; h: number; r2?: number; sweep?: readonly [number, number]; s?: V3 }
> = (o) => {
  const [t0, tLen] = o.sweep ?? [0, Math.PI * 2];
  const open = o.sweep !== undefined;
  const geo = cached(
    `cyl:${o.r}:${o.r2 ?? o.r}:${o.h}:${t0}:${tLen}`,
    () => new THREE.CylinderGeometry(o.r, o.r2 ?? o.r, o.h, 32, 1, open, t0, tLen),
  );
  return (
    <mesh geometry={geo} position={o.p} rotation={o.rot} scale={o.s} castShadow={castOf(o)} receiveShadow={!o.glow}>
      <Paint c={o.c} m={o.m} glow={o.glow} side={open ? THREE.DoubleSide : undefined} />
    </mesh>
  );
};

// Part of a sphere (from the pole down to `theta` radians), scaled to an ellipsoid: hoods, caps.
// double = paint the inside too (a hood seen from the front). rim = a rolled edge of that thickness (metres).
export const Dome: React.FC<Common & { s: V3; theta?: number; double?: boolean; rim?: number }> = (o) => {
  const theta = o.theta ?? 1.2;
  const mean = (o.s[0] + o.s[1] + o.s[2]) / 3;
  const tube = (o.rim ?? 0) / mean;
  const rimGeo =
    tube > 0 ? cached(`rim:${theta}:${tube}`, () => new THREE.TorusGeometry(Math.sin(theta), tube, 10, 48)) : undefined;
  return (
    <group position={o.p} rotation={o.rot}>
      <group scale={o.s}>
        {/* a double-sided shell shadowing itself gives striped acne: it only receives */}
        <mesh geometry={sphere(true, theta)} castShadow={castOf(o) && !o.double} receiveShadow={!o.glow}>
          <Paint c={o.c} m={o.m} glow={o.glow} side={o.double ? THREE.DoubleSide : undefined} />
        </mesh>
        {rimGeo && (
          <mesh
            geometry={rimGeo}
            position={[0, Math.cos(theta), 0]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow={castOf(o)}
          >
            <Paint c={o.c} m={o.m} glow={o.glow} />
          </mesh>
        )}
      </group>
    </group>
  );
};

// Darken (k < 1) or lighten (k > 1) a #rrggbb colour.
export const shade = (hex: string, k: number) =>
  `#${[1, 3, 5]
    .map((i) =>
      Math.min(255, Math.round(Number.parseInt(hex.slice(i, i + 2), 16) * k))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
