// A set's design picture is a hand-built one-shot video: it must be a complete scene and timeline, every default
// filled, or the composition reads a missing field (a shot without `props` crashed assets.design).
import { join } from "node:path";
import { Shot, Timeline } from "@vf/contracts";
import { loadLibrary } from "@vf/core";
import type { Renderer, RenderProps, StillJob } from "@vf/video";
import { describe, expect, it } from "vitest";
import { RemotionSnapshot } from "../src/snapshot.ts";

const library = loadLibrary(join(new URL("../../..", import.meta.url).pathname, "library"));

describe("RemotionSnapshot.set", () => {
  it("renders a complete one-shot scene", async () => {
    const jobs: StillJob[] = [];
    const renderer = {
      still: async (j: StillJob) => {
        jobs.push(j);
      },
    } as unknown as Renderer;
    const set = Object.values(library.sets)[0];
    if (!set) throw new Error("library has no set");
    await new RemotionSnapshot(renderer).set(set, "/dev/null");
    const p = jobs[0]?.props as RenderProps;
    // one shot, not a whole Scene (a video needs three): each shot complete
    for (const shot of p.scene.shots) expect(Shot.parse(shot)).toEqual(shot);
    expect(Timeline.parse(p.timeline)).toEqual(p.timeline);
  });
});
