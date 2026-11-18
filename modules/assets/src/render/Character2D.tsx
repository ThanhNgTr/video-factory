// 2D characters in the 3D world: each person is drawn from flat vector shapes on a card that always faces the camera
// (a paper cut-out). Sets still hide them, and fog and scene light still tint them. Same props as the 3D Character,
// plus how the card is shown (back view, mirrored, light tint). Every shape carries a soft top-left to bottom-right
// gradient baked into vertex colours (exact for a linear ramp), so flat fills read like the reference's soft shading.
// Pure function of props; geometries are cached by their parameters.
import { type Face, HELD, type Person } from "@vf/contracts";
import type React from "react";
import * as THREE from "three";
import type { Pose } from "../domain/pose.ts";
import { deg } from "./blocks.tsx";
import { characterGeometry } from "./Character.tsx";
import { iconTexture } from "./iconTexture.ts";

// ds-allow-hardcode:start -- character artwork colours burned into video frames, not UI tokens

type P2 = readonly [number, number];
type MakeShape = () => THREE.Shape | THREE.Shape[];

const LAYER = 0.002; // metres between drawing layers on the card
const SIDES = [-1, 1] as const;
const INK = "#1b1416";
const MOUTH = "#4a1d24";
const BLUSH = "#ff8fab";
const APRON = "#ecebe6";

const GEO = new Map<string, THREE.ShapeGeometry>();
export function flatGeometry(key: string, make: MakeShape, color: string, shade: number): THREE.ShapeGeometry {
  const k = `${key}|${color}|${shade}`;
  let g = GEO.get(k);
  if (!g) {
    g = new THREE.ShapeGeometry(make(), 48);
    g.computeBoundingBox();
    const bb = g.boundingBox ?? new THREE.Box3(new THREE.Vector3(), new THREE.Vector3(1, 1, 0));
    const span = bb.max.x - bb.min.x + (bb.max.y - bb.min.y) || 1;
    const base = new THREE.Color(color);
    const pos = g.getAttribute("position");
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const t = (pos.getX(i) - bb.min.x + (bb.max.y - pos.getY(i))) / span; // 0 top-left .. 1 bottom-right
      const k2 = 1 + shade * (0.5 - t);
      colors[i * 3] = base.r * k2;
      colors[i * 3 + 1] = base.g * k2;
      colors[i * 3 + 2] = base.b * k2;
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    GEO.set(k, g);
  }
  return g;
}

type FlatProps = {
  id: string;
  make: MakeShape;
  c: string;
  z: number;
  tint: string;
  shade?: number;
  p?: P2;
  rot?: number;
  outline?: boolean;
};
// torso corner radius as a share of its width: the silhouette each build reads as
const TORSO_R = { soft: 0.3, round: 0.5, square: 0.08, lean: 0.22 } as const;
const OUTLINE = 0.012; // metres of dark line around the silhouette parts, so characters read against dark sets
const Flat: React.FC<FlatProps> = ({ id, make, c, z, tint, shade = 0.22, p = [0, 0], rot = 0, outline = false }) => {
  const geo = flatGeometry(id, make, c, shade);
  const bb = geo.boundingBox;
  return (
    <>
      <mesh geometry={geo} position={[p[0], p[1], z * LAYER]} rotation={[0, 0, rot]}>
        <meshBasicMaterial vertexColors color={tint} />
      </mesh>
      {outline && bb && (
        // the same shape, grown by the line width and drawn just behind (shapes with an outline are centred)
        <mesh
          geometry={flatGeometry(`${id}|ol`, make, mix(c, INK, 0.72), 0)}
          position={[p[0], p[1], (z - 0.4) * LAYER]}
          rotation={[0, 0, rot]}
          scale={[1 + (2 * OUTLINE) / (bb.max.x - bb.min.x), 1 + (2 * OUTLINE) / (bb.max.y - bb.min.y), 1]}
        >
          <meshBasicMaterial vertexColors color={tint} />
        </mesh>
      )}
    </>
  );
};

// ---- shape makers (centred on the origin unless said otherwise)
const ellipse =
  (rx: number, ry = rx): MakeShape =>
  () => {
    const s = new THREE.Shape();
    s.absellipse(0, 0, rx, ry, 0, Math.PI * 2, false, 0);
    return s;
  };
const rrect =
  (w: number, h: number, r: number): MakeShape =>
  () => {
    const rr = Math.min(r, w / 2, h / 2);
    const x = -w / 2;
    const y = -h / 2;
    const s = new THREE.Shape();
    s.moveTo(x + rr, y);
    s.lineTo(x + w - rr, y);
    s.absarc(x + w - rr, y + rr, rr, -Math.PI / 2, 0, false);
    s.lineTo(x + w, y + h - rr);
    s.absarc(x + w - rr, y + h - rr, rr, 0, Math.PI / 2, false);
    s.lineTo(x + rr, y + h);
    s.absarc(x + rr, y + h - rr, rr, Math.PI / 2, Math.PI, false);
    s.lineTo(x, y + rr);
    s.absarc(x + rr, y + rr, rr, Math.PI, Math.PI * 1.5, false);
    return s;
  };
const poly =
  (pts: readonly P2[]): MakeShape =>
  () =>
    new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
const star = (R: number, r: number): MakeShape =>
  poly(
    Array.from({ length: 10 }, (_, i) => {
      const a = Math.PI / 2 + (i * Math.PI) / 5;
      const d = i % 2 ? r : R;
      return [d * Math.cos(a), d * Math.sin(a)] as const;
    }),
  );
// a thick stroke along an arc of radius R from angle a0 to a1, with round caps
const stroke =
  (R: number, t: number, a0: number, a1: number): MakeShape =>
  () => {
    const s = new THREE.Shape();
    s.absarc(0, 0, R + t / 2, a0, a1, false);
    s.absarc(0, 0, R - t / 2, a1, a0, true);
    const cap = (a: number) => {
      const c = new THREE.Shape();
      c.absarc(R * Math.cos(a), R * Math.sin(a), t / 2, 0, Math.PI * 2, false);
      return c;
    };
    return [s, cap(a0), cap(a1)];
  };
const ring =
  (R: number, t: number): MakeShape =>
  () => {
    const s = new THREE.Shape();
    s.absarc(0, 0, R + t / 2, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, R - t / 2, 0, Math.PI * 2, true);
    s.holes.push(hole);
    return s;
  };
// the part of a circle of radius R above the horizontal line y = y0 (an eyelid)
const segment =
  (R: number, y0: number): MakeShape =>
  () => {
    const a = Math.asin(Math.max(-1, Math.min(1, y0 / R)));
    const s = new THREE.Shape();
    s.absarc(0, 0, R, a, Math.PI - a, false);
    s.closePath();
    return s;
  };
// hair cap seen from the front: an arc over the head, then the hairline (smooth, or cut into triangles)
const hairCap =
  (r: number, hy: number, jag: number, spikes: number): MakeShape =>
  () => {
    const R = 1.07 * r;
    const cy = 0.04 * r;
    const a = 0.1;
    const s = new THREE.Shape();
    s.absarc(0, cy, R, -a, Math.PI + a, false);
    s.lineTo(-0.97 * r, -0.02 * r);
    s.quadraticCurveTo(-0.95 * r, hy, -0.55 * r, hy);
    if (jag > 0) {
      const w = (1.1 * r) / spikes;
      for (let i = 0; i < spikes; i++) {
        const x0 = -0.55 * r + i * w;
        s.lineTo(x0 + w * (0.42 + 0.16 * (i % 2)), hy - jag * (i % 2 ? 0.8 : 1));
        s.lineTo(x0 + w, hy);
      }
    } else {
      s.lineTo(0.55 * r, hy);
    }
    s.quadraticCurveTo(0.95 * r, hy, 0.97 * r, -0.02 * r);
    s.lineTo(R * Math.cos(a), cy - R * Math.sin(a));
    return s;
  };

const mix = (a: string, b: string, k: number) => `#${new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString()}`;
const luminance = (hex: string) => {
  const c = new THREE.Color(hex);
  return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
};
const isElderly = (p: Person) => p.hair.style !== "none" && luminance(p.hair.color) > 0.35; // linear-space 0.6 sRGB
const isChild = (p: Person) => p.build.height < 0.85;

// face proportions in head radii (same reference measurements as the 3D FACE table, ADR 0009)
const F = {
  eyeX: 0.36,
  eyeY: 0.02,
  eyeR: 0.3,
  eyeRBig: 0.34,
  browX: 0.38,
  browY: 0.5,
  browLen: 0.44,
  browT: 0.11,
  noseY: -0.14,
  noseR: 0.09,
  mouthY: -0.44,
  mouthW: 0.3,
  mouthT: 0.056,
  earX: 0.98,
} as const;
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

type FaceArgs = {
  p: Person;
  r: number;
  face: Face;
  blink: boolean;
  mouthOpen: number | null;
  mouthWide: number;
  lookX: number;
  frame: number;
  tint: string;
};

function FaceFront({ p, r, face, blink, mouthOpen, mouthWide, lookX, frame, tint }: FaceArgs) {
  const old = isElderly(p);
  const parts: React.ReactNode[] = [];
  const ex = F.eyeX * r;
  const ey = F.eyeY * r;
  if (p.face.eyes === "none") {
    // faceless: dark sockets under a pale brow ridge
    for (const sd of SIDES) {
      parts.push(
        <Flat
          key={`so${sd}`}
          id={`so:${r}`}
          make={ellipse(0.24 * r, 0.17 * r)}
          c="#121116"
          z={15}
          shade={0}
          p={[sd * ex, ey]}
          tint={tint}
        />,
      );
    }
    parts.push(
      <Flat
        key="ridge"
        id={`ridge:${r}`}
        make={stroke(1.4 * r, 0.07 * r, Math.PI / 2 - 0.3, Math.PI / 2 + 0.3)}
        c={mix(p.skin, "#ffffff", 0.12)}
        z={19}
        p={[0, ey + 0.32 * r - 1.4 * r]}
        tint={tint}
      />,
    );
  } else if (p.face.eyes === "glow") {
    for (const sd of SIDES) {
      parts.push(
        <Flat
          key={`gl${sd}`}
          id={`gl:${r}`}
          make={ellipse(0.22 * r, 0.14 * r)}
          c="#ffe066"
          z={15}
          shade={0}
          p={[sd * ex, ey]}
          tint="#ffffff"
        />,
      );
    }
  } else {
    const R = (p.face.eyes === "big" ? F.eyeRBig : F.eyeR) * r * (face === "shock" ? 1.12 : 1);
    const pr = 0.5 * R;
    const look = face === "shock" ? 0 : -0.2 * R - (face === "sad" || face === "cry" ? 0.08 * R : 0);
    const shut = blink && !["happy", "sleepy", "love"].includes(face);
    const rest = old && face !== "shock" ? 0.36 : 0;
    const lid = Math.max(
      rest,
      shut ? 0.9 : face === "sleepy" ? 0.55 : face === "smug" ? 0.4 : face === "happy" || face === "love" ? 0.3 : 0,
    );
    const white = old ? "#dcdcd8" : "#f6f6f2";
    for (const sd of SIDES) {
      const x = sd * ex;
      if (old) {
        parts.push(
          <Flat
            key={`ring${sd}`}
            id={`bag:${R}`}
            make={ellipse(1.18 * R, 1.05 * R)}
            c={mix(p.skin, "#d6d1ca", 0.6)}
            z={14}
            p={[x, ey - 0.22 * R]}
            tint={tint}
          />,
        );
      }
      parts.push(
        <Flat
          key={`w${sd}`}
          id={`eye:${R}`}
          make={ellipse(R)}
          c={white}
          z={15}
          shade={0.08}
          p={[x, ey]}
          tint="#ffffff"
        />,
      );
      if (p.face.iris)
        parts.push(
          <Flat
            key={`ir${sd}`}
            id={`iris:${R}`}
            make={ellipse(0.74 * R)}
            c={p.face.iris}
            z={15.5}
            shade={0.3}
            p={[x + lookX * 0.3 * R, ey + look]}
            tint="#ffffff"
          />,
        );
      parts.push(
        <Flat
          key={`p${sd}`}
          id={`pupil:${pr}`}
          make={ellipse(pr)}
          c="#0c0c10"
          z={16}
          shade={0}
          p={[x + lookX * 0.3 * R, ey + look]}
          tint="#ffffff"
        />,
      );
      parts.push(
        <Flat
          key={`hl${sd}`}
          id={`hl:${pr}`}
          make={ellipse(0.32 * pr)}
          c="#ffffff"
          z={16.5}
          shade={0}
          p={[x + lookX * 0.3 * R - 0.3 * pr, ey + look + 0.35 * pr]}
          tint="#ffffff"
        />,
      );
      parts.push(
        <Flat
          key={`c${sd}`}
          id={`catch:${pr}`}
          make={ellipse(0.3 * pr)}
          c="#ffffff"
          z={17}
          shade={0}
          p={[x - 0.42 * pr, ey + look + 0.45 * pr]}
          tint="#ffffff"
        />,
      );
      if (lid > 0) {
        const y0 = R - 2 * R * lid;
        parts.push(
          <Flat
            key={`lid${sd}`}
            id={`lid:${R}:${lid}`}
            make={segment(1.06 * R, y0)}
            c={p.skin}
            z={18}
            p={[x, ey]}
            tint={tint}
          />,
        );
        const chord = 2 * Math.sqrt(Math.max(0, R * R - y0 * y0));
        parts.push(
          <Flat
            key={`ll${sd}`}
            id={`lidline:${chord}:${r}`}
            make={rrect(chord + 0.04 * r, 0.05 * r, 0.025 * r)}
            c="#201618"
            z={18.5}
            shade={0}
            p={[x, ey + y0]}
            tint={tint}
          />,
        );
      }
      if (p.face.lashes) {
        // a lined upper lid (the lid line already draws one when the lid is down) and two lashes flicking out from
        // the outer corner of the lid's edge, so they follow a blink
        if (lid === 0)
          parts.push(
            <Flat
              key={`ln${sd}`}
              id={`liner:${R}:${r}`}
              make={stroke(R, 0.055 * r, Math.PI / 2 - 0.95, Math.PI / 2 + 0.95)}
              c="#201618"
              z={18.5}
              shade={0}
              p={[x, ey]}
              tint={tint}
            />,
          );
        const top = lid > 0 ? R - 2 * R * lid : R * Math.cos(0.95);
        const edge = Math.sqrt(Math.max(0, R * R - top * top));
        for (const [i, phi] of [0.75, 1.15].entries()) {
          const bx = x + sd * edge * (0.92 - 0.12 * i);
          const by = ey + top + 0.01 * r;
          parts.push(
            <Flat
              key={`la${sd}${i}`}
              id={`lash:${r}`}
              make={rrect(0.045 * r, 0.15 * r, 0.022 * r)}
              c="#201618"
              z={18.6}
              shade={0}
              p={[bx + sd * Math.sin(phi) * 0.07 * r, by + Math.cos(phi) * 0.07 * r]}
              rot={-sd * phi}
              tint={tint}
            />,
          );
        }
      }
    }
    if (p.face.glasses) {
      for (const sd of SIDES) {
        parts.push(
          <Flat
            key={`gs${sd}`}
            id={`glass:${R}`}
            make={ring(R + 0.06 * r, 0.04 * r)}
            c={INK}
            z={19.5}
            shade={0}
            p={[sd * ex, ey]}
            tint={tint}
          />,
        );
      }
    }
    if (p.face.brows !== "none") {
      const t = (p.face.brows === "bushy" ? 0.14 : isChild(p) ? 0.08 : F.browT) * r;
      const arc = 1.0;
      const BR = (F.browLen * r) / (2 * Math.sin(arc / 2));
      const lift = (face === "shock" ? 0.1 : face === "sleepy" ? -0.04 : 0) * r;
      const inner = face === "angry" ? 0.35 : face === "sad" || face === "cry" ? -0.3 : face === "shock" ? -0.15 : 0;
      for (const sd of SIDES) {
        parts.push(
          <group key={`b${sd}`} position={[sd * F.browX * r, F.browY * r + lift, 0]} rotation={[0, 0, sd * -inner]}>
            <Flat
              id={`brow:${BR}:${t}`}
              make={stroke(BR, t, Math.PI / 2 - arc / 2, Math.PI / 2 + arc / 2)}
              c={p.hair.color}
              z={19}
              p={[0, -BR]}
              tint={tint}
            />
          </group>,
        );
      }
    }
    // nose
    const nr = F.noseR * r * (isChild(p) ? 0.85 : old ? 1.25 : 1);
    parts.push(
      <Flat
        key="nose"
        id={`nose:${nr}`}
        make={ellipse(nr, nr * 0.92)}
        c={mix(p.skin, "#b4605a", 0.28)}
        z={20}
        p={[0, F.noseY * r]}
        tint={tint}
      />,
    );
    const glad = face === "happy" || face === "love";
    if (glad || p.face.blush) {
      for (const sd of SIDES) {
        parts.push(
          <Flat
            key={`bl${sd}`}
            id={`blush:${r}`}
            make={ellipse(0.15 * r, 0.09 * r)}
            c={mix(p.skin, BLUSH, glad ? 0.45 : 0.3)}
            z={14}
            p={[sd * 0.56 * r, -0.24 * r]}
            tint={tint}
          />,
        );
      }
    }
    if (face === "cry") {
      const drop = (frame * 0.008) % 0.22;
      for (const sd of SIDES) {
        parts.push(
          <Flat
            key={`t${sd}`}
            id={`tear:${r}`}
            make={ellipse(0.04 * r, 0.06 * r)}
            c="#7fd3f5"
            z={21}
            p={[sd * ex, ey - R - drop]}
            tint={tint}
          />,
        );
      }
    }
  }
  // mouth
  const my = F.mouthY * r;
  const open = mouthOpen ?? (face === "shock" ? 1 : 0);
  if (p.face.grin) {
    const h = 0.2 * r * (1 + 1.4 * open);
    const w = 0.78 * r;
    parts.push(
      <Flat
        key="grin"
        id={`grin:${w}:${h}`}
        make={rrect(w, h, 0.07 * r)}
        c="#120b0d"
        z={21}
        shade={0}
        p={[0, my]}
        tint={tint}
      />,
    );
    for (const row of [1, -1]) {
      const ty = my + row * (h / 2 - 0.05 * r);
      parts.push(
        <Flat
          key={`teeth${row}`}
          id={`teeth:${w}:${r}`}
          make={rrect(w - 0.06 * r, 0.075 * r, 0.02 * r)}
          c="#f1ece0"
          z={22}
          shade={0.05}
          p={[0, ty]}
          tint="#ffffff"
        />,
      );
      for (let i = 1; i < 9; i++) {
        const tx = -w / 2 + 0.03 * r + (i * (w - 0.06 * r)) / 9;
        parts.push(
          <Flat
            key={`gap${row}${i}`}
            id={`gap:${r}`}
            make={rrect(0.012 * r, 0.075 * r, 0.004 * r)}
            c="#2a2020"
            z={22.5}
            shade={0}
            p={[tx, ty]}
            tint={tint}
          />,
        );
      }
    }
  } else if (p.face.eyes !== "none") {
    const curve = CURVE[face];
    const kid = isChild(p) ? 0.8 : 1;
    const width = F.mouthW * r * kid;
    if (open > 0.12) {
      // the oval grows with the mouth opening: scale one oval rather than build a geometry per frame
      parts.push(
        <group key="mo" position={[0, my, 0]} scale={[mouthWide, 1 + 2.6 * open, 1]}>
          <Flat
            id={`mouthO:${r}:${kid}`}
            make={ellipse(0.12 * r * kid, 0.04 * r)}
            c={MOUTH}
            z={21}
            shade={0}
            tint={tint}
          />
        </group>,
      );
    } else if (curve === 0) {
      parts.push(
        <Flat
          key="m"
          id={`mouthN:${width}`}
          make={rrect(width * 0.7, F.mouthT * r, (F.mouthT * r) / 2)}
          c={MOUTH}
          z={21}
          shade={0}
          p={[0, my]}
          tint={tint}
        />,
      );
    } else {
      const arc = 0.6 + 0.5 * Math.abs(curve);
      const R = width / (2 * Math.sin(arc / 2));
      const up = curve > 0;
      const mid = up ? -Math.PI / 2 : Math.PI / 2;
      parts.push(
        <group key="m" position={[face === "smug" ? 0.06 * r : 0, my, 0]} rotation={[0, 0, face === "smug" ? 0.15 : 0]}>
          <Flat
            id={`mouthA:${R}:${arc}:${up}`}
            make={stroke(R, F.mouthT * r, mid - arc / 2, mid + arc / 2)}
            c={MOUTH}
            z={21}
            shade={0}
            p={[0, up ? R : -R]}
            tint={tint}
          />
        </group>,
      );
    }
  }
  if (p.face.mustache) {
    const R = 0.34 * r;
    parts.push(
      <Flat
        key="must"
        id={`must:${r}`}
        make={stroke(R, 0.15 * r, 0.35, Math.PI - 0.35)}
        c={p.hair.color}
        z={22.5}
        p={[0, (F.noseY - 0.1) * r - R]}
        tint={tint}
      />,
    );
  }
  return <>{parts}</>;
}

function HairAndHats({ p, r, back, tint }: { p: Person; r: number; back: boolean; tint: string }) {
  const c = p.hair.color;
  const hood = p.wear.includes("raincoat-hood");
  const out: React.ReactNode[] = [];
  const style = p.hair.style;
  if (style === "long") {
    out.push(
      <Flat
        key="lback"
        id={`lback:${r}`}
        make={rrect(1.7 * r, 1.9 * r, 0.4 * r)}
        c={c}
        z={2}
        p={[0, -0.55 * r]}
        tint={tint}
      />,
    );
    if (!back) {
      for (const sd of SIDES) {
        out.push(
          <Flat
            key={`lock${sd}`}
            id={`lock:${r}`}
            make={rrect(0.22 * r, 1.3 * r, 0.11 * r)}
            c={c}
            z={11.5}
            p={[sd * 0.86 * r, -0.62 * r]}
            tint={tint}
          />,
        );
      }
    }
  }
  if (style === "bob") {
    // a chin-length bob: volume round the back of the head, and a lock down each cheek to the jaw
    out.push(
      <Flat
        key="bback"
        id={`bback:${r}`}
        make={rrect(2.05 * r, 1.5 * r, 0.55 * r)}
        c={c}
        z={2}
        p={[0, -0.1 * r]}
        tint={tint}
      />,
    );
    if (!back)
      for (const sd of SIDES)
        out.push(
          <Flat
            key={`bside${sd}`}
            id={`bside:${r}`}
            make={rrect(0.32 * r, 1.05 * r, 0.16 * r)}
            c={c}
            z={11.5}
            p={[sd * 0.9 * r, -0.26 * r]}
            tint={tint}
          />,
        );
  }
  if (style === "ponytail") {
    // a tail swinging out behind one side of the head, tied with a band in the accent colour; seen from the back it
    // hangs down the middle
    const tail = back
      ? { p: [0, -0.62 * r] as [number, number], rot: 0, z: 24 }
      : { p: [0.98 * r, -0.2 * r] as [number, number], rot: 0.42, z: 2 };
    out.push(
      <Flat
        key="tail"
        id={`tail:${r}`}
        make={ellipse(0.3 * r, 0.72 * r)}
        c={c}
        z={tail.z}
        p={tail.p}
        rot={tail.rot}
        tint={tint}
      />,
    );
    out.push(
      <Flat
        key="tie"
        id={`tie:${r}`}
        make={ellipse(0.15 * r, 0.1 * r)}
        c={p.outfit.accent}
        z={tail.z + 0.2}
        p={back ? [0, 0.04 * r] : [0.82 * r, 0.42 * r]}
        rot={tail.rot}
        tint={tint}
      />,
    );
  }
  if (style === "curly") {
    // curls round the crown: puffs just outside the hair cap give a soft, round silhouette
    for (let i = 0; i < 9; i++) {
      const a = (Math.PI * (12 + i * 19.5)) / 180;
      out.push(
        <Flat
          key={`curl${i}`}
          id={`curl:${r}`}
          make={ellipse(0.3 * r)}
          c={i % 2 ? c : mix(c, "#000000", 0.12)}
          z={22.6}
          p={[Math.cos(a) * 1.0 * r, 0.12 * r + Math.sin(a) * 0.98 * r]}
          tint={tint}
        />,
      );
    }
  }
  if (style === "bald-sides") {
    for (const sd of SIDES) {
      out.push(
        <Flat
          key={`puff${sd}`}
          id={`puff:${r}`}
          make={ellipse(0.19 * r, 0.3 * r)}
          c={mix(c, "#9a9a9a", 0.25)}
          z={12.5}
          p={[sd * 0.93 * r, 0.06 * r]}
          tint={tint}
        />,
      );
    }
    if (back)
      out.push(
        <Flat
          key="band"
          id={`band:${r}`}
          make={rrect(1.8 * r, 0.5 * r, 0.25 * r)}
          c={c}
          z={23}
          p={[0, -0.05 * r]}
          tint={tint}
        />,
      );
  } else if (style !== "none") {
    if (back) {
      out.push(
        <Flat
          key="capB"
          id={`capB:${r}`}
          make={ellipse(1.06 * r, 1.0 * r)}
          c={c}
          z={23}
          p={[0, 0.1 * r]}
          tint={tint}
        />,
      );
    } else {
      // messy: a jagged fringe; bob: straight bangs low on the brow; curly: a short soft fringe
      const [hy, jag, spikes] =
        style === "messy"
          ? [0.8 * r, 0.27 * r, 4]
          : hood
            ? [0.5 * r, 0, 0]
            : style === "bob"
              ? [0.56 * r, 0, 0]
              : style === "curly"
                ? [0.66 * r, 0.1 * r, 6]
                : [0.62 * r, 0, 0];
      out.push(
        <Flat key="cap" id={`cap:${r}:${hy}:${jag}`} make={hairCap(r, hy, jag, spikes)} c={c} z={23} tint={tint} />,
      );
    }
    if (style === "bun")
      out.push(<Flat key="bun" id={`bun:${r}`} make={ellipse(0.32 * r)} c={c} z={22} p={[0, 1.02 * r]} tint={tint} />);
  }
  const w = new Set(p.wear);
  const a = p.outfit.accent;
  if (w.has("top-hat")) {
    out.push(
      <Flat
        key="crown"
        id={`crown:${r}`}
        make={rrect(1.3 * r, 0.74 * r, 0.24 * r)}
        c="#1d1d26"
        z={25}
        p={[0, 1.06 * r]}
        tint={tint}
      />,
    );
    out.push(
      <Flat
        key="hband"
        id={`hband:${r}`}
        make={rrect(1.32 * r, 0.15 * r, 0.03 * r)}
        c={a}
        z={25.5}
        p={[0, 0.82 * r]}
        tint={tint}
      />,
    );
    out.push(
      <Flat
        key="brim"
        id={`brim:${r}`}
        make={rrect(2.3 * r, 0.16 * r, 0.08 * r)}
        c="#1d1d26"
        z={26}
        p={[0, 0.7 * r]}
        tint={tint}
      />,
    );
  }
  if (w.has("cap")) {
    // a cap sits just above the brows with its bill toward the camera; uniforms get a matching peaked cap
    const peaked = p.outfit.top === "uniform";
    const capC = peaked ? p.outfit.topColor : a;
    const billC = mix(capC, "#000000", peaked ? 0.45 : 0.28);
    if (peaked) {
      out.push(
        <Flat
          key="capc"
          id={`peak:${r}`}
          make={rrect(1.9 * r, 0.46 * r, 0.16 * r)}
          c={capC}
          z={25}
          p={[0, 0.86 * r]}
          tint={tint}
        />,
      );
      out.push(
        <Flat
          key="capband"
          id={`peakband:${r}`}
          make={rrect(1.86 * r, 0.11 * r, 0.04 * r)}
          c={a}
          z={25.2}
          p={[0, 0.68 * r]}
          tint={tint}
        />,
      );
      out.push(
        <Flat
          key="capbadge"
          id={`peakbadge:${r}`}
          make={ellipse(0.1 * r, 0.11 * r)}
          c={a}
          z={25.3}
          shade={0.3}
          p={[0, 0.92 * r]}
          tint={tint}
        />,
      );
    } else {
      out.push(
        <Flat
          key="capc"
          id={`capdome:${r}`}
          make={segment(1.06 * r, 0.56 * r)}
          c={capC}
          z={25}
          p={[0, 0.04 * r]}
          tint={tint}
        />,
      );
      out.push(
        <Flat
          key="capbtn"
          id={`capbtn:${r}`}
          make={ellipse(0.07 * r, 0.05 * r)}
          c={billC}
          z={25.2}
          p={[0, 1.08 * r]}
          tint={tint}
        />,
      );
    }
    out.push(
      <Flat
        key="bill"
        id={`bill:${r}`}
        make={ellipse(0.82 * r, 0.13 * r)}
        c={billC}
        z={25.5}
        p={[0, 0.58 * r]}
        tint={tint}
      />,
    );
  }
  if (hood) {
    // back of the hood behind the head; in back view it covers the head; in front a rolled rim frames the face
    out.push(
      <Flat
        key="hoodB"
        id={`hoodB:${r}`}
        make={ellipse(1.32 * r, 1.3 * r)}
        c={a}
        z={back ? 24 : 1}
        p={[0, 0.02 * r]}
        tint={tint}
      />,
    );
    if (!back)
      out.push(
        <Flat
          key="hoodR"
          id={`hoodR:${r}`}
          make={ring(1.12 * r, 0.24 * r)}
          c={a}
          z={24}
          p={[0, -0.02 * r]}
          tint={tint}
        />,
      );
  }
  return <>{out}</>;
}

function Clothes({ p, back, tint }: { p: Person; back: boolean; tint: string }) {
  const g = characterGeometry(p);
  const o = p.outfit;
  const w = new Set(p.wear);
  const sy = g.shoulderY;
  const tw = g.torsoW;
  const out: React.ReactNode[] = [];
  const skirtTop = g.hipY + 0.12;
  if (o.top === "dress") {
    const bot = skirtTop - 0.34 * g.h;
    out.push(
      <Flat
        key="skirt"
        id={`skirt:${tw}:${g.h}`}
        make={poly([
          [-0.47 * tw, skirtTop],
          [0.47 * tw, skirtTop],
          [0.66 * tw, bot + 0.025],
          [0.62 * tw, bot],
          [-0.62 * tw, bot],
          [-0.66 * tw, bot + 0.025],
        ])}
        c={o.topColor}
        z={4}
        tint={tint}
      />,
    );
  }
  if (back) return <>{out}</>;
  const coat = o.top === "coat";
  // an open coat or hoodie shows the shirt under it down the front, edged by the darker fronts; no buttons then
  const open = o.inner !== undefined && (coat || o.top === "hoodie");
  if (open && o.inner) {
    const top = sy - 0.02;
    const bot = g.hipY + 0.02;
    const w = 0.3 * tw;
    out.push(
      <Flat
        key="inner"
        id={`inner:${tw}:${g.h}`}
        make={rrect(w, top - bot, 0.02)}
        c={o.inner}
        z={5.6}
        p={[0, (top + bot) / 2]}
        tint={tint}
      />,
    );
    for (const sd of SIDES)
      out.push(
        <Flat
          key={`front${sd}`}
          id={`front:${g.h}`}
          make={rrect(0.025, top - bot, 0.01)}
          c={mix(o.topColor, "#000000", 0.3)}
          z={5.7}
          shade={0}
          p={[sd * (w / 2), (top + bot) / 2]}
          tint={tint}
        />,
      );
  }
  const buttons = open ? 0 : coat ? 4 : o.top === "uniform" ? 3 : o.top === "suit" ? 2 : 0;
  const buttonTop = o.top === "suit" ? sy - 0.36 : sy - 0.12;
  const step = (g.torsoH * (coat ? 0.95 : 0.7)) / Math.max(1, buttons);
  const bc = o.top === "uniform" ? o.accent : mix(o.topColor, "#000000", 0.45);
  for (let i = 0; i < buttons; i++) {
    out.push(
      <Flat key={`btn${i}`} id="btn" make={ellipse(0.02)} c={bc} z={7} p={[0, buttonTop - i * step]} tint={tint} />,
    );
  }
  if (coat) {
    for (const sd of SIDES)
      out.push(
        <Flat
          key={`pk${sd}`}
          id={`pk:${g.w}`}
          make={rrect(0.13 * g.w, 0.035, 0.015)}
          c={mix(o.topColor, "#000000", 0.18)}
          z={6}
          p={[sd * 0.15 * g.w, g.hipY + 0.02]}
          tint={tint}
        />,
      );
  }
  if (o.top === "suit") {
    out.push(
      <Flat
        key="shirt"
        id="shirt"
        make={poly([
          [-0.075, sy - 0.01],
          [0.075, sy - 0.01],
          [0, sy - 0.33],
        ])}
        c="#f2f2f2"
        z={6}
        tint={tint}
      />,
    );
    for (const sd of SIDES)
      out.push(
        <Flat
          key={`lap${sd}`}
          id={`lap:${sd}`}
          make={poly([
            [sd * 0.075, sy - 0.01],
            [sd * 0.13, sy - 0.03],
            [sd * 0.02, sy - 0.33],
          ])}
          c={mix(o.topColor, "#ffffff", 0.12)}
          z={6.5}
          tint={tint}
        />,
      );
  }
  if (o.top === "uniform")
    out.push(
      <Flat
        key="collar"
        id={`collar:${tw}`}
        make={rrect(0.62 * tw, 0.05, 0.025)}
        c={o.accent}
        z={6}
        p={[0, sy - 0.04]}
        tint={tint}
      />,
    );
  if (o.top === "hoodie") {
    out.push(
      <Flat
        key="hood"
        id={`hhood:${tw}`}
        make={ellipse(0.36 * tw, 0.09)}
        c={mix(o.topColor, "#000000", 0.1)}
        z={8.5}
        p={[0, sy + 0.01]}
        tint={tint}
      />,
    );
    // drawstrings, as on the reference boy; on an open hoodie they hang from the fronts, either side of the shirt
    for (const sd of SIDES)
      out.push(
        <Flat
          key={`ds${sd}`}
          id="ds"
          make={rrect(0.022, 0.26, 0.011)}
          c="#e8eef0"
          z={8.7}
          p={[sd * (open ? 0.15 * tw + 0.03 : 0.06), sy - 0.14]}
          tint={tint}
        />,
      );
  }
  if (o.pattern !== "none") {
    // a print over the top, in a tone between the top and the accent so it stays quiet
    const top = sy - 0.08;
    const bot = g.hipY + 0.04;
    const h = top - bot;
    const pc = mix(o.topColor, o.accent, 0.55);
    if (o.pattern === "plaid")
      for (let i = 0; i < 3; i++) {
        out.push(
          <Flat
            key={`pv${i}`}
            id={`pv:${h}`}
            make={rrect(0.02, h, 0.006)}
            c={pc}
            z={5.3}
            shade={0}
            p={[-tw / 2 + tw * (0.2 + 0.3 * i), bot + h / 2]}
            tint={tint}
          />,
        );
      }
    if (o.pattern === "plaid" || o.pattern === "stripes")
      for (let i = 0; i < 4; i++) {
        out.push(
          <Flat
            key={`ph${i}`}
            id={`ph:${tw}`}
            make={rrect(tw - 0.03, 0.02, 0.006)}
            c={pc}
            z={5.3}
            shade={0}
            p={[0, bot + h * (0.15 + 0.23 * i)]}
            tint={tint}
          />,
        );
      }
    if (o.pattern === "stars")
      [
        [-0.3, 0.75],
        [0.25, 0.6],
        [-0.1, 0.35],
        [0.32, 0.2],
        [-0.33, 0.12],
      ].forEach(([ux, uy]) => {
        out.push(
          <Flat
            key={`st${ux}:${uy}`}
            id="star"
            make={star(0.028, 0.012)}
            c={pc}
            z={5.3}
            shade={0}
            p={[(ux ?? 0) * tw, bot + (uy ?? 0) * h]}
            tint={tint}
          />,
        );
      });
  }
  if (w.has("name-tag")) {
    const x = -0.13 * g.w;
    const y = sy - 0.16;
    out.push(
      <Flat
        key="tag"
        id="tag"
        make={rrect(0.09, 0.05, 0.008)}
        c="#f7f4ec"
        z={7.6}
        shade={0.05}
        p={[x, y]}
        tint={tint}
      />,
    );
    out.push(
      <Flat
        key="tagbar"
        id="tagbar"
        make={rrect(0.09, 0.012, 0.004)}
        c={o.accent}
        z={7.65}
        shade={0}
        p={[x, y + 0.019]}
        tint={tint}
      />,
    );
    out.push(
      <Flat
        key="tagtxt"
        id="tagtxt"
        make={rrect(0.05, 0.008, 0.004)}
        c="#3a3330"
        z={7.65}
        shade={0}
        p={[x, y - 0.008]}
        tint={tint}
      />,
    );
  }
  if (w.has("apron")) {
    out.push(
      <Flat
        key="bib"
        id={`bib:${tw}`}
        make={rrect(0.62 * tw, sy - 0.06 - skirtTop, 0.05)}
        c={APRON}
        z={7}
        p={[0, (sy - 0.06 + skirtTop) / 2]}
        tint={tint}
      />,
    );
    out.push(
      <Flat
        key="bibpk"
        id="bibpk"
        make={rrect(0.13, 0.08, 0.02)}
        c={mix(APRON, "#000000", 0.06)}
        z={7.5}
        p={[0, sy - 0.24]}
        tint={tint}
      />,
    );
    if (o.top === "dress") {
      const bot = skirtTop - 0.26 * g.h;
      out.push(
        <Flat
          key="askirt"
          id={`askirt:${tw}:${g.h}`}
          make={poly([
            [-0.36 * tw, skirtTop],
            [0.36 * tw, skirtTop],
            [0.5 * tw, bot + 0.02],
            [0.47 * tw, bot],
            [-0.47 * tw, bot],
            [-0.5 * tw, bot + 0.02],
          ])}
          c={APRON}
          z={7}
          tint={tint}
        />,
      );
      out.push(
        <Flat
          key="belt"
          id={`belt:${tw}`}
          make={rrect(0.98 * tw, 0.032, 0.016)}
          c={mix(APRON, "#000000", 0.08)}
          z={7.5}
          p={[0, skirtTop + 0.004]}
          tint={tint}
        />,
      );
    } else {
      out.push(
        <Flat
          key="askirt"
          id={`askirtB:${tw}`}
          make={rrect(0.62 * tw, 0.36, 0.04)}
          c={APRON}
          z={7}
          p={[0, g.hipY - 0.06]}
          tint={tint}
        />,
      );
    }
  }
  if (w.has("tie") && o.top !== "suit") {
    out.push(
      <Flat key="tie" id="tie" make={rrect(0.055, 0.24, 0.012)} c={o.accent} z={7.5} p={[0, sy - 0.2]} tint={tint} />,
    );
  }
  if (w.has("tie") && o.top === "suit") {
    out.push(
      <Flat
        key="tie"
        id="stie"
        make={poly([
          [-0.025, sy - 0.08],
          [0.025, sy - 0.08],
          [0.035, sy - 0.28],
          [0, sy - 0.32],
          [-0.035, sy - 0.28],
        ])}
        c={o.accent}
        z={7.5}
        tint={tint}
      />,
    );
    out.push(
      <Flat key="knot" id="knot" make={ellipse(0.03, 0.025)} c={o.accent} z={7.6} p={[0, sy - 0.065]} tint={tint} />,
    );
  }
  if (w.has("badge"))
    out.push(
      <Flat
        key="badge"
        id="badge"
        make={rrect(0.07, 0.045, 0.01)}
        c={o.accent}
        z={7.5}
        p={[0.12 * g.w, sy - 0.15]}
        tint={tint}
      />,
    );
  if (w.has("scarf")) {
    out.push(
      <Flat
        key="scarf"
        id={`scarf:${g.w}`}
        make={rrect(0.52 * g.w, 0.15, 0.075)}
        c={o.accent}
        z={9}
        p={[0, sy + 0.02]}
        tint={tint}
      />,
    );
    out.push(
      <Flat
        key="tail"
        id="tail"
        make={rrect(0.14, 0.36, 0.03)}
        c={mix(o.accent, "#000000", 0.08)}
        z={9.2}
        p={[-0.075, sy - 0.17]}
        rot={0.06}
        tint={tint}
      />,
    );
  }
  if (w.has("raincoat-hood"))
    out.push(
      <Flat
        key="rcol"
        id={`rcol:${g.w}`}
        make={rrect(0.42 * g.w, 0.1, 0.05)}
        c={o.accent}
        z={9}
        p={[0, sy + 0.01]}
        tint={tint}
      />,
    );
  return <>{out}</>;
}

// How far the whole figure moves up (+) or down (-) for its legs, metres. Each leg is a thigh and a shin of half its
// length; how far below the hip a foot reaches is the same seen from the front or in profile: half * (cos of the
// thigh's angle + cos of the shin's angle, from vertical). Folded legs of an upright body lower it until the lower
// foot is on the floor (kneeling, crouching); a seat puts the hips on it instead (sitting), blended in by seatW.
// Shared with the camera, which frames a seated head lower.
export function bodyLift(p: Person, pose: Pose, seat?: number, seatW = 1): number {
  const g = characterGeometry(p);
  const half = g.legLen / 2;
  const reach = (a: number, k: number) => half * (Math.cos(a * deg) + Math.cos((a + k) * deg));
  const upright = Math.abs(pose.rot) < 30; // lying down, the legs do not stand on anything
  const bent = pose.kneeL > 0 || pose.kneeR > 0;
  const ground =
    bent && upright ? (g.legLen - Math.max(reach(pose.legL, pose.kneeL), reach(pose.legR, pose.kneeR))) * pose.sy : 0;
  return seat === undefined ? -ground : -ground + (seat - g.hipY * pose.sy + ground) * seatW;
}

type Held = (typeof HELD)[number];
const BUILT_IN = new Set<string>(HELD);
const GLOVE = "#f1efe8";

// An item in the hand, drawn upright whatever the arm's angle (the caller cancels the arm rotation).
// Its origin is the centre of the hand; the hand is drawn on top so the fingers close over it.
const ITEM_SCALE = 1.5; // props read at the characters' cartoon scale (big heads), not at real-world size
function HeldItem({ item, icon, tint }: { item: string; icon?: { id: string; svg: string }; tint: string }) {
  return (
    <group scale={[ITEM_SCALE, ITEM_SCALE, 1]}>
      {BUILT_IN.has(item) ? <HeldShape item={item as Held} tint={tint} /> : <IconInHand icon={icon} tint={tint} />}
    </group>
  );
}
// any icon Claude drew (ADR 0017), held up by its lower half; nothing when it was never drawn
function IconInHand({ icon, tint }: { icon?: { id: string; svg: string }; tint: string }) {
  const tex = iconTexture(icon); // decoded before the canvas mounted (<IconsReady>)
  if (!tex) return null;
  return (
    <mesh position={[0, 0.07, 10.8 * LAYER]}>
      <planeGeometry args={[0.24, 0.24]} />
      <meshBasicMaterial map={tex} transparent color={tint} depthWrite={false} />
    </mesh>
  );
}
function HeldShape({ item, tint }: { item: Held; tint: string }) {
  switch (item) {
    case "card":
      // laminated rule card: cream, a red header strip and handwritten lines
      return (
        <group position={[-0.05, 0.07, 0]} rotation={[0, 0, 0.06]}>
          <Flat id="card" make={rrect(0.22, 0.15, 0.012)} c="#f3ecd7" z={10.8} shade={0.12} tint={tint} />
          <Flat
            id="cardHead"
            make={rrect(0.22, 0.034, 0.01)}
            c="#c0392b"
            z={10.85}
            shade={0}
            p={[0, 0.058]}
            tint={tint}
          />
          {[0.012, -0.014, -0.04].map((y, i) => (
            <Flat
              key={y}
              id={`cardLine${i}`}
              make={rrect(0.17 - i * 0.03, 0.009, 0.004)}
              c="#4a4038"
              z={10.86}
              shade={0}
              p={[-0.012 - i * 0.015, y]}
              tint={tint}
            />
          ))}
        </group>
      );
    case "key":
      // brass master key: a ring, a shaft and two teeth
      return (
        <group position={[0.01, 0.07, 0]} rotation={[0, 0, -0.25]}>
          <Flat id="keyRing" make={ring(0.026, 0.013)} c="#c9a227" z={11.3} tint={tint} />
          <Flat id="keyShaft" make={rrect(0.014, 0.1, 0.006)} c="#c9a227" z={11.3} p={[0, -0.075]} tint={tint} />
          <Flat
            id="keyTooth1"
            make={rrect(0.022, 0.012, 0.004)}
            c="#b08d1f"
            z={11.31}
            p={[0.014, -0.105]}
            tint={tint}
          />
          <Flat
            id="keyTooth2"
            make={rrect(0.018, 0.012, 0.004)}
            c="#b08d1f"
            z={11.31}
            p={[0.012, -0.082]}
            tint={tint}
          />
        </group>
      );
    case "phone":
      // a phone with a lit screen (the screen ignores the scene light)
      return (
        <group position={[0, 0.06, 0]}>
          <Flat id="phone" make={rrect(0.08, 0.15, 0.014)} c="#15161a" z={10.8} shade={0.1} tint={tint} />
          <Flat id="phoneScreen" make={rrect(0.066, 0.122, 0.008)} c="#9fd3ff" z={10.85} shade={0.15} tint="#ffffff" />
        </group>
      );
    case "towel":
      // two folded towels
      return (
        <group position={[0, 0.07, 0]}>
          <Flat id="towelA" make={rrect(0.2, 0.06, 0.02)} c="#f5f3ee" z={10.8} tint={tint} />
          <Flat id="towelB" make={rrect(0.19, 0.055, 0.02)} c="#e7e3da" z={10.81} p={[0.005, 0.055]} tint={tint} />
        </group>
      );
    case "bag":
      // a paper delivery bag held by its folded top
      return (
        <group position={[0, -0.1, 0]}>
          <Flat id="bag" make={rrect(0.17, 0.22, 0.01)} c="#b98a5a" z={10.8} shade={0.18} tint={tint} />
          <Flat
            id="bagFold"
            make={rrect(0.17, 0.035, 0.006)}
            c="#8f6436"
            z={10.85}
            shade={0}
            p={[0, 0.095]}
            tint={tint}
          />
          <Flat
            id="bagMark"
            make={rrect(0.06, 0.03, 0.004)}
            c="#c0392b"
            z={10.85}
            shade={0}
            p={[0, -0.02]}
            tint={tint}
          />
        </group>
      );
    case "coffee":
      // a glass coffee pot with a dark brew and a brown lid
      return (
        <group position={[0.02, -0.06, 0]}>
          <Flat id="potGlass" make={rrect(0.14, 0.15, 0.03)} c="#9fb3c4" z={10.8} shade={0.2} tint={tint} />
          <Flat
            id="potBrew"
            make={rrect(0.12, 0.08, 0.02)}
            c="#3a2418"
            z={10.85}
            shade={0}
            p={[0, -0.03]}
            tint={tint}
          />
          <Flat id="potLid" make={rrect(0.16, 0.03, 0.01)} c="#5a3a22" z={10.85} shade={0} p={[0, 0.085]} tint={tint} />
          <Flat id="potHandle" make={ring(0.035, 0.014)} c="#1f1a18" z={10.75} p={[-0.08, 0.02]} tint={tint} />
        </group>
      );
    case "bear":
      // a teddy bear dangling from the hand by one arm
      return (
        <group position={[0, -0.12, 0]}>
          <Flat id="bearBody" make={ellipse(0.055, 0.07)} c="#a9743f" z={10.8} tint={tint} />
          <Flat id="bearHead" make={ellipse(0.05)} c="#b98250" z={10.85} p={[0, 0.09]} tint={tint} />
          {[-1, 1].map((sd) => (
            <Flat
              key={sd}
              id="bearEar"
              make={ellipse(0.018)}
              c="#a9743f"
              z={10.84}
              p={[sd * 0.04, 0.125]}
              tint={tint}
            />
          ))}
          <Flat id="bearMuzzle" make={ellipse(0.022, 0.016)} c="#e0c39a" z={10.9} p={[0, 0.075]} tint={tint} />
          {[-1, 1].map((sd) => (
            <Flat
              key={`e${sd}`}
              id="bearEye"
              make={ellipse(0.006)}
              c={INK}
              z={10.95}
              shade={0}
              p={[sd * 0.018, 0.1]}
              tint={tint}
            />
          ))}
        </group>
      );
  }
}

// Water drops travelling from the hem: down like rain, or up (the uncanny version). Position is a function of the frame.
const DROPS = 10;
function Drips({
  dir,
  hemY,
  halfWidth,
  frame,
  tint,
}: {
  dir: "up" | "down";
  hemY: number;
  halfWidth: number;
  frame: number;
  tint: string;
}) {
  return (
    <>
      {Array.from({ length: DROPS }, (_, i) => {
        const t = (frame * 0.018 + i * 0.37) % 1;
        const x = halfWidth * (((i * 0.61) % 1) * 2 - 1) * 0.85;
        const y = dir === "up" ? hemY + t * 0.9 : hemY - t * 0.55;
        const size = 1 - 0.5 * t; // drops shrink as they travel
        return (
          <group key={`drop${x}`} position={[x, y, 0]} scale={[size, size, 1]}>
            <Flat id="drop" make={ellipse(0.018, 0.03)} c="#9fd8f2" z={11.9} shade={0.3} tint={tint} />
          </group>
        );
      })}
    </>
  );
}

export type Character2DProps = {
  p: Person;
  pose: Pose;
  face: Face;
  mouthOpen: number | null;
  mouthWide?: number; // horizontal mouth scale from the viseme (0.6 rounded .. 1.1 wide)
  look?: number; // -1..1: pupils glance left/right on the card
  tilt?: number; // degrees of head tilt
  sway?: number; // hair lag, degrees, from the body's motion
  blink: boolean;
  frame: number;
  back?: boolean; // seen from behind: no face, hair over the head
  mirror?: boolean; // flipped left-right (asymmetric details swap sides)
  side?: number; // 0 = front, 1 = turned to profile toward +x (mirror turns it the other way)
  walking?: boolean; // moving along a path: from the front the arms' forward/back swing must not read as flapping
  tint?: string; // scene light on the card: mood colour times the light level
  lying?: boolean; // a lying posture: the turned body rests on the floor
  seat?: number; // height of the seat the hips rest on, metres (a sitting posture); the feet then hang free
  seatW?: number; // 0..1: how far the hips have moved from standing onto the seat (sitting down, standing up)
  holds?: string; // item in the right hand: a built-in item (HELD) or a drawn icon's id
  heldIcon?: { id: string; svg: string }; // that icon's drawing, when holds names one
  drip?: "up" | "down"; // water dripping off the character
};

export const Character2D: React.FC<Character2DProps> = ({
  p,
  pose,
  face,
  mouthOpen,
  mouthWide = 1,
  look = 0,
  tilt = 0,
  sway = 0,
  blink,
  frame,
  back = false,
  mirror = false,
  side = 0,
  walking = false,
  tint = "#ffffff",
  holds,
  heldIcon,
  drip,
  seat,
  seatW = 1,
  lying = false,
}) => {
  const g = characterGeometry(p);
  // turned toward profile: limbs gather under the body and swing forward/back in the card plane; the face slides
  // toward the facing side (a 3/4 view at most); the +x arm, leg and the -x ear are the near ones
  const s = back ? 0 : Math.min(1, Math.max(0, side));
  const lerp = (a: number, b: number) => a + (b - a) * s;
  const gloves = p.wear.includes("gloves");
  const o = p.outfit;
  const r = g.head.w / 2;
  const dress = o.top === "dress";
  const shortSleeve = o.top === "tshirt" || dress;
  const coatExt = o.top === "coat" ? 0.22 : 0;
  const cy = g.hipY + g.torsoH * 0.3; // tilt pivot, as in 3D
  // a lying body (lie, sleep) rests its side on the floor (or the bed World lifts it onto); a fall keeps its own drop
  const drop = lying
    ? (cy - g.torsoW * 0.5) * Math.sin(pose.rot * deg) ** 2
    : pose.y > 0
      ? (cy - 0.3) * Math.sin(pose.rot * deg) ** 2
      : 0;
  const legR = 0.085 * g.w;
  const legs = [
    [-1, pose.legL, pose.kneeL],
    [1, pose.legR, pose.kneeR],
  ] as const;
  const knees = pose.kneeL > 0 || pose.kneeR > 0;
  const half = g.legLen / 2;
  const lift = bodyLift(p, pose, seat, seatW);
  const arms = [
    [-1, pose.armL],
    [1, pose.armR],
  ] as const;
  return (
    <group scale={[mirror ? -1 : 1, 1, 1]}>
      <group position={[pose.x * 0.9, -pose.y * 0.9 - drop + lift, 0]}>
        <group scale={[pose.sx, pose.sy, 1]}>
          <group position={[0, cy, 0]} rotation={[0, 0, -pose.rot * deg]}>
            <group position={[0, -cy, 0]}>
              {legs.map(([sd, angle, knee]) =>
                knees ? (
                  // thigh, round knee, shin. In profile the shin folds back in the card plane; from the front a part
                  // pointing at the camera shortens to the cosine of its angle (a seated thigh nearly vanishes)
                  <group
                    key={`l${sd}`}
                    position={[sd * 0.115 * g.w * (1 - 0.8 * s), g.hipY, s > 0 ? sd * 0.4 * LAYER : 0]}
                    rotation={[0, 0, -angle * deg * s]}
                  >
                    {(() => {
                      const tLen = lerp(half * Math.abs(Math.cos(angle * deg)), half);
                      const sLen = lerp(half * Math.abs(Math.cos((angle + knee) * deg)), half);
                      // seen from the front, thighs pointing at the camera are a lap: the knees come over the
                      // bottom of the shirt instead of hiding behind it
                      const lap = s < 0.5 && Math.cos(angle * deg) < 0.5 ? 3.1 : 0;
                      return (
                        <>
                          <Flat
                            id={`thigh:${legR}:${tLen.toFixed(3)}`}
                            make={rrect(2 * legR, tLen + legR, legR)}
                            c={dress ? p.skin : o.pants}
                            z={2.5 + lap}
                            p={[0, -tLen / 2]}
                            outline
                            tint={tint}
                          />
                          <group position={[0, -tLen, 0]} rotation={[0, 0, -knee * deg * s]}>
                            <Flat
                              id={`knee:${legR}`}
                              make={ellipse(legR)}
                              c={dress ? p.skin : o.pants}
                              z={2.55 + lap}
                              outline
                              tint={tint}
                            />
                            <Flat
                              id={`shin:${legR}:${sLen.toFixed(3)}`}
                              make={rrect(2 * legR, sLen + legR, legR)}
                              c={dress ? p.skin : o.pants}
                              z={2.5 + lap}
                              p={[0, -sLen / 2]}
                              outline
                              tint={tint}
                            />
                            <Flat
                              id={`shoe:${g.w}`}
                              make={rrect(0.21 * g.w, 0.09, 0.045)}
                              c={INK}
                              z={3 + lap}
                              p={[sd * 0.01 * (1 - s) + 0.05 * s, -sLen]}
                              tint={tint}
                            />
                          </group>
                        </>
                      );
                    })()}
                  </group>
                ) : (
                  // a swing (positive = backward) is a real stride in profile; from the front only the leg stepping
                  // forward lifts (shorter), the other stays planted, so a walk alternates feet instead of hopping
                  <group
                    key={`l${sd}`}
                    position={[sd * 0.115 * g.w * (1 - 0.8 * s), g.hipY, s > 0 ? sd * 0.4 * LAYER : 0]}
                    rotation={[0, 0, -angle * deg * s]}
                    scale={[1, lerp(angle < 0 ? 1 - 0.6 * Math.sin(-angle * deg) : 1, 1), 1]}
                  >
                    <Flat
                      id={`leg:${legR}:${g.legLen}`}
                      make={rrect(2 * legR, g.legLen, legR)}
                      c={dress ? p.skin : o.pants}
                      z={2.5}
                      p={[0, -g.legLen / 2]}
                      outline
                      tint={tint}
                    />
                    <Flat
                      id={`shoe:${g.w}`}
                      make={rrect(0.21 * g.w, 0.09, 0.045)}
                      c={INK}
                      z={3}
                      p={[sd * 0.01 * (1 - s) + 0.05 * s, -g.legLen]}
                      tint={tint}
                    />
                  </group>
                ),
              )}
              <group scale={[(1 - 0.25 * s) * (p.build.shape === "lean" ? 0.86 : 1), 1, 1]}>
                <Flat
                  id={`torso:${g.torsoW}:${g.torsoH}:${coatExt}:${p.build.shape}`}
                  make={rrect(g.torsoW, g.torsoH + coatExt, TORSO_R[p.build.shape] * g.torsoW)}
                  c={o.topColor}
                  z={5}
                  p={[0, g.hipY + (g.torsoH - coatExt) / 2]}
                  outline
                  tint={tint}
                />
                <Clothes p={p} back={back} tint={tint} />
              </group>
              <Flat
                id={`neck:${g.w}`}
                make={rrect(0.12 * g.w, 0.14, 0.05)}
                c={p.skin}
                z={8}
                p={[0, g.shoulderY + 0.02]}
                outline
                tint={tint}
              />
              {arms.map(([sd, angle]) => {
                // a raise opens the arm sideways from the front; in profile it swings it forward (20 = hanging)
                const open = walking ? (pose.armL + pose.armR) / 2 : angle;
                const rot = lerp(sd * Math.max(0, open - 12), angle - 20) * deg;
                const behind = back || (s > 0.5 && sd === -1);
                return (
                  <group
                    key={`a${sd}`}
                    position={[sd * (g.torsoW / 2 - 0.01) * (1 - 0.85 * s), g.shoulderY - 0.07, 0]}
                    rotation={[0, 0, rot]}
                  >
                    {(() => {
                      // the forearm folds up at the elbow as the arm rises (a raised hand ends beside the shoulder);
                      // in profile it folds forward
                      const upper = 0.45 * g.armLen;
                      const lower = 0.45 * g.armLen;
                      const k = Math.min(1, Math.max(0, (open - 30) / 60));
                      const bend = lerp(sd * k * 55, k * 45) * deg;
                      return (
                        <>
                          <Flat
                            id="shoulder"
                            make={ellipse(0.06)}
                            c={o.topColor}
                            z={behind ? 4.5 : 10}
                            outline
                            tint={tint}
                          />
                          <Flat
                            id={`upper:${upper}`}
                            make={rrect(0.12, upper + 0.06, 0.06)}
                            c={o.topColor}
                            z={behind ? 4.5 : 10}
                            p={[0, -upper / 2]}
                            outline
                            tint={tint}
                          />
                          <group position={[0, -upper, 0]} rotation={[0, 0, bend]}>
                            {sd === 1 && holds && !back && (
                              <group position={[0, -lower - 0.04, 0]} rotation={[0, 0, -rot - bend]}>
                                <HeldItem item={holds} icon={heldIcon} tint={tint} />
                              </group>
                            )}
                            <Flat
                              id={`lower:${lower}:${shortSleeve}`}
                              make={rrect(shortSleeve ? 0.1 : 0.12, lower + 0.05, 0.05)}
                              c={shortSleeve ? p.skin : o.topColor}
                              z={behind ? 4.4 : 9.9}
                              p={[0, -lower / 2 + 0.02]}
                              outline
                              tint={tint}
                            />
                            {gloves && (
                              <Flat
                                id="cuff"
                                make={rrect(0.13, 0.045, 0.02)}
                                c={GLOVE}
                                z={behind ? 4.55 : 10.9}
                                p={[0, -lower + 0.025]}
                                tint={tint}
                              />
                            )}
                            <Flat
                              id="hand"
                              make={ellipse(0.075, 0.08)}
                              c={gloves ? GLOVE : p.skin}
                              z={behind ? 4.6 : 11}
                              p={[0, -lower - 0.04]}
                              outline
                              tint={tint}
                            />
                            {p.wear.includes("long-fingers") &&
                              [-0.036, 0, 0.036].map((fx) => (
                                <Flat
                                  key={`f${fx}`}
                                  id="finger"
                                  make={rrect(0.022, 0.13, 0.011)}
                                  c={gloves ? GLOVE : p.skin}
                                  z={behind ? 4.6 : 11}
                                  p={[fx, -lower - 0.04 - 0.1]}
                                  outline
                                  tint={tint}
                                />
                              ))}
                          </group>
                        </>
                      );
                    })()}
                  </group>
                );
              })}
              {drip && (
                <Drips
                  dir={drip}
                  hemY={dress ? g.hipY + 0.12 - 0.34 * g.h : g.hipY - coatExt}
                  halfWidth={dress ? 0.62 * g.torsoW : g.torsoW / 2}
                  frame={frame}
                  tint={tint}
                />
              )}
              <group position={[0, g.headY, 0]} rotation={[0, 0, tilt * deg]}>
                {!(
                  p.hair.style === "long" ||
                  p.hair.style === "bob" ||
                  p.hair.style === "bald-sides" ||
                  p.wear.includes("raincoat-hood")
                ) &&
                  SIDES.map((sd) =>
                    // turning hides the far ear and brings the near one onto the side of the head
                    sd === 1 && s > 0.5 ? null : (
                      <group
                        key={`ear${sd}`}
                        position={[sd * F.earX * r * lerp(1, sd === -1 ? 0.3 : 1), 0, s > 0.5 ? 1.2 * LAYER : 0]}
                      >
                        <Flat id={`ear:${r}`} make={ellipse(0.16 * r)} c={p.skin} z={12} tint={tint} />
                        {!back && (
                          <Flat
                            id={`earIn:${r}`}
                            make={ellipse(0.08 * r)}
                            c={mix(p.skin, "#000000", 0.15)}
                            z={12.2}
                            tint={tint}
                          />
                        )}
                      </group>
                    ),
                  )}
                <Flat
                  id={`head:${r}:${p.build.headShape}`}
                  make={
                    p.build.headShape === "oval"
                      ? ellipse(0.92 * r, 1.08 * r)
                      : p.build.headShape === "square"
                        ? rrect(1.9 * r, 1.9 * r, 0.55 * r)
                        : ellipse(r)
                  }
                  c={p.skin}
                  z={13}
                  shade={0.18}
                  outline
                  tint={tint}
                />
                {!back && (
                  <group position={[0.36 * r * s, 0, 0]} scale={[1 - 0.3 * s, 1, 1]}>
                    <FaceFront
                      p={p}
                      r={r}
                      face={face}
                      blink={blink}
                      mouthOpen={mouthOpen}
                      mouthWide={mouthWide}
                      lookX={look}
                      frame={frame}
                      tint={tint}
                    />
                  </group>
                )}
                {/* hair and hats are cut for a round head: fitted to an oval or square one they stay on it instead of
                    sticking out at the temples, and they lag the body by a few degrees only */}
                <group rotation={[0, 0, -Math.max(-6, Math.min(6, sway)) * deg]} position={[0, -0.3 * r, 0]}>
                  <group
                    position={[0, 0.3 * r, 0]}
                    scale={
                      p.build.headShape === "oval"
                        ? [0.92, 1.08, 1]
                        : p.build.headShape === "square"
                          ? [0.96, 1, 1]
                          : [1, 1, 1]
                    }
                  >
                    <HairAndHats p={p} r={r} back={back} tint={tint} />
                  </group>
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
};
// ds-allow-hardcode:end
