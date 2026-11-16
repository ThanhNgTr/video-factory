// The 3D stage for the current frame: set, actors on spots, lights, camera. Pure function of (props, frame).

import { useThree } from "@react-three/fiber";
import { Character2D, characterGeometry, SetView, samplePose } from "@vf/assets/render";
import type { Face, Shot, Spot } from "@vf/contracts";
import type React from "react";
import { interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import type { RenderProps } from "./props.ts";

const LIGHT = {
  bright: {
    fog: "#cfd8e3",
    near: 12,
    far: 40,
    ambient: 0.9,
    ambientColor: "#ffffff",
    key: 1.1,
    keyColor: "#fff4e0",
    lamp: "#fff4e0",
    lampI: 0.8,
    rim: "#dbe6ff",
    rimI: 0.5,
  },
  night: {
    fog: "#0a1226",
    near: 8,
    far: 26,
    ambient: 0.45,
    ambientColor: "#6e7fb3",
    key: 1.2,
    keyColor: "#ffd9a8",
    lamp: "#ffe3b8",
    lampI: 0.9,
    rim: "#5f7fff",
    rimI: 0.7,
  },
  horror: {
    fog: "#05070f",
    near: 5,
    far: 17,
    ambient: 0.32,
    ambientColor: "#5a6a9a",
    key: 1.1,
    keyColor: "#ffd2a0",
    lamp: "#ffd9a8",
    lampI: 0.7,
    rim: "#4a6cff",
    rimI: 0.6,
  },
};
// 2D cards are unlit: they take the scene's mood colour times its light level (flicker, dim, blackout)
const CARD_TINT = { bright: "#ffffff", night: "#c3cbe6", horror: "#aab3cd" } as const;
const FACING: Record<Spot["facing"], number> = { camera: 0, right: Math.PI / 2, left: -Math.PI / 2, away: Math.PI };
// one target object per module instance (= per render tab); its position is reset every frame
const KEY_TARGET = new THREE.Object3D();
const hash = (s: string) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 997, 7);

export const World: React.FC<{ p: RenderProps }> = ({ p }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const camera = useThree((st) => st.camera) as THREE.PerspectiveCamera;
  const row = p.timeline.shots.find((sh) => f >= sh.from && f < sh.from + sh.frames) ?? p.timeline.shots.at(-1);
  const s: Shot | undefined = p.scene.shots.find((sh) => sh.id === row?.id);
  if (!row || !s) return null;
  const lf = f - row.from;
  const set = p.assets.sets[s.set];
  if (!set) return null;
  const L = LIGHT[p.scene.mood];
  const flick =
    s.lighting === "blackout"
      ? 0.08
      : s.lighting === "dim"
        ? 0.55
        : s.lighting === "flicker" && random(`${p.seed}fl${s.id}${Math.floor(lf / 2)}`) > 0.72
          ? 0.15
          : 1;
  const speaking =
    row.speechFrom !== undefined &&
    row.speechFrames !== undefined &&
    f >= row.speechFrom &&
    f < row.speechFrom + row.speechFrames;
  const spotOf = (id: string) => set.spots.find((sp) => sp.id === id) ?? set.spots[0];

  const actors = s.cast.flatMap((m) => {
    const person = p.assets.people[m.id];
    const a = spotOf(m.spot);
    if (!person || !a) return [];
    const b = m.toSpot ? spotOf(m.toSpot) : undefined;
    const k = b ? Math.min(1, lf / Math.max(1, row.frames - 8)) : 0;
    const x = b ? a.pos[0] + (b.pos[0] - a.pos[0]) * k : a.pos[0];
    const z = b ? a.pos[1] + (b.pos[1] - a.pos[1]) * k : a.pos[1];
    let facing = b ? Math.atan2(b.pos[0] - a.pos[0], b.pos[1] - a.pos[1]) : FACING[a.facing];
    // two people facing the camera turn a little toward each other
    const other = s.cast.find((o) => o.id !== m.id);
    if (!b && a.facing === "camera" && other) {
      const o = spotOf(other.spot);
      if (o) facing = Math.sign(o.pos[0] - a.pos[0]) * 0.45;
    }
    const talking = speaking && s.line?.who === m.id;
    const words = talking ? p.timeline.captions.filter((c) => c.shot === s.id) : [];
    const inWord = words.some((w, i) => f >= w.frame && f < (words[i + 1]?.frame ?? w.frame + 8));
    // mouth opens on word starts (viseme-lite): closed between words
    const mouthOpen = talking ? (inWord ? 0.35 + 0.65 * Math.abs(Math.sin(lf * 0.9)) : 0.05) : null;
    const pose = samplePose(p.assets.actions[m.action], lf / fps);
    const face: Face = m.face ?? pose.face ?? "neutral";
    return [{ m, person, x, z, facing, mouthOpen, pose, face, blink: (lf + hash(m.id)) % 95 < 3 }];
  });

  // camera. A focused actor is framed from the side they face (a guest with their back to the room is shot from the desk).
  const focus = actors.find((a) => a.m.id === s.focus) ?? actors[0];
  const fwd = (a: { facing: number }) => ({ x: Math.sin(a.facing), z: Math.cos(a.facing) });
  const clampIn = (v: THREE.Vector3) => {
    v.x = Math.min(set.room.w / 2 - 0.5, Math.max(-set.room.w / 2 + 0.5, v.x));
    v.z = Math.min(set.room.front - 0.5, Math.max(set.room.back + 0.6, v.z));
    return v;
  };
  const centerZ = actors.length ? actors.reduce((n, a) => n + a.z, 0) / actors.length : -1;
  const centerX = actors.length ? actors.reduce((n, a) => n + a.x, 0) / actors.length : 0;
  const pos = new THREE.Vector3(centerX * 0.5, 1.6, centerZ + 6.2);
  const look = new THREE.Vector3(centerX * 0.8, 1.15, centerZ);
  let fov = 45;
  if (focus && s.camera === "closeup") {
    const hy = characterGeometry(focus.person).headY * focus.pose.sy;
    const d = fwd(focus);
    clampIn(pos.set(focus.x + d.x * 2.5 - d.z * 0.5, hy, focus.z + d.z * 2.5 + d.x * 0.5));
    look.set(focus.x, hy - 0.25, focus.z);
    fov = 38;
  } else if (focus && s.camera === "over-shoulder") {
    const other = actors.find((a) => a !== focus) ?? focus;
    const hy = characterGeometry(focus.person).headY;
    pos.set(other.x + (other.x > focus.x ? 0.6 : -0.6), hy + 0.2, other.z + 1.2);
    look.set(focus.x, hy - 0.2, focus.z);
    fov = 40;
  } else if (focus && s.camera === "medium") {
    const hy = characterGeometry(focus.person).headY;
    const d = fwd(focus);
    clampIn(pos.set(focus.x + d.x * 4.2, hy - 0.2, focus.z + d.z * 4.2));
    look.set(focus.x, hy - 0.6, focus.z);
    fov = 42;
  } else if (focus && s.camera === "zoom-shake") {
    const k = spring({ frame: lf, fps, config: { damping: 14 } });
    const hy = characterGeometry(focus.person).headY;
    pos.lerp(new THREE.Vector3(focus.x * 0.7, hy - 0.1, focus.z + 3.4), k);
    look.lerp(new THREE.Vector3(focus.x, hy - 0.25, focus.z), k);
  }
  if (s.camera === "push") pos.z -= 1.6 * (lf / row.frames);
  if (s.camera === "pan") {
    const dx = interpolate(lf, [0, row.frames], [-0.7, 0.7]);
    pos.x += dx;
    look.x += dx * 0.5;
  }
  if (s.camera === "shake" || s.camera === "zoom-shake") {
    const decay = Math.max(0, 1 - lf / 14);
    pos.x += (random(`${p.seed}x${f}`) - 0.5) * 0.12 * decay;
    pos.y += (random(`${p.seed}y${f}`) - 0.5) * 0.12 * decay;
  }
  camera.position.copy(pos);
  camera.lookAt(look);
  camera.fov = fov;
  camera.updateProjectionMatrix();
  // key light sits above and behind the camera and aims where the camera looks, so faces are lit from the front
  KEY_TARGET.position.set(look.x, 1, look.z);
  KEY_TARGET.updateMatrixWorld();
  const keyPos: [number, number, number] = [pos.x + 1.5, 5, pos.z + 1];

  return (
    <>
      <color attach="background" args={[L.fog]} />
      <fog attach="fog" args={[L.fog, L.near, L.far]} />
      <ambientLight intensity={L.ambient * (0.5 + 0.5 * flick)} color={L.ambientColor} />
      {/* key light above the camera so faces always read; the only shadow caster (one depth pass, cheap on CPU WebGL) */}
      <primitive object={KEY_TARGET} />
      <directionalLight
        position={keyPos}
        target={KEY_TARGET}
        intensity={L.key * flick}
        color={L.keyColor}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-camera-far={40}
      />
      {/* rim lights from behind both sides: a bright edge separates dark clothes from a dark room */}
      {[-1, 1].map((sd) => (
        <directionalLight key={sd} position={[sd * 5, 4, centerZ - 4]} intensity={L.rimI * flick} color={L.rim} />
      ))}
      {set.lamps.map((l) => (
        <pointLight key={l.join()} position={l} intensity={L.lampI * flick} distance={7} decay={1} color={L.lamp} />
      ))}
      <SetView set={set} dim={flick} haze={p.scene.mood !== "bright"} />
      {actors.map((a) => {
        // the card always turns to the camera; the character's own facing decides front/back view and mirroring
        const toCamera = Math.atan2(pos.x - a.x, pos.z - a.z);
        const turn = Math.atan2(Math.sin(a.facing - toCamera), Math.cos(a.facing - toCamera));
        return (
          <group key={a.m.id} position={[a.x, 0, a.z]} rotation={[0, toCamera, 0]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
              <circleGeometry args={[0.42 * a.person.build.width, 24]} />
              <meshBasicMaterial color="#000000" transparent opacity={0.35} depthWrite={false} />
            </mesh>
            <Character2D
              p={a.person}
              pose={a.pose}
              face={a.face}
              mouthOpen={a.mouthOpen}
              blink={a.blink}
              frame={lf}
              back={Math.abs(turn) > 2.0}
              mirror={turn < -0.25}
              tint={`#${new THREE.Color(CARD_TINT[p.scene.mood]).multiplyScalar(Math.max(0.12, flick)).getHexString()}`}
            />
          </group>
        );
      })}
    </>
  );
};
