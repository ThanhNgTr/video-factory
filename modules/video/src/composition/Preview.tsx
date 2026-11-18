// Character sheet: one person from four angles plus a head close-up, under neutral light. Used by `vf preview`.
import { ThreeCanvas } from "@remotion/three";
import { Character2D, IconsReady, type Pose, REST, samplePose } from "@vf/assets/render";
import type { Action, CastMember, Face, Person } from "@vf/contracts";
import type React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

export type PreviewProps = {
  person: Person;
  action?: Action;
  face: Face;
  holds?: CastMember["holds"];
  heldIcon?: { id: string; svg: string }; // the drawing when holds names an icon
  drip?: CastMember["drip"];
};

// 2D cards always face the camera; the four views are front, turned right, turned left and back
const Figure: React.FC<{
  p: Person;
  pose: Pose;
  face: Face;
  x: number;
  y: number;
  view: "front" | "right" | "left" | "back";
  scale?: number;
  frame: number;
  holds?: CastMember["holds"];
  heldIcon?: { id: string; svg: string };
  drip?: CastMember["drip"];
  seat?: number;
  lying?: boolean;
}> = ({ p, pose, face, x, y, view, scale = 1, frame, holds, heldIcon, drip, seat, lying }) => (
  <group position={[x, y, 0]} scale={scale}>
    <Character2D
      p={p}
      pose={pose}
      face={face}
      mouthOpen={null}
      blink={false}
      frame={frame}
      back={view === "back"}
      mirror={view === "left"}
      side={view === "right" || view === "left" ? 1 : 0}
      holds={holds}
      heldIcon={heldIcon}
      drip={drip}
      seat={seat}
      lying={lying}
    />
  </group>
);

export const Preview: React.FC<PreviewProps> = ({ person, action, face, holds, heldIcon, drip }) => {
  // a tall character (monsters, big adults) is shown smaller, so the four views keep their heads in frame
  const fit = Math.min(1, 1 / person.build.height);
  // a sitting action is shown on a chair-high seat (the sheet has no furniture)
  const seat = action?.posture === "sit" ? 0.45 : undefined;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pose = action ? samplePose(action, frame / fps) : REST;
  return (
    <AbsoluteFill style={{ backgroundColor: "#2b2f3a" }}>
      <IconsReady icons={heldIcon ? [heldIcon] : []}>
        <ThreeCanvas
          width={1080}
          height={1920}
          shadows="percentage"
          flat
          camera={{ fov: 40, near: 0.1, far: 50, position: [0, 1.3, 7.6] }}
        >
          <color attach="background" args={["#2b2f3a"]} />
          <ambientLight intensity={0.9} color="#ffffff" />
          <directionalLight
            position={[2, 6, 8]}
            intensity={1.3}
            color="#fff4e6"
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-bias={-0.0004}
            shadow-normalBias={0.02}
          />
          <directionalLight position={[-5, 4, -3]} intensity={0.8} color="#cfe3ff" />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.6, 0]} receiveShadow>
            <planeGeometry args={[8, 2.4]} />
            <meshStandardMaterial color="#3a3f4d" />
          </mesh>
          <Figure
            p={person}
            pose={pose}
            face={face}
            x={-1.2}
            y={0.6}
            scale={fit}
            view="front"
            frame={frame}
            holds={holds}
            heldIcon={heldIcon}
            drip={drip}
            seat={seat}
            lying={action?.posture === "lie"}
          />
          <Figure
            p={person}
            pose={pose}
            face={face}
            x={-0.4}
            y={0.6}
            scale={fit}
            view="right"
            frame={frame}
            holds={holds}
            heldIcon={heldIcon}
            drip={drip}
            seat={seat}
            lying={action?.posture === "lie"}
          />
          <Figure
            p={person}
            pose={pose}
            face={face}
            x={0.4}
            y={0.6}
            scale={fit}
            view="left"
            frame={frame}
            holds={holds}
            heldIcon={heldIcon}
            drip={drip}
            seat={seat}
            lying={action?.posture === "lie"}
          />
          <Figure
            p={person}
            pose={pose}
            face={face}
            x={1.2}
            y={0.6}
            scale={fit}
            view="back"
            frame={frame}
            holds={holds}
            heldIcon={heldIcon}
            drip={drip}
            seat={seat}
            lying={action?.posture === "lie"}
          />
          {/* head close-up: a 2.6x copy whose body sits below the frame */}
          <Figure
            p={person}
            pose={REST}
            face={face}
            x={0}
            y={-0.7 - 2.6 * (1.29 * person.build.height + 0.06 + 0.3 * person.build.head)}
            view="front"
            holds={holds}
            heldIcon={heldIcon}
            drip={drip}
            seat={seat}
            lying={action?.posture === "lie"}
            scale={2.6}
            frame={frame}
          />
        </ThreeCanvas>
      </IconsReady>
      {/* the label sits at the bottom: at the top it covered the heads the design gate judges */}
      <AbsoluteFill
        style={{
          padding: 40,
          justifyContent: "flex-end",
          color: "#fff",
          fontFamily: "Noto Sans, sans-serif",
          fontSize: 36,
          fontWeight: 700,
          textShadow: "0 2px 8px #000",
        }}
      >
        {person.name} · {person.id} · {face}
        {action ? ` · ${action.id}` : ""}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
