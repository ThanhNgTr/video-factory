import type { Llm } from "@vf/core";

export type RenderJob = {
  entry: string;
  compositionId: string;
  props: Record<string, unknown>;
  outFile: string;
  concurrency: number;
  onProgress?: (p: number) => void;
};
export type StillJob = {
  entry: string;
  compositionId: string;
  props: Record<string, unknown>;
  outFile: string;
  frame?: number;
};
export interface Renderer {
  render(job: RenderJob): Promise<void>;
  still(job: StillJob): Promise<void>;
}
// a vision reviewer for video.review: Claude, Codex, or a fake in tests
export type Reviewer = { name: string; llm: Llm };
export type VideoDeps = { renderer: Renderer; reviewers: Reviewer[] };
