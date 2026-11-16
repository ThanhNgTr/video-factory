import type React from "react";
import { Composition } from "remotion";
import { Preview, type PreviewProps } from "./Preview.tsx";
import type { RenderProps } from "./props.ts";
import { Video } from "./Video.tsx";

// Real props always come from video.render. These defaults only let Remotion Studio open.
const empty: RenderProps = {
  timeline: { schemaVersion: 1, fps: 30, width: 1080, height: 1920, totalFrames: 30, shots: [], captions: [] },
  scene: { schemaVersion: 1, title: "empty", mood: "night", shots: [] as never },
  assets: { schemaVersion: 1, people: {}, actions: {}, sets: {} },
  seed: "studio",
};

const previewDefaults: PreviewProps = {
  person: {
    schemaVersion: 1,
    id: "preview",
    name: "Preview",
    genre: "people",
    build: { height: 1, width: 1, head: 1 },
    skin: "#f1c3a0",
    hair: { style: "short", color: "#3a2a22" },
    face: { eyes: "dot", brows: "thin", mustache: false, glasses: false, grin: false },
    outfit: { top: "tshirt", topColor: "#2c6e6a", pants: "#22263a", accent: "#c9a227" },
    wear: [],
    voice: { id: "en-US-GuyNeural", pitch: "+0Hz", rate: "+0%" },
    personality: "preview",
  },
  face: "neutral",
};

export const Root: React.FC = () => (
  <>
    <Composition
      id="Preview"
      component={Preview}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={60}
      defaultProps={previewDefaults}
    />
    <Composition
      id="Main"
      component={Video}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={30}
      defaultProps={empty}
      calculateMetadata={({ props }) => ({
        durationInFrames: Math.max(1, props.timeline.totalFrames),
        fps: props.timeline.fps,
        width: props.timeline.width,
        height: props.timeline.height,
      })}
    />
  </>
);
