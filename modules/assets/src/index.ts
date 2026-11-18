export { FakeSnapshot } from "./adapters/fake-snapshot.ts";
export { FakeRasterizer, FfmpegRasterizer } from "./adapters/ffmpeg-rasterizer.ts";
export { lerpPose, type Pose, REST, samplePose } from "./domain/pose.ts";
export type { AssetsDeps, Rasterizer, Snapshot } from "./ports.ts";
export { assetsCheck } from "./stages/check.stage.ts";
export { assetsDesign } from "./stages/design.stage.ts";
export { assetsDraw } from "./stages/draw.stage.ts";
