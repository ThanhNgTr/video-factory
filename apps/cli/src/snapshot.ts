// Pictures of designs for the assets gate (ADR 0018), drawn by the video module's compositions. Joining the two
// modules is the composition root's job, so this adapter lives here.
import type { Snapshot } from "@vf/assets";
import type { Person, Set3D } from "@vf/contracts";
import { COMPOSITION_ENTRY, type Renderer, type RenderProps } from "@vf/video";

export class RemotionSnapshot implements Snapshot {
  private readonly renderer: Renderer;
  constructor(renderer: Renderer) {
    this.renderer = renderer;
  }
  async person(p: Person, outFile: string): Promise<void> {
    await this.renderer.still({
      entry: COMPOSITION_ENTRY,
      compositionId: "Preview",
      props: { person: p, face: "neutral" }, // a smile would read every role as friendly
      outFile,
      frame: 12,
    });
  }
  // the empty set in a one-shot video, from the wide camera, under bright light
  async set(s: Set3D, outFile: string): Promise<void> {
    // typed, so a field a contract adds (shot props, timeline cues) is a compile error here, not a broken render
    const props: RenderProps = {
      timeline: {
        schemaVersion: 1,
        fps: 30,
        width: 1080,
        height: 1920,
        totalFrames: 30,
        shots: [{ id: "s", from: 0, frames: 30 }],
        captions: [],
        cues: [],
      },
      scene: {
        schemaVersion: 1,
        title: "set",
        mood: "bright",
        shots: [
          {
            id: "s",
            beat: "b",
            set: s.id,
            camera: "wide",
            angle: "eye",
            lens: "normal",
            move: "still",
            transition: "cut",
            jcut: false,
            cast: [],
            props: [],
            lighting: "normal",
            dur: 1,
            sfx: [],
          },
        ],
        icons: [],
      },
      assets: { schemaVersion: 1, people: {}, actions: {}, sets: { [s.id]: s }, icons: {} },
      seed: "snapshot",
    };
    await this.renderer.still({ entry: COMPOSITION_ENTRY, compositionId: "Main", props, outFile, frame: 15 });
  }
}
