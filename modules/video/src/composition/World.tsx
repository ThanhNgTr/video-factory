// The 3D stage for the current frame: set, actors on spots, lights, camera. Pure function of (props, frame).

import { useThree } from "@react-three/fiber";
import {
  bodyLift,
  Character2D,
  characterGeometry,
  deg,
  iconTexture,
  lerpPose,
  REST,
  SetView,
  samplePose,
} from "@vf/assets/render";
import {
  exitPoint,
  type Face,
  foreground,
  isRoomShot,
  obstacles,
  ROOM_SHOTS,
  type Shot,
  type Spot,
  sightBlocked,
} from "@vf/contracts";
import type React from "react";
import { Easing, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { dollyZoomFov, fitRoom } from "../domain/framing.ts";
import { propState } from "../domain/prop-motion.ts";
import { mouthAt } from "../domain/viseme.ts";
import { DioramaScene } from "./Diorama.tsx";
import type { RenderProps } from "./props.ts";
import { Weather } from "./Weather.tsx";

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
    ambient: 0.42,
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
const CARD_TINT = { bright: "#ffffff", night: "#dfe3f0", horror: "#d9dde9" } as const;
// characters keep most of their colour in dim light (the mood lives in the set); only a blackout darkens them fully
const cardLevel = (flick: number) => (flick < 0.2 ? flick * 2.5 : 0.5 + 0.5 * flick);
const smooth = (u: number) => u * u * (3 - 2 * u);
const WALK_SPEED = 1.1; // m/s a stride cycle is authored for: the feet then stay planted on the floor
const FACING: Record<Spot["facing"], number> = { camera: 0, right: Math.PI / 2, left: -Math.PI / 2, away: Math.PI };
// one target object per module instance (= per render tab); its position is reset every frame
const KEY_TARGET = new THREE.Object3D();
const hash = (s: string) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 997, 7);

export const World: React.FC<{ p: RenderProps }> = ({ p }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const camera = useThree((st) => st.camera) as THREE.PerspectiveCamera;
  const rowIndex = p.timeline.shots.findIndex((sh) => f >= sh.from && f < sh.from + sh.frames);
  const row = p.timeline.shots[rowIndex] ?? p.timeline.shots.at(-1);
  const s: Shot | undefined = p.scene.shots.find((sh) => sh.id === row?.id);
  const prevRow = p.timeline.shots[rowIndex - 1];
  const prevShot = prevRow && p.scene.shots.find((sh) => sh.id === prevRow.id);
  // a diorama is its own 3D world; a graphic shot draws no room (Graphics.tsx fills the frame)
  if (row && s?.diorama)
    return (
      <DioramaScene
        d={s.diorama}
        prev={p.scene.shots.slice(0, p.scene.shots.indexOf(s)).findLast((sh) => sh.diorama)?.diorama}
        lf={f - row.from}
        frames={row.frames}
        seed={`${p.seed}${s.id}`}
      />
    );
  if (!row || !s || s.graphic || !s.set) return null;
  const lf = f - row.from;
  const set = p.assets.sets[s.set];
  if (!set) return null;
  // red: the monster's light. The room goes red and the cards go nearly black, so only glowing eyes and teeth show
  const red = s.lighting === "red";
  const L = red
    ? {
        ...LIGHT[p.scene.mood],
        fog: "#2a0608",
        ambient: 0.7,
        ambientColor: "#ff3b3b",
        keyColor: "#ff5a3a",
        lamp: "#ff2a2a",
        rim: "#ff2a2a",
      }
    : LIGHT[p.scene.mood];
  const windows = set.props.filter((pr) => pr.type === "window");
  const windowX = windows[0]?.pos[0] ?? set.room.w / 2;
  const windowZ: [number, number] = windows.length
    ? [Math.min(...windows.map((w) => w.pos[2])) - 1.2, Math.max(...windows.map((w) => w.pos[2])) + 1.2]
    : [set.room.back, set.room.front];
  // headlights: the whole room (cards included, they are unlit) swells from dim to full and back over 1.5 s
  const sweep = s.lighting === "headlights" ? Math.sin(Math.PI * Math.min(1, lf / 45)) : 0;
  const flick =
    s.lighting === "blackout"
      ? 0.08
      : s.lighting === "headlights"
        ? 0.55 + 0.45 * sweep
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
  // room shots show everyone present, so someone missing from the next one has left the room by then
  const nextRoom = p.timeline.shots
    .slice(p.timeline.shots.indexOf(row) + 1)
    .map((r) => p.scene.shots.find((sh) => sh.id === r.id))
    .find((sh) => sh !== undefined && isRoomShot(sh));
  const leaves = (id: string) =>
    nextRoom !== undefined && (nextRoom.set !== s.set || !nextRoom.cast.some((c) => c.id === id));

  const actors = s.cast.flatMap((m) => {
    const person = p.assets.people[m.id];
    const a = spotOf(m.spot);
    if (!person || !a) return [];
    const b = m.toSpot ? spotOf(m.toSpot) : undefined;
    // a walker who leaves goes on through the nearest door after reaching their spot; the wall hides them
    const exit = b && leaves(m.id) ? exitPoint(set, b.pos) : undefined;
    const out = exit?.out;
    const seg1 = b ? Math.hypot(b.pos[0] - a.pos[0], b.pos[1] - a.pos[1]) : 0;
    const seg2 = b && out ? Math.hypot(out[0] - b.pos[0], out[1] - b.pos[1]) : 0;
    const pathLen = seg1 + seg2;
    // the walk takes the time the path needs at WALK_SPEED, then the character stands; a long line no longer
    // stretches it into a slow drift. A shot too short for the path still fits the walk in
    const walkFrames = Math.max(1, Math.min(row.frames - 8, Math.round((pathLen / WALK_SPEED) * fps)));
    const k = b ? smooth(Math.min(1, lf / walkFrames)) : 0;
    const along = k * pathLen;
    const exiting = b !== undefined && out !== undefined && along > seg1;
    const p0 = exiting ? b.pos : a.pos;
    const p1 = exiting ? out : (b?.pos ?? a.pos);
    const t = exiting ? (along - seg1) / seg2 : seg1 > 0 ? along / seg1 : 0;
    const x = p0[0] + (p1[0] - p0[0]) * t;
    const z = p0[1] + (p1[1] - p0[1]) * t;
    // the camera frames the leaver up to the door, so the door they go through is in the picture, never past it
    const td = exit && b ? Math.min(1, Math.hypot(exit.door[0] - b.pos[0], exit.door[1] - b.pos[1]) / seg2) : 1;
    const tf = exiting ? Math.min(t, td) : t;
    const fx = p0[0] + (p1[0] - p0[0]) * tf;
    const fz = p0[1] + (p1[1] - p0[1]) * tf;
    let facing = b ? Math.atan2(p1[0] - p0[0], p1[1] - p0[1]) : FACING[a.facing];
    // two people facing the camera turn a little toward each other
    const other = s.cast.find((o) => o.id !== m.id);
    if (!b && a.facing === "camera" && other) {
      const o = spotOf(other.spot);
      if (o) facing = Math.sign(o.pos[0] - a.pos[0]) * 0.45;
    }
    const talking = speaking && s.line?.who === m.id;
    // someone who has the shot's line at a spot that faces away (at the blackboard) turns round for the whole shot,
    // as people do to talk; turning only while the words play made them spin back between lines
    // ...and so does the person a close or medium shot is about: nobody wants the back of a head in a reaction shot
    const framed =
      (s.camera === "closeup" || s.camera === "medium" || s.camera === "zoom-shake") &&
      (s.focus ?? s.cast[0]?.id) === m.id;
    if ((s.line?.who === m.id || framed) && !b && a.facing === "away") facing = FACING.camera;
    const words = talking ? p.timeline.captions.filter((c) => c.shot === s.id) : [];
    const mouth = talking ? mouthAt(words, f, s.id) : null;
    const mouthOpen = talking ? (mouth?.open ?? 0.05) : null;
    const action = p.assets.actions[m.action];
    // a loop keeps its phase across cuts; a walk's phase follows the distance covered; a one-shot restarts per shot
    const poseAt = (fr: number) => {
      const kk = b ? smooth(Math.min(1, (fr - row.from) / walkFrames)) : 0;
      return samplePose(action, b ? (kk * pathLen) / WALK_SPEED : (action?.loop ? fr : fr - row.from) / fps);
    };
    let pose = poseAt(f);
    const prev2 = poseAt(f - 2);
    // hair lags the body: its lean follows how fast the body turned and moved
    const sway = Math.max(-12, Math.min(12, (pose.rot - prev2.rot) * 1.5 + (pose.x - prev2.x) * 80));
    if (b && k >= 1) pose = lerpPose(pose, REST, smooth(Math.min(1, (lf - walkFrames) / 8)));
    // a change of action eases in over 8 frames from where the previous shot left this character
    const pm = prevShot?.cast.find((c) => c.id === m.id);
    if (pm && prevRow && pm.action !== m.action && lf < 8) {
      const prevAction = p.assets.actions[pm.action];
      pose = lerpPose(
        samplePose(prevAction, (prevAction?.loop ? row.from - 1 : prevRow.frames) / fps),
        pose,
        smooth(lf / 8),
      );
    }
    // sitting rests the hips on the spot's seat (a floor sit at 5 cm); lying lies on it (a bed, a sofa) or the floor.
    // Coming from another posture the hips travel over 10 frames while the legs fold
    const posture = action?.posture ?? "stand";
    const spotSeat = a.seat;
    const before = pm ? (p.assets.actions[pm.action]?.posture ?? "stand") : posture;
    const settle = before !== posture ? smooth(Math.min(1, lf / 10)) : 1;
    const seat = posture === "sit" ? (spotSeat ?? 0.05) : undefined;
    const seatW = posture === "sit" ? settle : 1;
    const bed = posture === "lie" ? (spotSeat ?? 0) * settle : 0;
    // a stressed word gets a gesture: a nod, a hand lift or a lean, picked per word
    let tilt = 0;
    const hi = talking ? words.find((w) => w.highlight && f >= w.frame && f < w.frame + 14) : undefined;
    if (hi) {
      const bump = Math.sin((Math.PI * (f - hi.frame)) / 14);
      const v = hash(hi.text) % 3;
      if (v === 0) {
        pose = { ...pose, rot: pose.rot + 4 * bump, y: pose.y + 0.02 * bump };
        tilt = 5 * bump;
      } else if (v === 1) pose = { ...pose, armR: pose.armR + 30 * bump };
      else pose = { ...pose, x: pose.x + 0.04 * bump, rot: pose.rot - 3 * bump };
    }
    // listeners glance toward whoever is speaking
    const sp = speaking && s.line && s.line.who !== m.id ? s.cast.find((c) => c.id === s.line?.who) : undefined;
    const spx = sp ? spotOf(sp.spot)?.pos[0] : undefined;
    const look = spx === undefined ? 0 : Math.sign(spx - x) * 0.7;
    // blinks land at a random moment of each ~3 s cycle, sometimes twice
    const cyc = Math.floor((f + hash(m.id) * 3) / 100);
    const ph = ((f + hash(m.id) * 3) % 100) - Math.floor(random(`${p.seed}bl${m.id}${cyc}`) * 88);
    const blink = (ph >= 0 && ph < 3) || (random(`${p.seed}db${m.id}${cyc}`) > 0.75 && ph >= 7 && ph < 10);
    const face: Face = m.face ?? pose.face ?? "neutral";
    const lift = bodyLift(person, pose, seat, seatW);
    // where the camera finds the head: lower when seated or kneeling, on the pillow when lying
    // lying or fallen flat: the body lies along the floor around its tilt pivot; where its middle is, seen from the
    // front (a card facing left is drawn mirrored), for the camera to frame the whole of it
    const g = characterGeometry(person);
    const down = posture === "lie" || Math.abs(pose.rot) > 60;
    const pivot = g.hipY + g.torsoH * 0.3;
    const downX = x + (facing < -0.25 ? -1 : 1) * Math.sin(pose.rot * deg) * ((g.headY - 2 * pivot) / 2);
    const headY = down ? bed + 0.35 : g.headY * pose.sy + lift;
    return [
      {
        m,
        person,
        x,
        z,
        fx,
        fz,
        facing,
        mouthOpen,
        mouthWide: mouth?.wide ?? 1,
        look,
        tilt,
        sway,
        pose,
        face,
        blink,
        seat,
        seatW,
        bed,
        lying: posture === "lie",
        down,
        downX,
        lift,
        headY,
      },
    ];
  });

  // story props (ADR 0022): drawn icons standing as cards on a spot; on a character's spot they stand beside them,
  // and on a seat spot they rest on the seat (a thermos left on a bench), not on the floor in front of it
  const props = s.props.flatMap((pr) => {
    const sp = spotOf(pr.spot);
    const icon = p.assets.icons[pr.icon];
    if (!sp || !icon) return [];
    const beside = s.cast.some((m) => m.spot === pr.spot) ? 0.9 : 0;
    const x = Math.min(set.room.w / 2 - 0.4, sp.pos[0] + beside);
    const st = propState(pr.motion, lf, fps, pr.at, pr.size);
    return [{ pr, icon, x, z: sp.pos[1], ...st, y: (sp.seat ?? 0) + st.y }];
  });

  // camera. A focused actor is framed from the side they face (a guest with their back to the room is shot from the desk).
  // The subject may be a prop instead: its middle stands in for the head
  const focusProp = props.find((q) => q.pr.id === s.focus);
  const focusActor = actors.find((a) => a.m.id === s.focus) ?? (focusProp ? undefined : actors[0]);
  const focus: { x: number; z: number; headY: number; facing: number; down: boolean; downX: number } | undefined =
    focusActor ??
    (focusProp && {
      x: focusProp.x,
      z: focusProp.z,
      headY: focusProp.y + (focusProp.pr.size * focusProp.scale) / 2,
      facing: 0,
      down: false,
      downX: focusProp.x,
    });
  const fwd = (a: { facing: number }) => ({ x: Math.sin(a.facing), z: Math.cos(a.facing) });
  const clampIn = (v: THREE.Vector3) => {
    v.x = Math.min(set.room.w / 2 - 0.5, Math.max(-set.room.w / 2 + 0.5, v.x));
    v.z = Math.min(set.room.front - 0.5, Math.max(set.room.back + 0.6, v.z));
    return v;
  };
  // a room shot frames the story props too: "his seat is empty" is about the thermos left on it, not the people
  const framed = [
    ...actors.map((a) => ({ x: a.fx, z: a.fz })),
    ...(ROOM_SHOTS.has(s.camera) ? props.map((q) => ({ x: q.x, z: q.z })) : []),
  ];
  const centerZ = framed.length ? framed.reduce((n, a) => n + a.z, 0) / framed.length : -1;
  const centerX = framed.length ? framed.reduce((n, a) => n + a.x, 0) / framed.length : 0;
  const pos = new THREE.Vector3(centerX * 0.5, 1.6, centerZ + 6.2);
  const look = new THREE.Vector3(centerX * 0.8, 1.15, centerZ);
  let fov = 45;
  const aspect = p.timeline.width / p.timeline.height;
  // a medium shot of several people with nobody in focus is a two-shot: framed like a room shot, closer. Aimed at the
  // first person, the other one stood between the lens and them, huge and cut by the frame
  const twoShot = s.camera === "medium" && !s.focus && actors.length > 1;
  if (framed.length > 1 && (ROOM_SHOTS.has(s.camera) || twoShot)) {
    // a room shot backs up (or widens) until everyone fits with a margin; a 9:16 frame is narrow
    // the push moves 1.6 m closer and the pan slides 0.7 m sideways by the end: frame the end of the move
    const fit = fitRoom(framed, {
      cx: centerX,
      fov,
      aspect,
      pad: twoShot ? 0.6 : 0.8,
      slide: s.camera === "pan" ? 0.7 : 0,
      push: s.camera === "push" ? 1.6 : 0,
      minZ: centerZ + (twoShot ? 3.4 : 6.2),
      maxZ: set.room.front - 0.5,
    });
    fov = fit.fov;
    pos.set(fit.x, 1.6, fit.z);
    look.x = fit.x;
  }
  // where an actor's right hand is (world space) and how far it reaches sideways on the card: shoulder, upper arm,
  // the elbow bend Character2D draws, forearm
  const handOf = (a: (typeof actors)[number]) => {
    const g = characterGeometry(a.person);
    const upper = 0.45 * g.armLen;
    const lower = 0.45 * g.armLen;
    const open = a.pose.armR;
    const rot = Math.max(0, open - 12) * deg;
    const bend = Math.min(1, Math.max(0, (open - 30) / 60)) * 55 * deg;
    const hx = g.torsoW / 2 - 0.01 + upper * Math.sin(rot) + lower * Math.sin(rot + bend);
    const hy = (g.shoulderY - 0.07 - upper * Math.cos(rot) - lower * Math.cos(rot + bend) - 0.04) * a.pose.sy + a.lift;
    const d = fwd(a);
    return { hx, d, at: new THREE.Vector3(a.x + hx * d.z, hy, a.z - hx * d.x) };
  };
  // an item held out to the side pulls the frame toward it, so the hand and the item stay in the picture
  // ...but never so far that the head leaves the frame: at `dist` metres a 9:16 frame is only so wide
  const reach = (a: (typeof actors)[number], share: number, dist: number) => {
    if (!a.m.holds || a.pose.armR < 40) return;
    const { hx, d } = handOf(a);
    const room = dist * Math.tan((fov / 2) * deg) * aspect - characterGeometry(a.person).head.w / 2 - 0.05;
    const shift = Math.sign(hx) * Math.min(Math.abs(hx * share), Math.max(0, room));
    pos.x += shift * d.z;
    pos.z -= shift * d.x;
    look.x += shift * d.z;
    look.z -= shift * d.x;
  };
  // a close-up of a big gesture (arms out or up) stands back so the hands stay in: from the action's widest key, so
  // the camera holds still through the shot
  const spread = Math.max(
    0,
    ...(p.assets.actions[focusActor?.m.action ?? ""]?.keys ?? []).map((k) =>
      Math.max(Math.abs(k.armL ?? 0), Math.abs(k.armR ?? 0)),
    ),
  );
  // (beside an inset card the close-up stands further back, so the head clears the card)
  const closeDist = Math.max(s.inset ? 3.4 : 0, 2.5 + 1.3 * Math.min(1, Math.max(0, (spread - 50) / 90)));
  // a close camera on the side someone faces can land behind a wall (a person facing the blackboard): clampIn then
  // pulls it inside the person. Film from the room's open front instead, and widen the lens if even that is short
  const keepDistance = (want: number) => {
    if (!focus || Math.hypot(pos.x - focus.x, pos.z - focus.z) >= want * 0.8) return;
    clampIn(pos.set(focus.x, pos.y, focus.z + want));
    look.set(focus.x, look.y, focus.z);
    const got = Math.hypot(pos.x - focus.x, pos.z - focus.z);
    if (got < want * 0.95)
      fov = Math.min(80, (2 * Math.atan((Math.tan((fov / 2) * deg) * want) / Math.max(0.5, got))) / deg);
  };
  if (focusProp && focus && (s.camera === "closeup" || s.camera === "medium" || s.camera === "insert")) {
    // a prop in focus: straight in front of it, a little above, far enough back that its square card takes the share
    // of the narrow frame's width the shot wants (an insert nearly fills it, a medium leaves room around it)
    const size = focusProp.pr.size * Math.max(0.2, focusProp.scale);
    fov = s.camera === "medium" ? 42 : s.camera === "closeup" ? 38 : 30;
    const share = s.camera === "medium" ? 0.45 : s.camera === "closeup" ? 0.55 : 0.8; // leaves room for the inset shift
    const dist = size / (share * 2 * Math.tan((fov / 2) * deg) * aspect);
    // a medium shot of a prop beside someone keeps them both: it aims between the two
    const near = s.camera === "medium" ? actors.find((a) => Math.hypot(a.x - focus.x, a.z - focus.z) < 1.6) : undefined;
    const cx = near ? (near.x + focus.x) / 2 : focus.x;
    clampIn(pos.set(cx, focus.headY + 0.3, focus.z + dist));
    look.set(cx, focus.headY, focus.z);
  } else if (focus?.down && !twoShot && (s.camera === "closeup" || s.camera === "medium")) {
    // someone lying down: a shot from the open front that takes in the whole body, aimed below it so the body sits
    // above the captions instead of under them
    clampIn(pos.set(focus.downX, 1.3, focus.z + 5.6));
    look.set(focus.downX, focus.headY - 0.75, focus.z);
    fov = 48;
  } else if (focus && s.camera === "closeup") {
    const hy = focus.headY;
    const d = fwd(focus);
    clampIn(pos.set(focus.x + d.x * closeDist - d.z * 0.5, hy, focus.z + d.z * closeDist + d.x * 0.5));
    look.set(focus.x, hy - 0.25 - 0.15 * ((closeDist - 2.5) / 1.3), focus.z);
    fov = 38;
    keepDistance(closeDist);
    if (focusActor) reach(focusActor, 0.45, closeDist);
  } else if (focus && s.camera === "over-shoulder") {
    const other = actors.find((a) => a !== focusActor) ?? focus;
    const hy = focus.headY;
    pos.set(other.x + (other.x > focus.x ? 0.6 : -0.6), hy + 0.2, other.z + 1.2);
    look.set(focus.x, hy - 0.2, focus.z);
    fov = 40;
  } else if (focus && s.camera === "medium" && !twoShot) {
    const hy = focus.headY;
    const d = fwd(focus);
    clampIn(pos.set(focus.x + d.x * 4.2, hy - 0.2, focus.z + d.z * 4.2));
    look.set(focus.x, hy - 0.6, focus.z);
    fov = 42;
    keepDistance(4.2);
    if (focusActor) reach(focusActor, 0.5, 4.2);
  } else if (focusActor && s.camera === "insert") {
    // the held item fills the frame. The camera stays straight in front (so the card is not mirrored and its +x is
    // the character's right), above the hand looking down: a counter in front of the character stays below the lens
    const { d, at: hand } = handOf(focusActor);
    clampIn(pos.set(focusActor.x + d.x * 0.9, hand.y + 0.25, focusActor.z + d.z * 0.9));
    look.copy(hand);
    fov = 30;
  } else if (focus && s.camera === "zoom-shake") {
    const k = spring({ frame: lf, fps, config: { damping: 14 } });
    const hy = focus.headY;
    pos.lerp(new THREE.Vector3(focus.x * 0.7, hy - 0.1, focus.z + 3.4), k);
    look.lerp(new THREE.Vector3(focus.x, hy - 0.25, focus.z), k);
  }
  // furniture must not hide the face: a walker is filmed from the room's open front (a side-on stride), and a close
  // camera whose view is blocked moves there too
  if (focus && !twoShot && (s.camera === "closeup" || s.camera === "medium" || s.camera === "over-shoulder")) {
    const hy = focus.headY;
    if (focusActor?.m.toSpot || sightBlocked(obstacles(set), [pos.x, pos.y, pos.z], [focus.x, hy, focus.z])) {
      const close = s.camera === "closeup";
      clampIn(pos.set(focus.x, close ? hy : hy - 0.2, focus.z + (close ? closeDist : 4.2)));
      look.set(focus.x, hy - (close ? 0.25 : 0.6), focus.z);
    }
  }
  // a title, rule card or the vote card covers the top of the frame: tilt up so the people sit lower, under it
  const vote = p.choice && row.id === p.timeline.shots.at(-1)?.id;
  if ((s.text && rowIndex === 0) || vote || s.inset) look.y += pos.distanceTo(look) * Math.tan(fov * 0.09 * deg);
  // an inset card sits at the top right: the subject moves to the left third of the frame, out from under it
  if (s.inset) {
    const side = pos.distanceTo(look) * Math.tan((fov / 2) * deg) * aspect * 0.34;
    const right = new THREE.Vector3()
      .subVectors(look, pos)
      .cross(new THREE.Vector3(0, 1, 0))
      .setY(0)
      .normalize();
    pos.addScaledVector(right, side);
    look.addScaledVector(right, side);
  }
  // the camera beyond its framing (ADR 0025): height and tilt, then the lens
  const up = new THREE.Vector3(0, 1, 0);
  if (s.angle === "low") {
    pos.y = Math.max(0.3, pos.y - 1.0);
    look.y += 0.2;
  } else if (s.angle === "high") {
    pos.y = Math.min(set.room.h - 0.15, pos.y + 1.2);
    look.y -= 0.35;
  } else if (s.angle === "reverse") {
    // from behind the subject, facing the room's front wall: the other side of the picture. A subject against a
    // wall leaves no room behind them, so try mirroring through them on both axes, then on one, and keep the
    // position that stays farthest from them; closer than 60% of the framing's distance, the reverse is dropped
    const d0 = pos.distanceTo(look);
    const best = [
      [2 * look.x - pos.x, 2 * look.z - pos.z],
      [pos.x, 2 * look.z - pos.z],
      [2 * look.x - pos.x, pos.z],
    ]
      .map(([x, z]) => clampIn(new THREE.Vector3(x ?? 0, pos.y, z ?? 0)))
      .sort((a, b) => b.distanceTo(look) - a.distanceTo(look))[0];
    if (best && best.distanceTo(look) >= 0.6 * d0) pos.copy(best);
  }
  // a wide lens steps in and a long lens steps back, so the subject keeps its size and only the depth changes
  const lensK = s.lens === "wide" ? 1.45 : s.lens === "tele" ? 0.65 : 1;
  if (lensK !== 1) {
    const away = new THREE.Vector3().subVectors(pos, look);
    const fov1 = Math.min(90, fov * lensK);
    away.setLength((away.length() * Math.tan((fov / 2) * deg)) / Math.tan((fov1 / 2) * deg));
    clampIn(pos.copy(look).add(away));
    fov = fov1;
  }
  const ease = Easing.inOut(Easing.cubic);
  if (s.camera === "push") pos.z -= 1.6 * ease(lf / row.frames);
  if (s.camera === "pan") {
    const dx = interpolate(lf, [0, row.frames], [-0.7, 0.7], { easing: ease });
    pos.x += dx;
    look.x += dx * 0.5;
  }
  if (s.camera === "shake" || s.camera === "zoom-shake") {
    const decay = Math.max(0, 1 - lf / 14);
    pos.x += (random(`${p.seed}x${f}`) - 0.5) * 0.12 * decay;
    pos.y += (random(`${p.seed}y${f}`) - 0.5) * 0.12 * decay;
  }
  // how the camera travels through the shot; the old push, pan and shake cameras keep their own moves
  if (!["push", "pan", "shake", "zoom-shake"].includes(s.camera) && s.move !== "still") {
    const u = ease(Math.min(1, lf / Math.max(1, row.frames)));
    const fwd = new THREE.Vector3().subVectors(look, pos).setY(0).normalize();
    const side = new THREE.Vector3().crossVectors(fwd, up).normalize();
    const sign = hash(s.id) % 2 ? 1 : -1;
    if (s.move === "drift") pos.addScaledVector(fwd, 0.35 * u).addScaledVector(side, 0.06 * sign * u);
    else if (s.move === "push") pos.addScaledVector(fwd, 1.2 * u);
    else if (s.move === "pull") pos.addScaledVector(fwd, -1.2 * u);
    else if (s.move === "track") {
      pos.addScaledVector(side, 0.9 * sign * (u - 0.5));
      look.addScaledVector(side, 0.45 * sign * (u - 0.5));
    } else if (s.move === "orbit") {
      const away = new THREE.Vector3().subVectors(pos, look).applyAxisAngle(up, 14 * deg * sign * (u - 0.5));
      pos.copy(look).add(away);
    } else if (s.move === "handheld") {
      // a nervous hand: slow sines of two speeds, phases from the shot id, so it never repeats across shots
      const ph = hash(s.id);
      pos.x += 0.03 * Math.sin(f * 0.19 + ph) + 0.015 * Math.sin(f * 0.53 + 2 * ph);
      pos.y += 0.025 * Math.sin(f * 0.23 + 3 * ph) + 0.012 * Math.sin(f * 0.61);
      look.y += 0.01 * Math.sin(f * 0.23 + 3 * ph);
    } else if (s.move === "pan") {
      // the camera turns on its head and lands on the subject: it starts looking 25 degrees aside (ADR 0026)
      look
        .sub(pos)
        .applyAxisAngle(up, 25 * deg * sign * (1 - u))
        .add(pos);
    } else if (s.move === "tilt") {
      // starts on the floor in front of the subject and tilts up to them: feet first, then the face
      look.y -= pos.distanceTo(look) * Math.tan(24 * deg) * (1 - u);
    } else if (s.move === "crane") {
      // rises from below eye level to over the heads, still aimed at the subject: the view opens up
      const top = set.outdoor ? pos.y + 2.5 : set.room.h - 0.15;
      pos.y = interpolate(u, [0, 1], [Math.max(0.5, pos.y - 0.6), Math.max(pos.y, Math.min(top, pos.y + 1.4))]);
    } else if (s.move === "zoom") fov *= 1 - 0.3 * u;
    else if (s.move === "crash-zoom") fov *= 1 - 0.45 * Easing.out(Easing.cubic)(Math.min(1, lf / 8));
    else if (s.move === "dolly-zoom") {
      // dolly in while the lens widens: the subject holds its size and the room stretches away behind them
      const d0 = pos.distanceTo(look);
      const toward = new THREE.Vector3().subVectors(look, pos).normalize();
      pos.addScaledVector(toward, Math.min(d0 - 0.6, 0.45 * d0) * u);
      fov = Math.min(100, dollyZoomFov(fov, d0, pos.distanceTo(look)));
    }
    clampIn(pos);
  }
  // a whip pan comes in turning fast and stops on the shot's framing in 8 frames; the overlay blurs it
  if (s.transition === "whip" && lf < 8) {
    const turn = 70 * deg * (hash(s.id) % 2 ? 1 : -1) * (1 - Easing.out(Easing.cubic)(lf / 8));
    look.sub(pos).applyAxisAngle(up, turn).add(pos);
  }
  // a close shot leaves out the stools and tables between the lens and the person it frames
  const hide =
    focus && (s.camera === "closeup" || s.camera === "medium" || s.camera === "over-shoulder" || s.camera === "insert")
      ? foreground(set, [focus.x, focus.z], [pos.x, pos.z])
      : [];
  camera.position.copy(pos);
  camera.lookAt(look);
  if (s.angle === "dutch") camera.rotateZ((hash(s.id) % 2 ? 7 : -7) * deg); // tilted: something is wrong
  camera.fov = fov;
  camera.updateProjectionMatrix();
  // key light sits above and behind the camera and aims where the camera looks, so faces are lit from the front
  KEY_TARGET.position.set(look.x, 1, look.z);
  KEY_TARGET.updateMatrixWorld();
  const keyPos: [number, number, number] = [pos.x + 1.5, 5, pos.z + 1];
  // 2D cards (characters and props) are unlit: the mood's tint times the light level, near black in the red light
  const cardTint = red
    ? "#3a0d12"
    : `#${new THREE.Color(CARD_TINT[p.scene.mood]).multiplyScalar(cardLevel(flick)).getHexString()}`;
  // rain and snow grey the sky; a flood is a sheet of water rising over the floor in the first 1.5 s
  const sky = s.fx === "rain" ? "#8f9aa6" : s.fx === "snow" ? "#cfd8df" : set.sky;
  const water = s.fx === "water" ? 0.35 * smooth(Math.min(1, lf / 45)) : 0;
  const ground = set.outdoor ? 3 : 1; // the outdoor ground runs past the frame

  return (
    <>
      {/* outdoors the sky is the background and the haze; daylight lifts the shadows */}
      <color attach="background" args={[set.outdoor ? sky : L.fog]} />
      <fog
        attach="fog"
        args={[set.outdoor ? sky : L.fog, L.near * (set.outdoor ? 2 : 1), L.far * (set.outdoor ? 2 : 1)]}
      />
      <ambientLight intensity={(L.ambient + (set.outdoor ? 0.25 : 0)) * (0.5 + 0.5 * flick)} color={L.ambientColor} />
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
      {!set.outdoor &&
        set.lamps.map((l) => (
          <pointLight key={l.join()} position={l} intensity={L.lampI * flick} distance={7} decay={1} color={L.lamp} />
        ))}
      {s.lighting === "headlights" && (
        // a cold light slides past the set's windows (inside the wall they sit on) over the first 1.5 s of the shot;
        // a set without windows gets it along the +x wall
        <pointLight
          position={[
            windowX - Math.sign(windowX) * 0.4,
            2.2,
            interpolate(lf, [0, 45], windowZ, { extrapolateRight: "clamp" }),
          ]}
          intensity={30 * sweep}
          distance={14}
          decay={1}
          color="#eaf2ff"
        />
      )}
      <SetView set={sky === set.sky ? set : { ...set, sky }} dim={flick} haze={p.scene.mood !== "bright"} hide={hide} />
      {(s.fx === "rain" || s.fx === "snow") && (
        <Weather
          kind={s.fx}
          lf={lf}
          seed={`${p.seed}${s.id}`}
          area={{
            w: set.room.w * ground,
            back: set.room.back - (set.outdoor ? 10 : 0),
            front: set.room.front,
            y0: 0,
            h: set.outdoor ? 9 : set.room.h,
          }}
        />
      )}
      {water > 0 && (
        <mesh position={[0, water / 2, (set.room.front + set.room.back) / 2]}>
          <boxGeometry args={[set.room.w * ground, water, (set.room.front - set.room.back) * ground]} />
          <meshBasicMaterial color="#3a7bd5" transparent opacity={0.55} depthWrite={false} />
        </mesh>
      )}
      {props.map((q) => {
        if (q.scale <= 0 || q.opacity <= 0) return null;
        const h = q.pr.size * q.scale;
        return (
          <group key={q.pr.id} position={[q.x, q.y, q.z]} rotation={[0, Math.atan2(pos.x - q.x, pos.z - q.z), 0]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
              <circleGeometry args={[0.4 * h, 24]} />
              <meshBasicMaterial color="#000000" transparent opacity={0.3 * q.opacity} depthWrite={false} />
            </mesh>
            {/* the lean pivots on the base, so a sinking box tips over instead of spinning on its middle */}
            <group rotation={[0, 0, q.rot * deg]}>
              <mesh position={[0, h / 2, 0]}>
                <planeGeometry args={[h, h]} />
                <meshBasicMaterial
                  map={iconTexture(q.icon)}
                  transparent
                  opacity={q.opacity}
                  color={cardTint}
                  depthWrite={false}
                />
              </mesh>
            </group>
          </group>
        );
      })}
      {actors.map((a) => {
        // the card always turns to the camera; the character's own facing decides front/back view and mirroring
        const toCamera = Math.atan2(pos.x - a.x, pos.z - a.z);
        const turn = Math.atan2(Math.sin(a.facing - toCamera), Math.cos(a.facing - toCamera));
        return (
          <group key={a.m.id} position={[a.x, a.bed, a.z]} rotation={[0, toCamera, 0]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
              <circleGeometry args={[0.42 * a.person.build.width, 24]} />
              <meshBasicMaterial color="#000000" transparent opacity={0.35} depthWrite={false} />
            </mesh>
            <Character2D
              p={a.person}
              pose={a.pose}
              face={a.face}
              mouthOpen={a.mouthOpen}
              mouthWide={a.mouthWide}
              look={a.look * (turn < -0.25 ? -1 : 1)}
              tilt={a.tilt}
              sway={a.sway}
              blink={a.blink}
              frame={lf}
              back={Math.abs(turn) > 2.0}
              mirror={turn < -0.25}
              side={Math.max(0, Math.sin(turn) * (turn < -0.25 ? -1 : 1))}
              walking={a.m.toSpot !== undefined}
              seat={a.seat}
              seatW={a.seatW}
              lying={a.lying}
              holds={a.m.holds}
              heldIcon={a.m.holds ? p.assets.icons[a.m.holds] : undefined}
              drip={a.m.drip}
              tint={cardTint}
            />
          </group>
        );
      })}
    </>
  );
};
