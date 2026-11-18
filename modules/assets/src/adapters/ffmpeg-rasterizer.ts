import { ffmpeg } from "@vf/core";
import type { Rasterizer } from "../ports.ts";

// FFmpeg's librsvg decoder draws the SVG; the white canvas behind it is what a viewer of the icon would see on paper
export class FfmpegRasterizer implements Rasterizer {
  async png(svgFile: string, pngFile: string, px: number): Promise<void> {
    await ffmpeg([
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=white:s=${px}x${px}`,
      "-i",
      svgFile,
      "-filter_complex",
      "[0][1]overlay=(W-w)/2:(H-h)/2",
      "-frames:v",
      "1",
      pngFile,
    ]);
  }
}

// tests: any PNG-shaped file will do, the fake LLM never looks
export class FakeRasterizer implements Rasterizer {
  readonly files: string[] = [];
  async png(_svgFile: string, pngFile: string): Promise<void> {
    this.files.push(pngFile);
  }
}
