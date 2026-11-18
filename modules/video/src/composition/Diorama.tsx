// A 3D build diorama (ADR 0021): a fixed camera looks along a strip (a road) running into the distance; the ground
// is cut away at the front, so the layers laid under the strip show in section. Everything is a pure function of the
// shot's data and the frame: the ground and each layer are cross-section profiles extruded along the strip, so their
// front cap is the cutaway and their top is the surface; rocks, rain and snow come from seeded random numbers.
// ds-allow-hardcode:start -- 3D materials burned into video frames, not UI tokens
import { useThree } from "@react-three/fiber";
import type { Diorama as DioramaData } from "@vf/contracts";
import type React from "react";
import { useMemo } from "react";
import { Easing, random, spring, useVideoConfig } from "remotion";
import * as THREE from "three";
import { dioramaDrops, START } from "../domain/graphic-timing.ts";
import { Weather } from "./Weather.tsx";

const FRONT = 2; // z of the cutaway face
const BACK = -90;
const LEN = FRONT - BACK;
const RW = 3.4; // strip width
const LW = RW + 0.8; // the trench the layers fill
const DEEP = 7; // soil below ground level

const COLOR: Record<string, string> = {
  soil: "#8a5533",
  clay: "#a0582f",
  sand: "#d6bf86",
  gravel: "#a3a3a0",
  stones: "#8d8d88",
  "crushed-rock": "#b5b5b0",
  concrete: "#c9c8c2",
  asphalt: "#2f3034",
  water: "#3d7fc2",
  logs: "#8a5a32",
  ice: "#e3f4ff",
  grass: "#5aa83b",
  dirt: "#b98656",
  mud: "#5a4230",
};

// one seeded texture per kind, made once per render tab
const textures = new Map<string, THREE.Texture>();
function streaks(kind: string, base: string): THREE.Texture {
  const hit = textures.get(kind);
  if (hit) return hit;
  const W = 128;
  const H = 128;
  const data = new Uint8Array(W * H * 4);
  const c = new THREE.Color(base);
  let seed = [...kind].reduce((h, ch) => h * 31 + ch.charCodeAt(0), 7) % 2147483647;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const cols = Array.from({ length: W }, () => 0.82 + rnd() * 0.3); // vertical streaks, like cut earth
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = (cols[x] ?? 1) * (0.92 + rnd() * 0.14);
      const i = (y * W + x) * 4;
      data[i] = Math.min(255, c.r * 255 * k);
      data[i + 1] = Math.min(255, c.g * 255 * k);
      data[i + 2] = Math.min(255, c.b * 255 * k);
      data[i + 3] = 255;
    }
  const t = new THREE.DataTexture(data, W, H);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(0.35, 0.35);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  textures.set(kind, t);
  return t;
}

// a cross-section profile (x, y) extruded along the strip; material 0 is the cut face and the far cap, 1 the surfaces
function Extruded({ pts, front, top }: { pts: [number, number][]; front: THREE.Material; top: THREE.Material }) {
  const geo = useMemo(() => {
    const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    return new THREE.ExtrudeGeometry(shape, { depth: LEN, bevelEnabled: false });
  }, [pts]);
  return <mesh geometry={geo} material={[front, top]} position={[0, 0, BACK]} />;
}

const DASHES = Array.from({ length: 16 }, (_, i) => FRONT - 1 - i * 5); // centre line, z of each dash

// height of the strip's top at x across it (a crowned top is higher in the middle)
const topAt = (crown: number, x: number) => crown * Math.max(0, 1 - (x / (LW / 2)) ** 2) + 0.012;

// the ground's profile: a trench for the layers under the strip, ditches beside it when there are any
function groundProfile(trench: number, ditches: boolean): [number, number][] {
  const e = LW / 2;
  const side = (s: number): [number, number][] =>
    ditches
      ? [
          [s * (e + 0.2), 0],
          [s * (e + 0.75), -0.55],
          [s * (e + 1.3), 0],
        ]
      : [];
  const right = side(1);
  const left = side(-1).reverse();
  return [
    [-30, -DEEP],
    [30, -DEEP],
    [30, 0],
    ...right.reverse(),
    [e, 0],
    [e, -trench],
    [-e, -trench],
    [-e, 0],
    ...left.reverse(),
    [-30, 0],
  ];
}

// a band of a layer; the top one can be crowned (higher in the middle so water runs off)
function bandProfile(y0: number, y1: number, crown: number): [number, number][] {
  const e = LW / 2;
  if (crown <= 0)
    return [
      [-e, y0],
      [e, y0],
      [e, y1],
      [-e, y1],
    ];
  const top: [number, number][] = Array.from({ length: 13 }, (_, i) => {
    const x = e - (i / 12) * 2 * e;
    return [x, y1 + crown * (1 - (x / e) ** 2)];
  });
  return [[-e, y0], [e, y0], ...top];
}

// prev: the last diorama shot before this one; the layers it lacked are the ones laid now
type Props = { d: DioramaData; prev?: DioramaData; lf: number; frames: number; seed: string };

export const DioramaScene: React.FC<Props> = ({ d, prev, lf, frames, seed }) => {
  const { fps } = useVideoConfig();
  const camera = useThree((st) => st.camera) as THREE.PerspectiveCamera;
  const total = d.layers.reduce((n, l) => n + l.thick, 0);
  const crown = d.pieces.includes("crown") ? 0.16 : 0;
  // camera: the whole road, or close on the cut face; a slow push keeps the picture alive
  const push = Easing.inOut(Easing.sin)(Math.min(1, lf / Math.max(1, frames)));
  if (d.view === "cutaway") {
    // the whole stack fits the height, from just above the top to the ice and water under it
    const low = -total - 0.9;
    const high = 0.6;
    const cy = (low + high) / 2;
    const dist = Math.max(2.6, (high - low) / 2 / Math.tan((26 * Math.PI) / 180)) * 1.08;
    camera.position.set(0.3, cy + 0.15, FRONT + dist - push * 0.3);
    camera.lookAt(0, cy, FRONT);
    camera.fov = 52;
  } else {
    camera.position.set(0, 2.4, FRONT + 6.2 - push * 0.6);
    camera.lookAt(0, -0.35, FRONT - 6);
    camera.fov = 66;
  }
  camera.updateProjectionMatrix();

  const sky = d.weather === "rain" ? "#9aa3ad" : d.weather === "snow" ? "#c9d3dc" : "#a9d3f2";
  const soilFront = useMemo(() => new THREE.MeshLambertMaterial({ map: streaks("soil", COLOR.soil ?? "#8a5533") }), []);
  const grassTop = useMemo(() => new THREE.MeshLambertMaterial({ color: COLOR.grass }), []);
  // layers, bottom first: the ones the last shot had lie still; new ones drop in on top, or grow in place when they
  // slip in under layers already there
  const drops = dioramaDrops(d, frames, prev);
  const fresh = new Set(drops.map((c) => c.i));
  let y = -total;
  const bands = d.layers.map((l, i) => {
    const y0 = y;
    y += l.thick;
    const start = drops.find((c) => c.i === i)?.frame;
    const k = start === undefined ? 1 : spring({ frame: lf - start, fps, config: { damping: 12 } });
    const under = d.layers.some((_, j) => j > i && !fresh.has(j));
    return {
      l,
      i,
      y0,
      y1: y,
      drop: under ? 0 : (1 - k) * 1.6,
      grow: under ? k : 1,
      shown: k > 0.01,
      top: i === d.layers.length - 1,
    };
  });
  const surfaceColor = COLOR[d.surface] ?? COLOR.dirt;

  return (
    <>
      <color attach="background" args={[sky]} />
      <fog attach="fog" args={[sky, 30, 95]} />
      <hemisphereLight args={["#ffffff", "#6b5a3a", d.weather === "clear" ? 1.1 : 0.85]} />
      <directionalLight position={[6, 12, 8]} intensity={d.weather === "clear" ? 1.3 : 0.8} color="#fff6e6" />
      {/* a fill from the lens side: the cut face looks straight at the camera and would otherwise sit in shade */}
      <directionalLight position={[1, 2, 12]} intensity={1.2} color="#ffffff" />
      <Extruded pts={groundProfile(total, d.pieces.includes("ditches"))} front={soilFront} top={grassTop} />
      {total === 0 && (
        // a bare strip on the ground: its colour is the surface
        <mesh position={[0, 0.006, (FRONT + BACK) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[RW, LEN]} />
          <meshLambertMaterial color={surfaceColor} />
        </mesh>
      )}
      {bands.map((b) =>
        b.shown ? (
          <group key={`${b.i}:${b.l.material}`} position={[0, b.drop + b.y0 * (1 - b.grow), 0]} scale={[1, b.grow, 1]}>
            {b.l.material === "logs" ? (
              <Logs y0={b.y0} y1={b.y1} />
            ) : (
              <Band
                y0={b.y0}
                y1={b.y1}
                crown={b.top ? crown : 0}
                material={b.l.material}
                surface={b.top ? (surfaceColor ?? "#888") : (COLOR[b.l.material] ?? "#888")}
              />
            )}
            {(b.l.material === "stones" || b.l.material === "crushed-rock" || b.l.material === "gravel") && (
              <Rocks y0={b.y0} y1={b.y1} kind={b.l.material} seed={`${seed}${b.i}`} onTop={b.top} />
            )}
          </group>
        ) : null,
      )}
      {total === 0 && (d.surface === "stones" || d.surface === "gravel" || d.surface === "crushed-rock") && (
        <Rocks y0={-0.02} y1={0.02} kind={d.surface} seed={`${seed}s`} onTop />
      )}
      <Pieces d={d} lf={lf} fps={fps} total={total} crown={crown} />
      <Backdrop />
      <Vehicle kind={d.vehicle} lf={lf} frames={frames} y={crown} />
      {d.weather !== "clear" && (
        <Weather
          kind={d.weather}
          lf={lf}
          seed={seed}
          area={{ w: 9, back: FRONT - 15, front: FRONT + 1, y0: -1, h: 9 }}
        />
      )}
    </>
  );
};

// one laid layer: cut face in its material's texture, top in the strip's surface colour (when it is the top)
function Band({
  y0,
  y1,
  crown,
  material,
  surface,
}: {
  y0: number;
  y1: number;
  crown: number;
  material: string;
  surface: string;
}) {
  const front = useMemo(
    () =>
      material === "water"
        ? new THREE.MeshLambertMaterial({ color: COLOR.water, transparent: true, opacity: 0.75 })
        : new THREE.MeshLambertMaterial({ map: streaks(material, COLOR[material] ?? "#888") }),
    [material],
  );
  const top = useMemo(() => new THREE.MeshLambertMaterial({ color: surface }), [surface]);
  const pts = useMemo(() => bandProfile(y0, y1, crown), [y0, y1, crown]);
  return <Extruded pts={pts} front={front} top={top} />;
}

// a corduroy layer: logs lying across the strip side by side, the nearest one's side on the cut face
function Logs({ y0, y1 }: { y0: number; y1: number }) {
  const r = (y1 - y0) / 2;
  const mesh = useMemo(() => {
    const n = Math.ceil(LEN / (2 * r));
    const m = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(r, r, LW, 10),
      new THREE.MeshLambertMaterial({ color: "#8a5a32" }),
      n,
    );
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2));
    for (let i = 0; i < n; i++)
      m.setMatrixAt(
        i,
        new THREE.Matrix4().compose(new THREE.Vector3(0, y0 + r, FRONT - r - i * 2 * r), q, new THREE.Vector3(1, 1, 1)),
      );
    m.instanceMatrix.needsUpdate = true;
    return m;
  }, [r, y0]);
  return <primitive object={mesh} />;
}

// stones and crushed rock: lumps along the cut face, and scattered over the top near the camera when on top
function Rocks({ y0, y1, kind, seed, onTop }: { y0: number; y1: number; kind: string; seed: string; onTop: boolean }) {
  const big = kind === "stones";
  const size = big ? 0.2 : kind === "crushed-rock" ? 0.1 : 0.06;
  const mesh = useMemo(() => {
    const geo = big ? new THREE.IcosahedronGeometry(1, 0) : new THREE.DodecahedronGeometry(1, 0);
    const mat = new THREE.MeshLambertMaterial({ color: big ? "#9a9a94" : "#c4c4be", flatShading: true });
    const front: THREE.Matrix4[] = [];
    const step = size * 2.1;
    for (let x = -LW / 2 + size; x < LW / 2; x += step)
      for (let yy = y0 + size; yy < y1 - size * 0.5; yy += step)
        front.push(rock(x, yy, FRONT + 0.02, size, `${seed}${x}${yy}`));
    if (onTop)
      for (let i = 0; i < (big ? 70 : 140); i++) {
        const x = (random(`${seed}tx${i}`) - 0.5) * RW;
        const z = FRONT - random(`${seed}tz${i}`) * 14;
        front.push(rock(x, y1 + size * 0.3, z, size * 0.8, `${seed}t${i}`));
      }
    const m = new THREE.InstancedMesh(geo, mat, front.length);
    front.forEach((mx, i) => {
      m.setMatrixAt(i, mx);
    });
    m.instanceMatrix.needsUpdate = true;
    return m;
  }, [big, size, y0, y1, seed, onTop]);
  return <primitive object={mesh} />;
}

const rock = (x: number, y: number, z: number, s: number, key: string) => {
  const q = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(random(`${key}a`) * 6, random(`${key}b`) * 6, random(`${key}c`) * 6),
  );
  const k = s * (0.75 + random(`${key}d`) * 0.5);
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(k * 1.2, k, k));
};

function Pieces({
  d,
  lf,
  fps,
  total,
  crown,
}: {
  d: DioramaData;
  lf: number;
  fps: number;
  total: number;
  crown: number;
}) {
  const pop = spring({ frame: lf - START - 2, fps, config: { damping: 12 } });
  const has = (p: string) => d.pieces.includes(p as DioramaData["pieces"][number]);
  const top = (x: number) => topAt(crown, x);
  return (
    <>
      {has("lines") && (
        <>
          {DASHES.map((z) => (
            <mesh key={z} position={[0, top(0), z]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.14, 2.4]} />
              <meshBasicMaterial color="#f4d03f" />
            </mesh>
          ))}
          {[-1, 1].map((s) => (
            <mesh
              key={`edge${s}`}
              position={[s * (RW / 2 - 0.14), top(RW / 2 - 0.14), (FRONT + BACK) / 2]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <planeGeometry args={[0.12, LEN]} />
              <meshBasicMaterial color="#f5f5f2" />
            </mesh>
          ))}
        </>
      )}
      {has("curb") &&
        [-1, 1].map((s) => (
          <mesh key={`curb${s}`} position={[s * (LW / 2 + 0.12), 0.1, (FRONT + BACK) / 2]}>
            <boxGeometry args={[0.24, 0.22, LEN]} />
            <meshLambertMaterial color="#b9b9b4" />
          </mesh>
        ))}
      {has("cracks") &&
        Array.from({ length: 7 }, (_, i) => {
          const x = (random(`cx${i}`) - 0.5) * RW * 0.8;
          return (
            <mesh
              // biome-ignore lint/suspicious/noArrayIndexKey: a fixed set of cracks that never reorders
              key={`crack${i}`}
              position={[x, top(x) + 0.002, FRONT - 0.8 - random(`cz${i}`) * 6]}
              rotation={[-Math.PI / 2, 0, random(`cr${i}`) * Math.PI]}
              scale={[pop, pop, 1]}
            >
              <planeGeometry args={[0.04, 0.6 + random(`cl${i}`) * 0.8]} />
              <meshBasicMaterial color="#111114" />
            </mesh>
          );
        })}
      {has("pothole") && (
        <>
          <mesh
            position={[0.4, top(0.4) + 0.003, FRONT - 1.6]}
            rotation={[-Math.PI / 2, 0, 0]}
            scale={[pop, pop * 0.6, 1]}
          >
            <circleGeometry args={[0.5, 24]} />
            <meshBasicMaterial color="#0d0d10" />
          </mesh>
          <mesh position={[0.4, -0.06, FRONT + 0.03]} scale={[pop, pop, 1]}>
            <circleGeometry args={[0.32, 24, 0, Math.PI]} />
            <meshBasicMaterial color="#0d0d10" />
          </mesh>
        </>
      )}
      {has("ice-lens") && (
        <mesh position={[0.2, -total - 0.35, FRONT + 0.03]} scale={[pop * 1.6, pop * 0.4, 1]}>
          <circleGeometry args={[0.35, 32]} />
          <meshBasicMaterial color="#eef8ff" />
        </mesh>
      )}
      {has("water-seep") && (
        <mesh position={[0, -total - 0.12, FRONT + 0.025]}>
          <planeGeometry args={[LW, 0.24]} />
          <meshBasicMaterial color={COLOR.water} transparent opacity={0.8} />
        </mesh>
      )}
      {has("sign") && <Sign text={d.sign ?? ""} pop={pop} />}
    </>
  );
}

// a green road sign on a post, its words drawn on a canvas once
function Sign({ text, pop }: { text: string; pop: number }) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 160;
    const g = c.getContext("2d");
    if (g) {
      g.fillStyle = "#1f6b3a";
      g.fillRect(0, 0, 512, 160);
      g.strokeStyle = "#ffffff";
      g.lineWidth = 8;
      g.strokeRect(10, 10, 492, 140);
      g.fillStyle = "#ffffff";
      g.font = "bold 64px sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(text.toUpperCase(), 256, 84, 470);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [text]);
  return (
    <group position={[RW / 2 + 1.4, 0, FRONT - 7]} scale={[pop, pop, pop]}>
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 2.2, 8]} />
        <meshLambertMaterial color="#8f9396" />
      </mesh>
      <mesh position={[0, 2.25, 0.06]}>
        <planeGeometry args={[1.8, 0.56]} />
        <meshBasicMaterial map={tex} />
      </mesh>
    </group>
  );
}

// houses, trees and clouds along the road, the same in every shot
function Backdrop() {
  const trees = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        x: (i % 2 ? 1 : -1) * (RW / 2 + 2.6 + random(`tx${i}`) * 3),
        z: FRONT - 9 - i * 4.2 - random(`tz${i}`) * 2,
        s: 0.8 + random(`ts${i}`) * 0.5,
      })),
    [],
  );
  const houses = [
    { x: -9, z: -26, c: "#f1efe8", r: "#b5523b" },
    { x: 8.5, z: -22, c: "#e9eef2", r: "#5d6b7a" },
    { x: -8, z: -48, c: "#f4ead8", r: "#9a4a33" },
    { x: 9, z: -55, c: "#eef1ec", r: "#b5523b" },
  ];
  return (
    <>
      {houses.map((h) => (
        <group key={`${h.x}:${h.z}`} position={[h.x, 0, h.z]}>
          <mesh position={[0, 1.6, 0]}>
            <boxGeometry args={[4.2, 3.2, 4]} />
            <meshLambertMaterial color={h.c} />
          </mesh>
          <mesh position={[0, 3.2 + 0.9, 0]} rotation={[0, 0, 0]}>
            <cylinderGeometry args={[0, 3.2, 1.8, 4, 1]} />
            <meshLambertMaterial color={h.r} flatShading />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 1.1, 1.8, 2.01]}>
              <planeGeometry args={[0.8, 0.8]} />
              <meshBasicMaterial color="#3d5a80" />
            </mesh>
          ))}
        </group>
      ))}
      {trees.map((t) => (
        <group key={`${t.x}:${t.z}`} position={[t.x, 0, t.z]} scale={[t.s, t.s, t.s]}>
          <mesh position={[0, 1.2, 0]}>
            <cylinderGeometry args={[0.16, 0.22, 2.4, 6]} />
            <meshLambertMaterial color="#6b4a2e" />
          </mesh>
          {[
            [0, 3, 0, 1.3],
            [-0.6, 2.6, 0.2, 0.9],
            [0.6, 2.7, -0.2, 0.95],
          ].map(([x, yy, z, r]) => (
            <mesh key={`${x}:${yy}`} position={[x ?? 0, yy ?? 0, z ?? 0]}>
              <icosahedronGeometry args={[r ?? 1, 0]} />
              <meshLambertMaterial color="#3f7d34" flatShading />
            </mesh>
          ))}
        </group>
      ))}
      {[-14, 3, 17].map((x, i) => (
        <group key={`cloud${x}`} position={[x, 18 + i * 2, -70]}>
          {[-2, 0, 2.2].map((dx) => (
            <mesh key={dx} position={[dx, 0, 0]} scale={[2.4, 1.1, 1]}>
              <sphereGeometry args={[1.4, 10, 8]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

// a cartoon vehicle with headlight eyes, driving up the strip toward the camera and stopping short of the cut
function Vehicle({ kind, lf, frames, y }: { kind: DioramaData["vehicle"]; lf: number; frames: number; y: number }) {
  if (kind === "none") return null;
  const k = Easing.out(Easing.cubic)(Math.min(1, lf / Math.max(1, frames * 0.6)));
  const z = -32 + (FRONT - 6.5 + 32) * k;
  const spin = (z + 32) / 0.4; // wheels roll with the distance
  const body = kind === "truck" ? "#e8e8e4" : kind === "roller" ? "#e2b11f" : "#8c3b2a";
  return (
    <group position={[0, y, z]}>
      {kind === "roller" ? (
        <>
          <mesh position={[0, 0.75, 0.9]} rotation={[spin, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.72, 0.72, 2.2, 20]} />
            <meshLambertMaterial color="#6f7378" />
          </mesh>
          <mesh position={[0, 1.15, -0.6]}>
            <boxGeometry args={[1.9, 1.1, 1.8]} />
            <meshLambertMaterial color={body} />
          </mesh>
          {[-0.8, 0.8].map((x) => (
            <mesh key={x} position={[x, 2.2, -0.6]}>
              <boxGeometry args={[0.08, 1.2, 0.08]} />
              <meshLambertMaterial color="#222" />
            </mesh>
          ))}
          <mesh position={[0, 2.82, -0.6]}>
            <boxGeometry args={[1.9, 0.08, 1.4]} />
            <meshLambertMaterial color={body} />
          </mesh>
          <Eyes at={[0, 1.5, 0.31]} />
        </>
      ) : (
        <>
          <mesh position={[0, kind === "truck" ? 1.6 : 0.85, -0.4]}>
            <boxGeometry
              args={[kind === "truck" ? 2.4 : 1.9, kind === "truck" ? 2.2 : 0.75, kind === "truck" ? 5 : 4.2]}
            />
            <meshLambertMaterial color={body} />
          </mesh>
          <mesh position={[0, kind === "truck" ? 1.4 : 1.55, kind === "truck" ? 2.6 : 0.4]}>
            <boxGeometry
              args={[kind === "truck" ? 2.3 : 1.8, kind === "truck" ? 1.9 : 0.75, kind === "truck" ? 1.4 : 1.8]}
            />
            <meshLambertMaterial color={kind === "truck" ? "#f2f2ee" : body} />
          </mesh>
          <mesh position={[0, kind === "truck" ? 1.85 : 1.6, kind === "truck" ? 3.31 : 1.31]}>
            <planeGeometry args={[kind === "truck" ? 2 : 1.6, kind === "truck" ? 0.8 : 0.55]} />
            <meshBasicMaterial color="#2a3340" />
          </mesh>
          {[-1, 1].flatMap((sx) =>
            [-1, 1].map((sz) => (
              <mesh
                key={`${sx}:${sz}`}
                position={[sx * (kind === "truck" ? 1.15 : 0.95), 0.4, sz * (kind === "truck" ? 1.8 : 1.4) + 0.2]}
                rotation={[spin, 0, Math.PI / 2]}
              >
                <cylinderGeometry args={[0.4, 0.4, 0.3, 14]} />
                <meshLambertMaterial color="#1a1a1c" />
              </mesh>
            )),
          )}
          <Eyes at={[0, kind === "truck" ? 0.95 : 0.85, kind === "truck" ? 3.31 : 1.71]} />
        </>
      )}
    </group>
  );
}

// headlights as cartoon eyes (white with dark pupils)
function Eyes({ at }: { at: [number, number, number] }) {
  return (
    <group position={at}>
      {[-0.55, 0.55].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh>
            <circleGeometry args={[0.2, 20]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0, -0.02, 0.01]}>
            <circleGeometry args={[0.09, 16]} />
            <meshBasicMaterial color="#111" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// rain streaks or snowflakes in front of the camera, each falling from a seeded start: frame-exact
