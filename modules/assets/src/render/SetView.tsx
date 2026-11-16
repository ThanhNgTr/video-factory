// A room and its props, all from blocks. Prop pos = base centre on the floor (or on a wall for paintings/windows).

import type { Set3D } from "@vf/contracts";
import type React from "react";
import { random } from "remotion";
import * as THREE from "three";
import { Ball, Block, Cylinder, deg, shade, type V3 } from "./blocks.tsx";

type Prop = Set3D["props"][number];
const PRODUCTS = ["#e76f51", "#2a9d8f", "#e9c46a", "#457b9d", "#f4a261", "#8ab17d"];
const DEFAULT_SIZE: Record<Prop["type"], V3> = {
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

function PropView({ t }: { t: Prop }) {
  const [w, h, d] = t.size ?? DEFAULT_SIZE[t.type];
  const c = t.color;
  const body = (() => {
    switch (t.type) {
      case "box":
        return <Block s={[w, h, d]} p={[0, h / 2, 0]} c={c ?? "#6b7280"} r={0.02} />;
      case "cylinder":
        return <Cylinder r={w} h={h} p={[0, h / 2, 0]} c={c ?? "#9aa1a9"} />;
      case "shelf":
        return (
          <>
            <Block s={[w, h, d]} p={[0, h / 2, -0.05]} c={c ?? "#5c6b7a"} r={0.02} />
            {[0.3, 0.75, 1.2, 1.65]
              .filter((y) => y < h - 0.2)
              .map((y, row) => (
                <group key={y}>
                  <Block s={[w, 0.04, d + 0.1]} p={[0, y, 0.05]} c="#3e4a57" r={0} />
                  {Array.from({ length: Math.floor(w / 0.32) }, (_, i) => ({ i, x: -w / 2 + 0.2 + i * 0.32 })).map(
                    ({ i, x }) => (
                      <Block
                        key={x}
                        s={[0.22, 0.24 + ((i + row) % 3) * 0.05, 0.22]}
                        p={[x, y + 0.15, 0.08]}
                        c={PRODUCTS[(i + row * 2) % PRODUCTS.length] ?? "#e76f51"}
                        r={0.02}
                      />
                    ),
                  )}
                </group>
              ))}
          </>
        );
      case "counter":
        return (
          <>
            <Block s={[w, h, d]} p={[0, h / 2, 0]} c={c ?? "#5a3825"} r={0.03} />
            <Block s={[w + 0.1, 0.06, d + 0.1]} p={[0, h + 0.03, 0]} c="#d9c7a3" r={0.02} />
          </>
        );
      case "door":
        return (
          <>
            <Block s={[w + 0.14, h + 0.08, 0.06]} p={[0, (h + 0.08) / 2, -0.01]} c="#2a1a10" r={0.01} />
            <Block s={[w, h, 0.05]} p={[0, h / 2, 0.02]} c={c ?? "#4a2c1a"} r={0.01} />
            <Ball p={[w * 0.38, h * 0.48, 0.07]} s={0.04} c="#c9a227" />
            <Block s={[0.16, 0.08, 0.02]} p={[0, h * 0.82, 0.05]} c="#c9a227" r={0.01} />
          </>
        );
      case "window":
        return (
          <>
            <Block s={[w + 0.12, h + 0.12, 0.06]} p={[0, 0, -0.01]} c="#3d4451" r={0.01} />
            <Block s={[w, h, 0.03]} p={[0, 0, 0.01]} c={c ?? "#0b132b"} r={0} glow />
            <Block s={[0.04, h, 0.04]} p={[0, 0, 0.03]} c="#3d4451" r={0} />
          </>
        );
      case "sofa":
        return (
          <>
            <Block s={[w, 0.45, d]} p={[0, 0.225, 0]} c={c ?? "#6d2e46"} r={0.08} />
            <Block s={[w, 0.55, 0.22]} p={[0, 0.55, -d / 2 + 0.11]} c={c ?? "#6d2e46"} r={0.08} />
            {[-1, 1].map((sd) => (
              <Block key={sd} s={[0.2, 0.65, d]} p={[sd * (w / 2 - 0.1), 0.33, 0]} c={c ?? "#6d2e46"} r={0.08} />
            ))}
          </>
        );
      case "plant":
        return (
          <>
            <Cylinder r={w * 0.4} h={0.45} p={[0, 0.225, 0]} c={c ?? "#8d5b3a"} />
            {(
              [
                [-0.15, 0.3],
                [0.15, -0.3],
                [0, 0],
              ] as const
            ).map(([x, r], i) => (
              <Block
                key={x}
                s={[0.22, h - 0.4, 0.06]}
                p={[x, 0.45 + (h - 0.4) / 2, 0]}
                rot={[0, i, r]}
                c="#3f7d4e"
                r={0.03}
              />
            ))}
          </>
        );
      case "elevator":
        return (
          <>
            <Block s={[w + 0.3, h + 0.3, 0.1]} p={[0, (h + 0.3) / 2, -0.03]} c="#6f757d" r={0.02} />
            {[-1, 1].map((sd) => (
              <Block key={sd} s={[w / 2 - 0.01, h, 0.05]} p={[(sd * w) / 4, h / 2, 0.03]} c={c ?? "#b7bdc4"} r={0.01} />
            ))}
            <Block s={[0.4, 0.12, 0.03]} p={[0, h + 0.18, 0.04]} c="#ff9f1c" r={0.01} glow />
          </>
        );
      case "painting":
        return (
          <>
            <Block s={[w + 0.1, h + 0.1, 0.05]} p={[0, 0, 0]} c="#8a6d3b" r={0.01} />
            <Block s={[w, h, 0.02]} p={[0, 0, 0.03]} c={c ?? "#2f4858"} r={0} />
          </>
        );
      case "rug":
        return <Block s={[w, 0.02, d]} p={[0, 0.011, 0]} c={c ?? "#7a1f24"} r={0} />;
      case "chair":
        return (
          <>
            <Block s={[w, 0.06, d]} p={[0, 0.45, 0]} c={c ?? "#5a3825"} r={0.01} />
            <Block s={[w, 0.5, 0.06]} p={[0, 0.72, -d / 2 + 0.03]} c={c ?? "#5a3825"} r={0.01} />
            {(
              [
                [-1, -1],
                [-1, 1],
                [1, -1],
                [1, 1],
              ] as const
            ).map(([x, z]) => (
              <Block
                key={`${x}${z}`}
                s={[0.05, 0.45, 0.05]}
                p={[x * (w / 2 - 0.05), 0.225, z * (d / 2 - 0.05)]}
                c="#2a1a10"
                r={0}
              />
            ))}
          </>
        );
    }
  })();
  return (
    <group position={t.pos} rotation={[0, t.rotY * deg, 0]}>
      {body}
    </group>
  );
}

// Greyscale surface pattern (the material colour tints it), one 2 m tile repeated over a w x h face.
// Seeded remotion random: every render tab must draw the same texture.
const textures = new Map<string, THREE.Texture>();
function pattern(kind: "plain" | "planks" | "tiles" | "stripes", w: number, h: number): THREE.Texture | undefined {
  if (kind === "plain") return undefined;
  const key = `${kind}:${w}:${h}`;
  const cached = textures.get(key);
  if (cached) return cached;
  const cv = document.createElement("canvas");
  cv.width = cv.height = 256;
  const g = cv.getContext("2d");
  if (!g) return undefined;
  const grey = (v: number) => `rgb(${v * 255},${v * 255},${v * 255})`;
  g.fillStyle = grey(1);
  g.fillRect(0, 0, 256, 256);
  if (kind === "planks") {
    for (let row = 0; row < 8; row++) {
      const off = random(`plank${row}`) * 256;
      for (let k = -1; k < 2; k++) {
        g.fillStyle = grey(0.82 + 0.18 * random(`tone${row}${k}`));
        g.fillRect(off + k * 128, row * 32, 128, 32);
      }
      g.fillStyle = grey(0.55);
      g.fillRect(0, row * 32, 256, 2);
      g.fillRect(off % 128, row * 32, 2, 32);
      g.fillRect((off % 128) + 128, row * 32, 2, 32);
    }
  } else if (kind === "tiles") {
    for (let i = 0; i < 4; i++) {
      g.fillStyle = grey(i === 0 || i === 3 ? 1 : 0.86);
      g.fillRect((i % 2) * 128, Math.floor(i / 2) * 128, 128, 128);
    }
    g.fillStyle = grey(0.55);
    for (const x of [0, 128]) {
      g.fillRect(x, 0, 4, 256);
      g.fillRect(0, x, 256, 4);
    }
  } else {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = grey(i % 2 ? 0.88 : 1);
      g.fillRect(i * 32, 0, 32, 256);
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(w / 2, h / 2);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  textures.set(key, t);
  return t;
}

// A strip running along the back wall and both side walls (skirting, panelling, crown moulding).
const Trim: React.FC<{ set: Set3D; y: number; h: number; depth: number; c: string }> = ({ set, y, h, depth, c }) => {
  const { w, front, back } = set.room;
  const d = front - back;
  return (
    <>
      <Block s={[w, h, depth]} p={[0, y + h / 2, back + depth / 2]} c={c} r={0.005} />
      {[-1, 1].map((sd) => (
        <Block
          key={sd}
          s={[depth, h, d]}
          p={[sd * (w / 2 - depth / 2), y + h / 2, (front + back) / 2]}
          c={c}
          r={0.005}
        />
      ))}
    </>
  );
};

// dim: 0..1 light level (flicker/blackout). haze = visible light shafts under the lamps (night/horror)
export const SetView: React.FC<{ set: Set3D; dim: number; haze: boolean }> = ({ set, dim, haze }) => {
  const { w, h, front, back } = set.room;
  const d = front - back;
  const zc = (front + back) / 2;
  const lamp = dim < 0.5 ? "#1c2230" : "#f4fbff";
  return (
    <group>
      <Block s={[w, 0.1, d]} p={[0, -0.05, zc]} c={set.floor} r={0} bare map={pattern(set.floorStyle, w, d)} />
      <Block s={[w, 0.1, d]} p={[0, h + 0.05, zc]} c={set.wall} r={0} bare />
      <Block s={[w, h, 0.1]} p={[0, h / 2, back - 0.05]} c={set.wall} r={0} bare map={pattern(set.wallStyle, w, h)} />
      {[-1, 1].map((sd) => (
        <Block
          key={sd}
          s={[0.1, h, d]}
          p={[sd * (w / 2 + 0.05), h / 2, zc]}
          c={set.wall}
          r={0}
          bare
          map={pattern(set.wallStyle, d, h)}
        />
      ))}
      <Trim set={set} y={0} h={0.14} depth={0.04} c={shade(set.wall, 0.45)} />
      <Trim set={set} y={h - 0.14} h={0.14} depth={0.06} c={shade(set.wall, 1.35)} />
      {set.wainscot && (
        <>
          <Trim set={set} y={0.14} h={0.9} depth={0.025} c={set.wainscot} />
          <Trim set={set} y={1.04} h={0.05} depth={0.04} c={shade(set.wainscot, 0.7)} />
        </>
      )}
      {set.lamps.map((l) => (
        <Block key={l.join()} s={[0.9, 0.04, 0.3]} p={l} c={lamp} r={0} glow />
      ))}
      {haze &&
        set.lamps.map((l) => (
          <mesh key={`haze${l.join()}`} position={[l[0], l[1] / 2, l[2]]}>
            <coneGeometry args={[1.1, l[1], 20, 1, true]} />
            <meshBasicMaterial
              color={lamp}
              transparent
              opacity={0.08 * dim}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              side={THREE.BackSide}
            />
          </mesh>
        ))}
      {set.props.map((t) => (
        <PropView key={`${t.type}@${t.pos.join(",")}`} t={t} />
      ))}
    </group>
  );
};
