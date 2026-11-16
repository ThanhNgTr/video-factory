import type { Assets, Scene, Timeline } from "@vf/contracts";

// Everything the browser-side composition needs, resolved by video.render. Serialisable JSON only.
export type RenderProps = {
  timeline: Timeline;
  scene: Scene;
  assets: Assets;
  seed: string;
  choice?: { option1: string; option2: string };
};
