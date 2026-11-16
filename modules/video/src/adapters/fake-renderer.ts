// FakeRenderer: a grey clip of the right length, for pipeline tests without Chrome.
import { ffmpeg } from "@vf/core";
import type { Renderer, RenderJob, StillJob } from "../ports.ts";

export class FakeRenderer implements Renderer {
  async still(job: StillJob): Promise<void> {
    await ffmpeg(["-f", "lavfi", "-i", "color=c=0x203040:s=1080x1920:d=0.1", "-frames:v", "1", job.outFile]);
  }

  async render(job: RenderJob): Promise<void> {
    const tl = job.props.timeline as { totalFrames: number; fps: number; width: number; height: number };
    await ffmpeg([
      "-f",
      "lavfi",
      "-i",
      `color=c=0x203040:s=${tl.width}x${tl.height}:r=${tl.fps}:d=${(tl.totalFrames / tl.fps).toFixed(3)}`,
      "-pix_fmt",
      "yuv420p",
      job.outFile,
    ]);
  }
}
