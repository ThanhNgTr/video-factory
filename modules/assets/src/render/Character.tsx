// Draws any procedural person from its JSON in the style of the reference reels. Origin = between the feet, facing +z.
// Pure function of (props): no state, no randomness (blink comes from a seeded source).
// The rig is unchanged: pose.armL/armR swing the arm at the shoulder, pose.legL/legR swing the leg at the hip,
// x/y/rot/sx/sy move the whole body. Every joint (shoulder, elbow, hip, knee) has a padding sphere of the limb's
// radius, so capsules never open a gap whatever the angle.
import type { Face, Person } from "@vf/contracts";
import type React from "react";
import * as THREE from "three";
import type { Pose } from "../domain/pose.ts";
import { Arc, Ball, Block, Capsule, Cylinder, Dome, deg, Lathe, Plate, shade, Tube, type V3 } from "./blocks.tsx";

const INK = "#1b1416";
const BLUSH = "#ff8fab";
const APRON = "#ecebe6";
const SIDES = [-1, 1] as const;
const FRONT = 0.15; // torso front surface (torso depth 0.3)

const luminance = (hex: string) =>
  (0.299 * Number.parseInt(hex.slice(1, 3), 16) +
    0.587 * Number.parseInt(hex.slice(3, 5), 16) +
    0.114 * Number.parseInt(hex.slice(5, 7), 16)) /
  255;
// grey or white hair = an elderly character: tired lids, pale rings round the eyes, a bigger nose
const isElderly = (p: Person) => p.hair.style !== "none" && luminance(p.hair.color) > 0.6;
const isChild = (p: Person) => p.build.height < 0.85;
const hidesEars = (p: Person) =>
  p.hair.style === "long" || p.hair.style === "bald-sides" || p.wear.includes("raincoat-hood");

export const characterGeometry = (p: Person) => {
  const { height: h, width: w, head: hs } = p.build;
  const hipY = 0.67 * h;
  const torsoH = 0.62 * h;
  const shoulderY = hipY + torsoH;
  const head = { w: 0.58 * hs, h: 0.58 * hs, d: 0.58 * hs }; // a sphere
  const neckH = 0.05; // the head sits almost on the collar, as in the reference
  return {
    h,
    w,
    hs,
    hipY,
    torsoH,
    shoulderY,
    head,
    neckH,
    headY: shoulderY + neckH + head.h / 2 - 0.04,
    torsoW: 0.58 * w,
    legLen: hipY - 0.05,
    armLen: 0.58 * h,
  };
};

// The skull is an ellipsoid. A feature at (x, y) sits on its surface and turns to face along the surface normal.
type OnSkull = { z: number; yaw: number; pitch: number };
function onSkull(p: Person, x: number, y = 0): OnSkull {
  const g = characterGeometry(p);
  const a = g.head.w / 2;
  const b = g.head.h / 2;
  const c = g.head.d / 2;
  const t = Math.max(0.02, 1 - (x / a) ** 2 - (y / b) ** 2);
  const z = c * Math.sqrt(t);
  const nx = x / a ** 2;
  const ny = y / b ** 2;
  const nz = z / c ** 2;
  return { z, yaw: Math.atan2(nx, nz), pitch: -Math.atan2(ny, Math.hypot(nx, nz)) };
}

// Face proportions follow the reference reels, as fractions of the head's width W (the head is a sphere):
// big round sticker eyes with solid black pupils looking slightly down and one catchlight, thick arched brows,
// a small ball nose a little pinker than the skin, a thick dark mouth stroke, round ears at eye level.
const FACE = {
  eyeX: 0.18,
  eyeY: 0.01,
  eyeD: 0.3, // eye white diameter; "big" eyes (children) are 0.34
  eyeDBig: 0.34,
  eyeDepth: 0.04,
  pupil: 0.5, // of the eye diameter
  look: -0.1, // pupil offset down, of the eye diameter
  browX: 0.19,
  browY: 0.25,
  browLen: 0.22,
  browTube: 0.028,
  noseY: -0.07,
  noseR: 0.045,
  mouthY: -0.22,
  mouthW: 0.15,
  mouthTube: 0.014,
  earX: 0.49,
} as const;

// mouth curve per expression: + = corners up (smile), - = down
const CURVE: Record<Face, number> = {
  neutral: 0,
  happy: 1,
  love: 1,
  smug: 0.5,
  sad: -1,
  cry: -1,
  angry: -0.6,
  shock: 0,
  sleepy: 0,
};

const mix = (a: string, b: string, k: number) =>
  `#${[1, 3, 5]
    .map((i) =>
      Math.round(Number.parseInt(a.slice(i, i + 2), 16) * (1 - k) + Number.parseInt(b.slice(i, i + 2), 16) * k)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;

// Outline of the upper lid for a round eye of diameter D closed by `lid` (0..1): the top arch of the eye (18%
// oversize so it hides the white's edge) and the same arch moved down by lid * D, which becomes the curved lid margin.
const lidOutline = (D: number, lid: number): [number, number][] => {
  const n = 16;
  const arch = (i: number, k: number, dy: number): [number, number] => {
    const t = Math.PI - (i * Math.PI) / n;
    return [k * (D / 2) * Math.cos(t), k * (D / 2) * Math.sin(t) + dy];
  };
  const top = Array.from({ length: n + 1 }, (_, i) => arch(i, 1.18, 0.004));
  const margin = Array.from({ length: n + 1 }, (_, i) => arch(n - i, 1.02, -D * lid));
  return [...top, ...margin];
};

function Eyes({ p, face, blink }: { p: Person; face: Face; blink: boolean }) {
  const W = characterGeometry(p).head.w;
  if (p.face.eyes === "none") return null;
  const ex = FACE.eyeX * W;
  const ey = FACE.eyeY * W;
  const at = onSkull(p, ex, ey);
  const old = isElderly(p);
  const D = (p.face.eyes === "big" ? FACE.eyeDBig : FACE.eyeD) * W * (face === "shock" ? 1.12 : 1);
  const depth = FACE.eyeDepth * W;
  const pr = (FACE.pupil * D) / 2;
  const look = (face === "shock" ? 0 : FACE.look) * D;
  const shut = blink && !["happy", "sleepy", "love"].includes(face);
  // elderly characters rest with heavy, tired lids (the reference old man); everyone else rests wide open
  const rest = old && face !== "shock" ? 0.36 : 0;
  const lid = Math.max(
    rest,
    shut ? 0.9 : face === "sleepy" ? 0.55 : face === "smug" ? 0.4 : face === "happy" || face === "love" ? 0.3 : 0,
  );
  // the white is a flattened ball sunk a little into the skull so its rim meets the skin
  const front = depth;
  const pupilZ = front * Math.sqrt(Math.max(0, 1 - (look / (D / 2)) ** 2)) + 0.002;
  return (
    <>
      {SIDES.map((sd) => (
        <group key={sd} position={[sd * ex, ey, at.z - depth * 0.25]} rotation={[at.pitch, sd * at.yaw, 0]}>
          {p.face.eyes === "glow" ? (
            <Ball s={[0.11 * W, 0.07 * W, 0.03]} c="#ffe066" glow />
          ) : (
            <>
              {old && (
                // tired eyes: a pale ring round each eye, a little lower
                <Ball
                  p={[0, -0.2 * D, -depth * 0.2]}
                  s={[D * 0.58, D * 0.5, depth * 0.8]}
                  c={mix(p.skin, "#d6d1ca", 0.6)}
                  m="skin"
                  noShadow
                />
              )}
              <Ball s={[D / 2, D / 2, depth]} c={old ? "#dcdcd8" : "#f6f6f2"} glow />
              <Ball p={[0, look, pupilZ]} s={[pr, pr, 0.006]} c="#0c0c10" glow />
              {/* one fixed catchlight, upper left, same side on both eyes (one light source) */}
              <Ball
                p={[-0.42 * pr, look + 0.45 * pr, pupilZ + 0.006]}
                s={[0.3 * pr, 0.3 * pr, 0.003]}
                c="#ffffff"
                glow
              />
              {lid > 0 && (
                <>
                  {/* upper lid: a band whose lower edge is the eye's own top arch moved down, so it stays curved */}
                  <Plate p={[0, 0, front + 0.01]} outline={lidOutline(D, lid)} c={p.skin} m="skin" noShadow />
                  <Arc
                    p={[0, -D * lid, front + 0.012]}
                    radius={D / 2}
                    tube={0.012 * W}
                    arc={Math.PI}
                    c="#201618"
                    glow
                  />
                </>
              )}
            </>
          )}
        </group>
      ))}
    </>
  );
}

function Brows({ p, face }: { p: Person; face: Face }) {
  const W = characterGeometry(p).head.w;
  if (p.face.brows === "none" || p.face.eyes === "none") return null;
  const tube = (p.face.brows === "bushy" ? 0.034 : isChild(p) ? 0.02 : FACE.browTube) * W;
  const arc = 1.0; // radians of arch
  const R = (FACE.browLen * W) / (2 * Math.sin(arc / 2));
  const lift = (face === "shock" ? 0.05 : face === "sleepy" ? -0.02 : 0) * W;
  const x = FACE.browX * W;
  const y = FACE.browY * W + lift;
  const at = onSkull(p, x, y);
  // inner tilt: + = inner ends down (angry), - = inner ends up (sad / scared / worried)
  const inner = face === "angry" ? 0.35 : face === "sad" || face === "cry" ? -0.3 : face === "shock" ? -0.15 : 0;
  return (
    <>
      {SIDES.map((sd) => (
        <group key={sd} position={[sd * x, y, at.z + 0.006]} rotation={[at.pitch, sd * at.yaw, sd * -inner]}>
          {/* a thick arched bar: the top of a torus, its middle on the brow point */}
          <Arc
            p={[0, -R, 0]}
            radius={R}
            tube={tube}
            arc={arc}
            rot={[0, 0, Math.PI / 2 - arc / 2]}
            s={[1, 1, 0.55]}
            c={p.hair.color}
            m="cloth"
            noShadow
          />
        </group>
      ))}
    </>
  );
}

const MOUTH = "#4a1d24";
function Mouth({ p, face, mouthOpen }: { p: Person; face: Face; mouthOpen: number | null }) {
  const W = characterGeometry(p).head.w;
  const y = FACE.mouthY * W;
  const at = onSkull(p, 0, y);
  const z = at.z + 0.004;
  if (p.face.grin) return <Grin p={p} y={y} open={mouthOpen ?? 0} />;
  const kid = isChild(p) ? 0.8 : 1;
  const open = mouthOpen ?? (face === "shock" ? 1 : 0);
  const curve = CURVE[face];
  const width = FACE.mouthW * W * kid;
  const tube = FACE.mouthTube * W;
  if (open > 0.12) {
    // talking or shocked: a soft dark oval
    return (
      <group position={[0, y, z]} rotation={[at.pitch, 0, 0]}>
        <Ball s={[width * 0.4, (0.02 + 0.055 * open) * W * kid, 0.012]} c={MOUTH} glow />
      </group>
    );
  }
  if (curve === 0) {
    return <Capsule p={[0, y, z]} rot={[at.pitch, 0, Math.PI / 2]} r={tube} len={width * 0.7} c={MOUTH} glow />;
  }
  // smile or frown: an arc of a circle; the middle of the arc sits on the mouth point
  const arc = 0.6 + 0.5 * Math.abs(curve);
  const R = width / (2 * Math.sin(arc / 2));
  const up = curve > 0;
  const smug = face === "smug";
  return (
    <group position={[smug ? 0.03 * W : 0, y, z]} rotation={[at.pitch, 0, smug ? 0.15 : 0]}>
      <Arc
        p={[0, up ? R : -R, 0]}
        radius={R}
        tube={tube}
        arc={arc}
        rot={[0, 0, up ? -Math.PI / 2 - arc / 2 : Math.PI / 2 - arc / 2]}
        s={[1, 1, 0.5]}
        c={MOUTH}
        glow
      />
    </group>
  );
}

// Monster grin: two rows of small rounded teeth laid on the curve of the head (angle theta around the vertical axis),
// sunk into a dark band between two thin lip ridges. Opening the mouth moves the rows apart.
const GRIN_HALF_ANGLE = 0.85; // radians each side of the face centre
const TEETH_PER_ROW = 9;
function Grin({ p, y, open }: { p: Person; y: number; open: number }) {
  const g = characterGeometry(p);
  const s = g.hs;
  const a = g.head.w / 2;
  const b = g.head.h / 2;
  const radiusAt = (yy: number) => a * Math.sqrt(Math.max(0.02, 1 - (yy / b) ** 2)); // head is round in plan (w = d)
  const toothH = 0.034 * s;
  const gap = (0.004 + 0.035 * open) * s;
  const upperRow = y + gap / 2 + toothH / 2;
  const lowerRow = y - gap / 2 - toothH / 2;
  const top = upperRow + toothH / 2 + 0.006 * s;
  const bottom = lowerRow - toothH / 2 - 0.006 * s;
  const angles = Array.from(
    { length: TEETH_PER_ROW },
    (_, i) => -GRIN_HALF_ANGLE + ((i + 0.5) * 2 * GRIN_HALF_ANGLE) / TEETH_PER_ROW,
  );
  const toothW = ((2 * GRIN_HALF_ANGLE * radiusAt(y)) / TEETH_PER_ROW) * 0.82;
  const ridge = (yy: number): V3[] =>
    Array.from({ length: 9 }, (_, i) => {
      const t = -GRIN_HALF_ANGLE * 1.05 + (i * 2 * GRIN_HALF_ANGLE * 1.05) / 8;
      const r = radiusAt(yy) + 0.004;
      return [r * Math.sin(t), yy, r * Math.cos(t)];
    });
  // the dark band follows the head's profile between the ridges, a hair above the skin
  const band = Array.from({ length: 5 }, (_, i) => {
    const yy = bottom + ((top - bottom) * i) / 4;
    return [radiusAt(yy) + 0.002, yy] as [number, number];
  });
  return (
    <group>
      <Lathe profile={band} sweep={[-GRIN_HALF_ANGLE * 1.05, GRIN_HALF_ANGLE * 2.1]} c="#120b0d" glow />
      {[upperRow, lowerRow].flatMap((ry) =>
        angles.map((t) => {
          const r = radiusAt(ry) + 0.002;
          const pitch = onSkull(p, 0, ry).pitch;
          // turn to angle t round the vertical axis first, then tilt with the head's curve (Euler XYZ would skew it)
          return (
            <group key={`${ry}:${t}`} rotation={[0, t, 0]}>
              <Block p={[0, ry, r]} rot={[pitch, 0, 0]} s={[toothW, toothH, 0.012]} c="#f1ece0" r={0.006} glow />
            </group>
          );
        }),
      )}
      {[top, bottom].map((ry) => (
        <Tube key={ry} points={ridge(ry)} r={0.007 * s} c={shade(p.skin, 0.92)} m="skin" />
      ))}
    </group>
  );
}

// Faceless heads (eyes "none") get two dark sunken sockets under a thin brow ridge, so they are not blank.
function Sockets({ p }: { p: Person }) {
  const W = characterGeometry(p).head.w;
  const ex = FACE.eyeX * W;
  const ey = FACE.eyeY * W;
  const browY = ey + 0.17 * W;
  const ridge: V3[] = Array.from({ length: 7 }, (_, i) => {
    const x = (-0.36 + (i * 0.72) / 6) * W;
    const y = browY - 0.025 * W * Math.cos((x / (0.36 * W)) * (Math.PI / 2)); // dips a little over the nose
    return [x, y, onSkull(p, x, y).z + 0.002];
  });
  return (
    <>
      {SIDES.map((sd) => {
        const at = onSkull(p, sd * ex, ey);
        return (
          <Ball
            key={sd}
            p={[sd * ex, ey, at.z - 0.012]}
            rot={[at.pitch, sd * at.yaw, 0]}
            s={[0.12 * W, 0.085 * W, 0.022]}
            c="#121116"
            glow
          />
        );
      })}
      <Tube points={ridge} r={0.028 * W} c={shade(p.skin, 0.96)} m="skin" />
    </>
  );
}

type FaceProps = { p: Person; face: Face; blink: boolean; mouthOpen: number | null; frame: number };

function FaceView({ p, face, blink, mouthOpen, frame }: FaceProps) {
  const W = characterGeometry(p).head.w;
  const ex = FACE.eyeX * W;
  const ey = FACE.eyeY * W;
  const eye = onSkull(p, ex, ey);
  const noseAt = onSkull(p, 0, FACE.noseY * W);
  const noseR = FACE.noseR * W * (isChild(p) ? 0.85 : isElderly(p) ? 1.25 : 1);
  return (
    <group>
      <Eyes p={p} face={face} blink={blink} />
      <Brows p={p} face={face} />
      {p.face.eyes === "none" && <Sockets p={p} />}
      {p.face.glasses &&
        SIDES.map((sd) => (
          <Arc
            key={`g${sd}`}
            p={[sd * ex, ey, eye.z + 0.03]}
            rot={[eye.pitch, sd * eye.yaw, 0]}
            radius={(FACE.eyeD / 2 + 0.03) * W}
            tube={0.008}
            arc={Math.PI * 2}
            c={INK}
            m="cloth"
          />
        ))}
      {/* nose: a small ball a little pinker than the skin; faceless heads have none */}
      {p.face.eyes !== "none" && (
        <Ball
          p={[0, FACE.noseY * W, noseAt.z - noseR * 0.25]}
          s={[noseR, noseR * 0.92, noseR * 0.8]}
          c={mix(p.skin, "#b4605a", 0.28)}
          m="skin"
          noShadow
        />
      )}
      <Mouth p={p} face={face} mouthOpen={mouthOpen} />
      {p.face.mustache && <Moustache p={p} />}
      {(face === "happy" || face === "love") &&
        SIDES.map((sd) => {
          const c = onSkull(p, sd * 0.28 * W, -0.12 * W);
          return (
            <Ball
              key={`c${sd}`}
              p={[sd * 0.28 * W, -0.12 * W, c.z - 0.002]}
              rot={[c.pitch, sd * c.yaw, 0]}
              s={[0.075 * W, 0.045 * W, 0.006]}
              c={BLUSH}
              m="skin"
              opacity={0.45}
              noShadow
            />
          );
        })}
      {face === "cry" &&
        SIDES.map((sd) => (
          <Ball
            key={`t${sd}`}
            p={[sd * ex, ey - 0.14 * W - ((frame * 0.008) % 0.22), onSkull(p, ex, -0.14 * W).z + 0.01]}
            s={[0.018, 0.026, 0.01]}
            c="#7fd3f5"
            m="skin"
          />
        ))}
    </group>
  );
}

// A thick moustache shaped like an arch (the reference old man): the top of a torus just under the nose.
function Moustache({ p }: { p: Person }) {
  const W = characterGeometry(p).head.w;
  const arc = 1.6;
  const R = (0.34 * W) / (2 * Math.sin(arc / 2));
  const top = (FACE.noseY - 0.06) * W;
  const at = onSkull(p, 0, top - 0.04 * W);
  return (
    <group position={[0, top, at.z + 0.012]} rotation={[at.pitch, 0, 0]}>
      <Arc
        p={[0, -R, 0]}
        radius={R}
        tube={0.036 * W}
        arc={arc}
        rot={[0, 0, Math.PI / 2 - arc / 2]}
        s={[1, 1, 0.55]}
        c={p.hair.color}
        m="cloth"
        noShadow
      />
    </group>
  );
}

function Ears({ p }: { p: Person }) {
  const W = characterGeometry(p).head.w;
  if (hidesEars(p)) return null;
  return (
    <>
      {SIDES.map((sd) => (
        <group key={sd} position={[sd * FACE.earX * W, 0, -0.01]}>
          <Ball s={[0.045 * W, 0.08 * W, 0.065 * W]} c={p.skin} m="skin" />
          <Ball
            p={[sd * 0.02 * W, 0, 0.005]}
            s={[0.02 * W, 0.05 * W, 0.035 * W]}
            c={shade(p.skin, 0.85)}
            m="skin"
            noShadow
          />
        </group>
      ))}
    </>
  );
}

function Hair({ p }: { p: Person }) {
  const g = characterGeometry(p);
  const H = g.head;
  const s = g.hs;
  const c = p.hair.color;
  const a = H.w / 2;
  const b = H.h / 2;
  const d = H.d / 2;
  // One ellipsoid a little bigger than the skull, shifted up and back: where it meets the skull is a clean hairline
  // (well above the brows in front, as in the reference, behind the ears, low on the nape). Under a hood it is tighter
  // so only a fringe shows; with a jagged fringe it sits higher still so the points have room above the brows.
  const hood = p.wear.includes("raincoat-hood");
  const [cy, cz] = hood ? [0.1, -0.12] : p.hair.style === "messy" ? [0.35, -0.45] : [0.35, -0.36];
  const [kx, ky, kz]: V3 = hood ? [1.05, 1.05, 1.06] : [1.1, 1.1, 1.14];
  const cap = <Ball s={[a * kx, b * ky, d * kz]} p={[0, cy * b, cz * d]} c={c} m="cloth" />;
  const capZ = (xx: number, yy: number) =>
    cz * d + kz * d * Math.sqrt(Math.max(0, 1 - (xx / (kx * a)) ** 2 - ((yy - cy * b) / (ky * b)) ** 2));
  switch (p.hair.style) {
    case "short":
      return cap;
    case "messy":
      return (
        <>
          {cap}
          {FRINGE.map(([x, fan]) => {
            // a flattened cone from inside the hair near the crown down to a sharp point just above the brows:
            // side by side they cut the fringe into the reference's jagged triangles
            const base = new THREE.Vector3(x * a, 0.9 * b, 0);
            base.z = capZ(base.x, base.y) - 0.02;
            const tip = new THREE.Vector3(x * a + Math.tan(fan) * 0.2 * a, 0.58 * b, 0);
            tip.z = onSkull(p, tip.x, tip.y).z + 0.004;
            const dir = tip.clone().sub(base);
            const len = dir.length();
            const euler = new THREE.Euler().setFromQuaternion(
              new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()),
            );
            return (
              <Lathe
                key={x}
                p={[base.x, base.y, base.z]}
                rot={[euler.x, euler.y, euler.z]}
                profile={[
                  [0.001, -0.01],
                  [0.3 * a, 0],
                  [0.001, len],
                ]}
                s={[1, 1, 0.3]}
                c={c}
                m="cloth"
              />
            );
          })}
        </>
      );
    case "long":
      return (
        <>
          {cap}
          {SIDES.map((sd) => (
            <Capsule
              key={sd}
              p={[sd * (a - 0.035), -H.h * 0.42, 0.03]}
              rot={[0, 0, sd * 0.06]}
              r={0.05 * s}
              len={H.h * 0.75}
              s={[1, 1, 0.9]}
              c={c}
              m="cloth"
            />
          ))}
          <Block s={[H.w * 0.9, H.h * 1.0, 0.14]} p={[0, -H.h * 0.42, -d + 0.04]} c={c} m="cloth" r={0.07} />
        </>
      );
    case "bun":
      return (
        <>
          {cap}
          <Ball p={[0, b * 1.05, -d * 0.75]} s={0.09 * s} c={c} m="cloth" />
        </>
      );
    case "bald-sides":
      // two big round puffs over the ears and a band round the back (the reference old man under his hat)
      return (
        <>
          {SIDES.map((sd) => (
            <Ball key={sd} p={[sd * 0.9 * a, 0.04 * b, -0.08 * d]} s={[0.2 * a, 0.34 * b, 0.28 * d]} c={c} m="cloth" />
          ))}
          <Ball p={[0, 0, -0.8 * d]} s={[0.85 * a, 0.28 * b, 0.25 * d]} c={c} m="cloth" />
        </>
      );
    default:
      return null;
  }
}

// Jagged fringe: [x at the crown (fraction of head half-width), fan angle (rad, 15-25 degrees, alternating)]
const FRINGE: readonly (readonly [number, number])[] = [
  [-0.5, -0.38],
  [-0.17, 0.27],
  [0.17, -0.32],
  [0.5, 0.42],
];

// Fedora: rounded brim with a slight curl, tall crown with a pinched top. [radius, height], drawn bottom to top.
const fedora = (hs: number): [number, number][] => {
  const brim = 0.45 * hs;
  const crown = 0.28 * hs;
  const h = 0.26 * hs;
  return [
    [0.001, 0.0],
    [brim - 0.03, 0.0],
    [brim - 0.005, 0.008],
    [brim, 0.022],
    [brim - 0.012, 0.03],
    [crown + 0.05, 0.024],
    [crown + 0.006, 0.036],
    [crown, 0.06],
    [crown - 0.006, h - 0.05],
    [crown - 0.03, h - 0.008],
    [crown * 0.55, h + 0.004],
    [crown * 0.2, h - 0.03],
    [0.001, h - 0.035],
  ];
};

// Baseball cap bill: a flattened half lathe would be overkill; a thin rounded slab reads the same.
function HeadWear({ p }: { p: Person }) {
  const g = characterGeometry(p);
  const H = g.head;
  const top = H.h / 2;
  const a = p.outfit.accent;
  const w = new Set(p.wear);
  return (
    <>
      {w.has("top-hat") && (
        <group position={[0, top - 0.09, -0.01]} rotation={[0.08, 0, 0]}>
          <Lathe profile={fedora(g.hs)} s={[1, 1, 0.92]} c="#1d1d26" m="cloth" />
          {/* raised hat band */}
          <Arc
            p={[0, 0.07 * g.hs, 0]}
            rot={[Math.PI / 2, 0, 0]}
            radius={0.282 * g.hs}
            tube={0.024 * g.hs}
            arc={Math.PI * 2}
            s={[1, 0.92, 1.2]}
            c={a}
            m="cloth"
          />
        </group>
      )}
      {w.has("cap") && (
        <>
          <Dome s={[H.w / 2 + 0.03, H.h / 2 + 0.02, H.d / 2 + 0.03]} p={[0, 0.01, 0]} c={a} m="cloth" theta={1.1} />
          <Block s={[H.w * 0.8, 0.025, 0.22]} p={[0, top * 0.55, H.d / 2 + 0.08]} c={a} m="cloth" r={0.012} />
        </>
      )}
      {w.has("raincoat-hood") && (
        // pole points back and a little up; the open part faces forward and slightly down, framing the face
        <Dome
          s={[H.w / 2 + 0.075, H.h / 2 + 0.075, H.d / 2 + 0.075]}
          p={[0, 0.015, -0.025]}
          rot={[-Math.PI / 2 + 0.35, 0, 0]}
          c={a}
          m="cloth"
          theta={1.9}
          double
          rim={0.022}
        />
      )}
    </>
  );
}

// Bell skirt profile [radius, height] below the waist, for a torso of width tw and a body of height h.
const skirtProfile = (tw: number, h: number): [number, number][] => [
  [tw * 0.47, 0],
  [tw * 0.55, -0.12 * h],
  [tw * 0.66, -0.3 * h],
  [tw * 0.66, -0.34 * h],
  [tw * 0.6, -0.355 * h],
  [0.001, -0.355 * h],
];
const SKIRT_TOP = 0.12; // metres above the hips where the skirt starts
const SKIRT_DEPTH = 0.68; // the skirt is an oval: depth / width

// Apron below the waist: an open curved shell 0.02 outside the skirt over 0.65 pi of its front, with a rolled hem,
// tied on by a thin waist band that wraps both the torso and the top of the skirt.
const APRON_SWEEP = Math.PI * 0.65;
const APRON_DROP = 0.26; // fraction of body height the apron hangs below the waist
function ApronSkirt({ p }: { p: Person }) {
  const g = characterGeometry(p);
  const tw = g.torsoW;
  const top = g.hipY + SKIRT_TOP;
  const h = APRON_DROP * g.h;
  // the skirt profile is nearly straight down to the apron hem: a cone through these radii hugs it
  const rTop = 0.47 * tw + 0.02;
  const rBottom = (0.55 + (0.11 * (APRON_DROP - 0.12)) / 0.18) * tw + 0.02;
  const depth = (SKIRT_DEPTH * 0.47 * tw + 0.02) / rTop; // keeps the 0.02 gap in front too
  const t0 = -APRON_SWEEP / 2;
  const edge = (t: number, y: number, r: number): V3 => [r * Math.sin(t), y, r * Math.cos(t) * depth];
  const hem: V3[] = [
    edge(t0, top - 0.01, rTop),
    edge(t0, top - h, rBottom),
    ...Array.from({ length: 7 }, (_, i) => edge(t0 + ((i + 1) * APRON_SWEEP) / 8, top - h, rBottom)),
    edge(-t0, top - h, rBottom),
    edge(-t0, top - 0.01, rTop),
  ];
  const bx = Math.max(tw / 2, 0.47 * tw) + 0.012;
  const bz = Math.max(FRONT, SKIRT_DEPTH * 0.47 * tw) + 0.012;
  // squircle round the waist: between the rounded-box torso and the oval skirt top
  const belt: V3[] = Array.from({ length: 24 }, (_, i) => {
    const t = (i / 24) * Math.PI * 2;
    const sx = Math.sign(Math.sin(t)) * Math.abs(Math.sin(t)) ** 0.6;
    const sz = Math.sign(Math.cos(t)) * Math.abs(Math.cos(t)) ** 0.6;
    return [bx * sx, top + 0.004, bz * sz];
  });
  return (
    <>
      <Cylinder
        p={[0, top - h / 2, 0]}
        r={rTop}
        r2={rBottom}
        h={h}
        sweep={[t0, APRON_SWEEP]}
        s={[1, 1, depth]}
        c={APRON}
        m="cloth"
      />
      <Tube points={hem} r={0.008} c={APRON} m="cloth" />
      <Tube points={belt} r={0.016} closed s={[1, 0.7, 1]} c={shade(APRON, 0.93)} m="cloth" />
    </>
  );
}

// A loop around the neck at height y with soft folds.
const neckLoop = (rx: number, rz: number, y: number, fold: number): V3[] =>
  Array.from({ length: 12 }, (_, i) => {
    const t = (i / 12) * Math.PI * 2;
    return [rx * Math.sin(t), y + fold * Math.sin(3 * t), rz * Math.cos(t)];
  });

function Clothes({ p }: { p: Person }) {
  const g = characterGeometry(p);
  const o = p.outfit;
  const w = new Set(p.wear);
  const coat = o.top === "coat";
  const sy = g.shoulderY;
  const neckR = 0.065 * g.w;
  const buttons = coat ? 4 : o.top === "uniform" ? 3 : o.top === "suit" ? 2 : 0;
  const buttonColor = o.top === "uniform" ? o.accent : shade(o.topColor, 0.55);
  const buttonTop = o.top === "suit" ? sy - 0.36 : sy - 0.12;
  const buttonStep = (g.torsoH * (coat ? 0.95 : 0.7)) / Math.max(1, buttons);
  return (
    <>
      {o.top === "suit" && (
        <>
          <Block s={[0.14, 0.3, 0.02]} p={[0, sy - 0.17, FRONT]} c="#f2f2f2" m="cloth" r={0.01} />
          {SIDES.map((sd) => (
            // lapels: two slim rounded slabs meeting in a V
            <Block
              key={sd}
              s={[0.05, 0.26, 0.02]}
              p={[sd * 0.07, sy - 0.16, FRONT + 0.006]}
              rot={[0, 0, sd * 0.32]}
              c={shade(o.topColor, 1.25)}
              m="cloth"
              r={0.01}
            />
          ))}
        </>
      )}
      {o.top === "hoodie" && (
        <Tube points={neckLoop(neckR + 0.08, 0.17, sy + 0.01, 0.012)} r={0.05} closed c={o.topColor} m="cloth" />
      )}
      {o.top === "uniform" && (
        // a flat band lying on the shoulders, not a ring standing up
        <Tube
          points={neckLoop(neckR + 0.07, neckR + 0.075, sy - 0.01, 0.003)}
          r={0.022}
          closed
          s={[1, 0.45, 1]}
          c={o.accent}
          m="cloth"
        />
      )}
      {Array.from({ length: buttons }, (_, i) => buttonTop - i * buttonStep).map((y) => (
        <Ball key={y} p={[0, y, FRONT + 0.006]} s={[0.022, 0.022, 0.009]} c={buttonColor} m="cloth" noShadow />
      ))}
      {coat &&
        SIDES.map((sd) => (
          // pocket flaps
          <Block
            key={`pk${sd}`}
            s={[0.13 * g.w, 0.035, 0.02]}
            p={[sd * 0.15 * g.w, g.hipY + 0.02, FRONT + 0.004]}
            c={shade(o.topColor, 0.85)}
            m="cloth"
            r={0.012}
          />
        ))}
      {w.has("raincoat-hood") && (
        <Tube
          points={neckLoop(neckR + 0.06, neckR + 0.075, sy + 0.015, 0.006)}
          r={0.04}
          closed
          c={o.accent}
          m="cloth"
        />
      )}
      {w.has("apron") && (
        <>
          {/* a soft padded bib down to the waist, with a pocket */}
          <Block
            s={[g.torsoW * 0.62, sy - 0.06 - (g.hipY + SKIRT_TOP), 0.035]}
            p={[0, (sy - 0.06 + g.hipY + SKIRT_TOP) / 2, FRONT + 0.008]}
            c={APRON}
            m="cloth"
            r={0.05}
          />
          <Block s={[0.13, 0.08, 0.012]} p={[0, sy - 0.24, FRONT + 0.03]} c={shade(APRON, 0.94)} m="cloth" r={0.02} />
          {o.top === "dress" ? (
            <ApronSkirt p={p} />
          ) : (
            <Block
              s={[g.torsoW * 0.62, 0.36, 0.03]}
              p={[0, g.hipY - 0.06, FRONT + 0.008]}
              c={APRON}
              m="cloth"
              r={0.04}
            />
          )}
        </>
      )}
      {w.has("tie") && (
        <>
          <Ball p={[0, sy - 0.07, FRONT + 0.015]} s={[0.032, 0.026, 0.018]} c={o.accent} m="cloth" noShadow />
          <Block s={[0.055, 0.24, 0.02]} p={[0, sy - 0.2, FRONT + 0.012]} c={o.accent} m="cloth" r={0.012} />
        </>
      )}
      {w.has("badge") && (
        <Block s={[0.07, 0.045, 0.012]} p={[0.12 * g.w, sy - 0.15, FRONT + 0.006]} c={o.accent} m="cloth" r={0.008} />
      )}
      {w.has("scarf") && (
        <>
          <Tube
            points={neckLoop(neckR + 0.06, neckR + 0.075, sy + 0.04, 0.014)}
            r={0.06}
            closed
            c={o.accent}
            m="cloth"
          />
          <Tube
            points={neckLoop(neckR + 0.085, neckR + 0.095, sy - 0.02, 0.01)}
            r={0.055}
            closed
            c={shade(o.accent, 0.9)}
            m="cloth"
          />
          {/* the loose end: a wide flat strip hanging over the chest, as in the reference */}
          <Block
            s={[0.14, 0.36, 0.045]}
            p={[-0.075, sy - 0.17, FRONT + 0.035]}
            rot={[0.08, 0, 0.06]}
            c={o.accent}
            m="cloth"
            r={0.02}
          />
        </>
      )}
    </>
  );
}

export type CharacterProps = {
  p: Person;
  pose: Pose;
  face: Face;
  mouthOpen: number | null;
  blink: boolean;
  frame: number;
};

export const Character: React.FC<CharacterProps> = ({ p, pose, face, mouthOpen, blink, frame }) => {
  const g = characterGeometry(p);
  const o = p.outfit;
  const coat = o.top === "coat";
  const dress = o.top === "dress";
  const shortSleeve = o.top === "tshirt" || dress;
  const cy = g.hipY + g.torsoH * 0.3; // tilt pivot
  // "lying down" poses (rot ~90 while on the ground) would float: lower the body onto the floor
  const drop = pose.y > 0 ? (cy - 0.3) * Math.sin(pose.rot * deg) ** 2 : 0;
  const H = g.head;
  // limbs
  const legR = 0.085 * g.w;
  const thigh = g.legLen * 0.46;
  const shin = g.legLen * 0.44;
  const armR = 0.058;
  const upper = g.armLen * 0.48;
  const fore = g.armLen * 0.42;
  const sleeve = o.topColor;
  const legColor = dress ? p.skin : o.pants;
  const legSurface = dress ? "skin" : "cloth";
  return (
    <group position={[pose.x * 0.9, -pose.y * 0.9 - drop, 0]}>
      <group scale={[pose.sx, pose.sy, pose.sx]}>
        <group position={[0, cy, 0]} rotation={[0, 0, -pose.rot * deg]}>
          <group position={[0, -cy, 0]}>
            {(
              [
                [-1, pose.legL],
                [1, pose.legR],
              ] as const
            ).map(([sd, angle]) => (
              <group key={sd} position={[sd * 0.115 * g.w, g.hipY, 0]} rotation={[angle * deg, 0, 0]}>
                <Ball s={legR} c={legColor} m={legSurface} />
                <Capsule p={[0, -thigh / 2, 0]} r={legR} len={thigh} c={legColor} m={legSurface} />
                <Ball p={[0, -thigh, 0]} s={legR * 0.97} c={legColor} m={legSurface} />
                <Capsule p={[0, -thigh - shin / 2, 0]} r={legR * 0.92} len={shin} c={legColor} m={legSurface} />
                {/* shoe: a soft rounded slab, toe forward */}
                <Block s={[0.19 * g.w, 0.085, 0.27]} p={[0, -g.legLen - 0.005, 0.045]} c={INK} m="cloth" r={0.042} />
              </group>
            ))}
            {/* torso: one soft rounded block; its rounded corners are the shoulders */}
            <Block
              s={[g.torsoW, g.torsoH + (coat ? 0.22 : 0), 0.3]}
              p={[0, g.hipY + (g.torsoH - (coat ? 0.22 : 0)) / 2, 0]}
              c={o.topColor}
              m="cloth"
              r={0.12}
            />
            {dress && (
              // bell skirt turned on a lathe, oval in depth
              <Lathe
                p={[0, g.hipY + SKIRT_TOP, 0]}
                profile={skirtProfile(g.torsoW, g.h)}
                s={[1, 1, SKIRT_DEPTH]}
                c={o.topColor}
                m="cloth"
              />
            )}
            <Capsule
              p={[0, g.shoulderY + g.neckH / 2 - 0.01, -0.01]}
              r={0.065 * g.w}
              len={g.neckH + 0.06}
              c={p.skin}
              m="skin"
            />
            <Clothes p={p} />
            {/* deltoids: blend the torso's top corner into the arm, so there is no doll-joint groove */}
            {SIDES.map((sd) => (
              <Ball
                key={`dl${sd}`}
                p={[sd * (g.torsoW / 2 - 0.005), g.shoulderY - 0.07, 0]}
                s={[0.095 * Math.max(0.85, g.w), 0.088, 0.138]}
                c={sleeve}
                m="cloth"
              />
            ))}
            {(
              [
                [-1, pose.armL],
                [1, pose.armR],
              ] as const
            ).map(([sd, angle]) => (
              <group
                key={`a${sd}`}
                position={[sd * (g.torsoW / 2 + 0.035), g.shoulderY - 0.09, 0]}
                rotation={[0, 0, sd * Math.max(0, angle - 12) * deg]}
              >
                <Ball s={armR * 1.3} c={sleeve} m="cloth" />
                <Capsule
                  p={[0, -upper / 2, 0]}
                  r={armR}
                  len={upper}
                  c={shortSleeve ? p.skin : sleeve}
                  m={shortSleeve ? "skin" : "cloth"}
                />
                {shortSleeve && (
                  <Capsule p={[0, -upper * 0.25, 0]} r={armR * 1.18} len={upper * 0.35} c={sleeve} m="cloth" />
                )}
                {/* elbow + forearm, relaxed slightly forward */}
                <group position={[0, -upper, 0]} rotation={[-0.14, 0, 0]}>
                  <Ball s={armR} c={shortSleeve ? p.skin : sleeve} m={shortSleeve ? "skin" : "cloth"} />
                  <Capsule
                    p={[0, -fore / 2, 0]}
                    r={armR * 0.94}
                    len={fore}
                    c={shortSleeve ? p.skin : sleeve}
                    m={shortSleeve ? "skin" : "cloth"}
                  />
                  <Ball
                    p={[0, -fore - 0.045, 0.008]}
                    s={[0.075, 0.08, 0.068]}
                    c={p.wear.includes("gloves") ? "#f1efe8" : p.skin}
                    m="skin"
                  />
                </group>
              </group>
            ))}
            <group position={[0, g.headY, 0]}>
              <Ball s={[H.w / 2, H.h / 2, H.d / 2]} c={p.skin} m="skin" />
              <Ears p={p} />
              <Hair p={p} />
              <FaceView p={p} face={face} blink={blink} mouthOpen={mouthOpen} frame={frame} />
              <HeadWear p={p} />
            </group>
          </group>
        </group>
      </group>
    </group>
  );
};
