// Character sheet: one person from three angles plus a head close-up, under neutral light. Used by `vf preview`.
import { ThreeCanvas } from "@remotion/three";
import { Character2D, type Pose, REST, samplePose } from "@vf/assets/render";
import type { Action, CastMember, Face, Person } from "@vf/contracts";
import type React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

export type PreviewProps = {
  person: Person;
  action?: Action;
  face: Face;
  holds?: CastMember["holds"];
  drip?: CastMember["drip"];
};

// 2D cards always face the camera; the three views are front, mirrored and back
const Figure: React.FC<{
  p: Person;
  pose: Pose;
  face: Face;
  x: number;
  y: number;
  view: "front" | "mirror" | "back";
  scale?: number;
  frame: number;
  holds?: CastMember["holds"];
  drip?: CastMember["drip"];
}> = ({ p, pose, face, x, y, view, scale = 1, frame, holds, drip }) => (
  <group position={[x, y, 0]} scale={scale}>
    <Character2D
      p={p}
      pose={pose}
      face={face}
      mouthOpen={null}
      blink={false}
      frame={frame}
      back={view === "back"}
      mirror={view === "mirror"}
      holds={holds}
      drip={drip}
    />
  </group>
);

export const Preview: React.FC<PreviewProps> = ({ person, action, face, holds, drip }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pose = action ? samplePose(action, frame / fps) : REST;
  return (
    <AbsoluteFill style={{ backgroundColor: "#2b2f3a" }}>
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
          x={-1.05}
          y={0.6}
          view="front"
          frame={frame}
          holds={holds}
          drip={drip}
        />
        <Figure
          p={person}
          pose={pose}
          face={face}
          x={0}
          y={0.6}
          view="mirror"
          frame={frame}
          holds={holds}
          drip={drip}
        />
        <Figure p={person} pose={pose} face={face} x={1.05} y={0.6} view="back" frame={frame} />
        {/* head close-up: a 2.6x copy whose body sits below the frame */}
        <Figure
          p={person}
          pose={REST}
          face={face}
          x={0}
          y={-0.7 - 2.6 * (1.29 * person.build.height + 0.06 + 0.3 * person.build.head)}
          view="front"
          holds={holds}
          drip={drip}
          scale={2.6}
          frame={frame}
        />
      </ThreeCanvas>
      <AbsoluteFill
        style={{ padding: 40, color: "#fff", fontFamily: "Noto Sans, sans-serif", fontSize: 36, fontWeight: 700 }}
      >
        {person.name} · {person.id} · {face}
        {action ? ` · ${action.id}` : ""}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
