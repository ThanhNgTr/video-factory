import { type Library, type Scene, Scene as SceneSchema } from "@vf/contracts";
import { loadLibrary } from "../../core/src/library.ts";

export const lib: Library = loadLibrary(new URL("../../../library", import.meta.url).pathname);

export const scene: Scene = SceneSchema.parse({
  schemaVersion: 1,
  title: "Fixture",
  mood: "horror",
  hud: { title: "NIGHT 1", counterLabel: "GUESTS" },
  shots: [
    {
      id: "s01",
      beat: "b1",
      set: "hotel-lobby",
      camera: "wide",
      cast: [{ id: "night-clerk", spot: "behind-desk", action: "idle" }],
      line: { who: "narrator", text: "This hotel has *no floor 13*." },
      text: "PART 1",
      clock: "11:58 PM",
      counter: 0,
      dur: 3,
    },
    {
      id: "s02",
      beat: "b2",
      set: "hotel-lobby",
      camera: "closeup",
      focus: "old-manager",
      cast: [
        { id: "night-clerk", spot: "behind-desk", action: "nod" },
        { id: "old-manager", spot: "at-desk", action: "talk" },
      ],
      line: { who: "old-manager", text: "Three rules. *Read them twice*." },
      dur: 2.5,
      sfx: [{ id: "thud", at: 0.2 }],
    },
    { id: "s03", beat: "b3", set: "hotel-hallway", camera: "push", cast: [], dur: 2, lighting: "flicker" },
  ],
});
