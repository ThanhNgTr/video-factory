import { ThreeCanvas } from "@remotion/three";
import type React from "react";
import { AbsoluteFill } from "remotion";
import { Overlay } from "./Overlay.tsx";
import type { RenderProps } from "./props.ts";
import { World } from "./World.tsx";

export const Video: React.FC<RenderProps> = (p) => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    {/* one canvas for the whole video: a canvas per shot would leak WebGL contexts */}
    <ThreeCanvas
      width={p.timeline.width}
      height={p.timeline.height}
      shadows="percentage"
      flat
      camera={{ fov: 45, near: 0.1, far: 100, position: [0, 1.6, 7] }}
    >
      <World p={p} />
    </ThreeCanvas>
    <Overlay p={p} />
  </AbsoluteFill>
);
