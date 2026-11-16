// 2D characters in the 3D world: each person is drawn from flat vector shapes on a card that always faces the camera
// (a paper cut-out). Sets still hide them, and fog and scene light still tint them. Same props as the 3D Character,
// plus how the card is shown (back view, mirrored, light tint). Every shape carries a soft top-left to bottom-right
// gradient baked into vertex colours (exact for a linear ramp), so flat fills read like the reference's soft shading.
// Pure function of props; geometries are cached by their parameters.
import type { CastMember, Face, Person } from "@vf/contracts";
import type React from "react";
import * as THREE from "three";
import type { Pose } from "../domain/pose.ts";
import { deg } from "./blocks.tsx";
import { characterGeometry } from "./Character.tsx";

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
};
const Flat: React.FC<FlatProps> = ({ id, make, c, z, tint, shade = 0.22, p = [0, 0], rot = 0 }) => (
  <mesh geometry={flatGeometry(id, make, c, shade)} position={[p[0], p[1], z * LAYER]} rotation={[0, 0, rot]}>
    <meshBasicMaterial vertexColors color={tint} />
  </mesh>
);

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
  frame: number;
  tint: string;
};

function FaceFront({ p, r, face, blink, mouthOpen, frame, tint }: FaceArgs) {
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
      parts.push(
        <Flat
          key={`p${sd}`}
          id={`pupil:${pr}`}
          make={ellipse(pr)}
          c="#0c0c10"
          z={16}
          shade={0}
          p={[x, ey + look]}
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
    if (face === "happy" || face === "love") {
      for (const sd of SIDES) {
        parts.push(
          <Flat
            key={`bl${sd}`}
            id={`blush:${r}`}
            make={ellipse(0.15 * r, 0.09 * r)}
            c={mix(p.skin, BLUSH, 0.45)}
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
        <group key="mo" position={[0, my, 0]} scale={[1, 1 + 2.6 * open, 1]}>
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
      const [hy, jag, spikes] = style === "messy" ? [0.8 * r, 0.27 * r, 4] : hood ? [0.5 * r, 0, 0] : [0.62 * r, 0, 0];
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
    out.push(<Flat key="capc" id={`capc:${r}`} make={hairCap(r, 0.55 * r, 0, 0)} c={a} z={25} tint={tint} />);
    out.push(
      <Flat
        key="bill"
        id={`bill:${r}`}
        make={ellipse(0.75 * r, 0.12 * r)}
        c={a}
        z={25.5}
        p={[0, 0.52 * r]}
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
  const buttons = coat ? 4 : o.top === "uniform" ? 3 : o.top === "suit" ? 2 : 0;
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
    // drawstrings, as on the reference boy
    for (const sd of SIDES)
      out.push(
        <Flat
          key={`ds${sd}`}
          id="ds"
          make={rrect(0.022, 0.26, 0.011)}
          c="#e8eef0"
          z={8.7}
          p={[sd * 0.06, sy - 0.14]}
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

type Held = NonNullable<CastMember["holds"]>;
const GLOVE = "#f1efe8";

// An item in the hand, drawn upright whatever the arm's angle (the caller cancels the arm rotation).
// Its origin is the centre of the hand; the hand is drawn on top so the fingers close over it.
const ITEM_SCALE = 1.5; // props read at the characters' cartoon scale (big heads), not at real-world size
function HeldItem({ item, tint }: { item: Held; tint: string }) {
  return (
    <group scale={[ITEM_SCALE, ITEM_SCALE, 1]}>
      <HeldShape item={item} tint={tint} />
    </group>
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
  blink: boolean;
  frame: number;
  back?: boolean; // seen from behind: no face, hair over the head
  mirror?: boolean; // flipped left-right (asymmetric details swap sides)
  tint?: string; // scene light on the card: mood colour times the light level
  holds?: Held; // item in the right hand
  drip?: "up" | "down"; // water dripping off the character
};

export const Character2D: React.FC<Character2DProps> = ({
  p,
  pose,
  face,
  mouthOpen,
  blink,
  frame,
  back = false,
  mirror = false,
  tint = "#ffffff",
  holds,
  drip,
}) => {
  const g = characterGeometry(p);
  const gloves = p.wear.includes("gloves");
  const o = p.outfit;
  const r = g.head.w / 2;
  const dress = o.top === "dress";
  const shortSleeve = o.top === "tshirt" || dress;
  const coatExt = o.top === "coat" ? 0.22 : 0;
  const cy = g.hipY + g.torsoH * 0.3; // tilt pivot, as in 3D
  const drop = pose.y > 0 ? (cy - 0.3) * Math.sin(pose.rot * deg) ** 2 : 0;
  const legR = 0.085 * g.w;
  const legs = [
    [-1, pose.legL],
    [1, pose.legR],
  ] as const;
  const arms = [
    [-1, pose.armL],
    [1, pose.armR],
  ] as const;
  return (
    <group scale={[mirror ? -1 : 1, 1, 1]}>
      <group position={[pose.x * 0.9, -pose.y * 0.9 - drop, 0]}>
        <group scale={[pose.sx, pose.sy, 1]}>
          <group position={[0, cy, 0]} rotation={[0, 0, -pose.rot * deg]}>
            <group position={[0, -cy, 0]}>
              {legs.map(([sd, angle]) => (
                // a forward or backward swing reads as foreshortening from the front
                <group
                  key={`l${sd}`}
                  position={[sd * 0.115 * g.w, g.hipY, 0]}
                  scale={[1, Math.max(0.75, Math.cos(angle * deg)), 1]}
                >
                  <Flat
                    id={`leg:${legR}:${g.legLen}`}
                    make={rrect(2 * legR, g.legLen, legR)}
                    c={dress ? p.skin : o.pants}
                    z={2.5}
                    p={[0, -g.legLen / 2]}
                    tint={tint}
                  />
                  <Flat
                    id={`shoe:${g.w}`}
                    make={rrect(0.21 * g.w, 0.09, 0.045)}
                    c={INK}
                    z={3}
                    p={[sd * 0.01, -g.legLen]}
                    tint={tint}
                  />
                </group>
              ))}
              <Flat
                id={`torso:${g.torsoW}:${g.torsoH}:${coatExt}`}
                make={rrect(g.torsoW, g.torsoH + coatExt, 0.12)}
                c={o.topColor}
                z={5}
                p={[0, g.hipY + (g.torsoH - coatExt) / 2]}
                tint={tint}
              />
              <Clothes p={p} back={back} tint={tint} />
              <Flat
                id={`neck:${g.w}`}
                make={rrect(0.12 * g.w, 0.14, 0.05)}
                c={p.skin}
                z={8}
                p={[0, g.shoulderY + 0.02]}
                tint={tint}
              />
              {arms.map(([sd, angle]) => (
                <group
                  key={`a${sd}`}
                  position={[sd * (g.torsoW / 2 - 0.01), g.shoulderY - 0.07, 0]}
                  rotation={[0, 0, sd * Math.max(0, angle - 12) * deg]}
                >
                  {sd === 1 && holds && !back && (
                    <group position={[0, -g.armLen * 0.9 - 0.04, 0]} rotation={[0, 0, -Math.max(0, angle - 12) * deg]}>
                      <HeldItem item={holds} tint={tint} />
                    </group>
                  )}
                  <Flat id="shoulder" make={ellipse(0.06)} c={o.topColor} z={back ? 4.5 : 10} tint={tint} />
                  <Flat
                    id={`sleeve:${g.armLen}:${shortSleeve}`}
                    make={rrect(0.12, shortSleeve ? g.armLen * 0.45 : g.armLen * 0.9, 0.06)}
                    c={o.topColor}
                    z={back ? 4.5 : 10}
                    p={[0, shortSleeve ? -g.armLen * 0.2 : -g.armLen * 0.45]}
                    tint={tint}
                  />
                  {shortSleeve && (
                    <Flat
                      id={`fore:${g.armLen}`}
                      make={rrect(0.1, g.armLen * 0.55, 0.05)}
                      c={p.skin}
                      z={back ? 4.4 : 9.9}
                      p={[0, -g.armLen * 0.65]}
                      tint={tint}
                    />
                  )}
                  {gloves && (
                    <Flat
                      id="cuff"
                      make={rrect(0.13, 0.045, 0.02)}
                      c={GLOVE}
                      z={back ? 4.55 : 10.9}
                      p={[0, -g.armLen * 0.9 + 0.025]}
                      tint={tint}
                    />
                  )}
                  <Flat
                    id="hand"
                    make={ellipse(0.075, 0.08)}
                    c={gloves ? GLOVE : p.skin}
                    z={back ? 4.6 : 11}
                    p={[0, -g.armLen * 0.9 - 0.04]}
                    tint={tint}
                  />
                </group>
              ))}
              {drip && (
                <Drips
                  dir={drip}
                  hemY={dress ? g.hipY + 0.12 - 0.34 * g.h : g.hipY - coatExt}
                  halfWidth={dress ? 0.62 * g.torsoW : g.torsoW / 2}
                  frame={frame}
                  tint={tint}
                />
              )}
              <group position={[0, g.headY, 0]}>
                {!(p.hair.style === "long" || p.hair.style === "bald-sides" || p.wear.includes("raincoat-hood")) &&
                  SIDES.map((sd) => (
                    <group key={`ear${sd}`} position={[sd * F.earX * r, 0, 0]}>
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
                  ))}
                <Flat id={`head:${r}`} make={ellipse(r)} c={p.skin} z={13} shade={0.18} tint={tint} />
                {!back && (
                  <FaceFront p={p} r={r} face={face} blink={blink} mouthOpen={mouthOpen} frame={frame} tint={tint} />
                )}
                <HairAndHats p={p} r={r} back={back} tint={tint} />
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
};
// ds-allow-hardcode:end
