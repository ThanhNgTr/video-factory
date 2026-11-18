// Remotion: bundle the composition once per process, render frames with CPU WebGL (swangle), mute (audio is muxed after).
import { rmSync } from "node:fs";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { StageError } from "@vf/core";
import type { Renderer, RenderJob, StillJob } from "../ports.ts";

export class RemotionRenderer implements Renderer {
  private bundled = new Map<string, Promise<string>>();

  private bundleOnce(entry: string): Promise<string> {
    let p = this.bundled.get(entry);
    if (!p) {
      p = bundle({ entryPoint: entry, ignoreRegisterRootWarning: true });
      // the bundle (about 50 MB) lands in /tmp, a RAM disk here: a hundred runs that never removed theirs filled it
      // and every write failed. It goes when this process does
      p.then((dir) => process.once("exit", () => rmSync(dir, { recursive: true, force: true })));
      this.bundled.set(entry, p);
    }
    return p;
  }

  async still(job: StillJob): Promise<void> {
    const serveUrl = await this.bundleOnce(job.entry);
    const chromiumOptions = { gl: "swangle" as const };
    const composition = await selectComposition({
      serveUrl,
      id: job.compositionId,
      inputProps: job.props,
      chromiumOptions,
    });
    await renderStill({
      composition,
      serveUrl,
      output: job.outFile,
      inputProps: job.props,
      frame: job.frame ?? 0,
      chromiumOptions,
      imageFormat: "png",
    });
  }

  async render(job: RenderJob): Promise<void> {
    const serveUrl = await this.bundleOnce(job.entry);
    // swangle = CPU WebGL: the dev machine has no usable GPU for headless Chrome (roadmap S1 decides the renderer later)
    const chromiumOptions = { gl: "swangle" as const };
    const composition = await selectComposition({
      serveUrl,
      id: job.compositionId,
      inputProps: job.props,
      chromiumOptions,
    });
    try {
      await renderMedia({
        composition,
        serveUrl,
        codec: "h264",
        outputLocation: job.outFile,
        inputProps: job.props,
        concurrency: job.concurrency,
        chromiumOptions,
        muted: true,
        crf: 20,
        onProgress: ({ progress }) => job.onProgress?.(progress),
      });
    } catch (e) {
      throw new StageError("provider-failed", `remotion render failed: ${(e as Error).message.slice(0, 1000)}`, {
        cause: e,
      });
    }
  }
}
