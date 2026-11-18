// How long a staged scene will run, estimated before any voice exists, so the director can be held to the format's
// length (a video of 25 two-word lines staged at 3-4 s each ran 88 s for an 80 s format). Pure.
import type { Format, Scene } from "@vf/contracts";

// edge-tts measured on 728 spoken characters: 50.6 s. shortcut: one rate for every voice and rate setting; take it from
// audio.json of past runs if voices drift
export const CHARS_PER_SECOND = 14;
export const LINE_PAD = 0.55; // seconds of silence video.timeline puts round a line (lead 6 + tail 10 frames at 30 fps)

export const sceneSeconds = (scene: Pick<Scene, "shots">): number =>
  scene.shots.reduce(
    (t, s) => t + Math.max(s.dur, s.line ? s.line.text.replaceAll("*", "").length / CHARS_PER_SECOND + LINE_PAD : 0),
    0,
  );

export function checkSceneLength(scene: Pick<Scene, "shots">, format: Pick<Format, "lengthS">): string[] {
  const seconds = sceneSeconds(scene);
  if (seconds <= format.lengthS.max) return [];
  return [
    `the shots run about ${seconds.toFixed(0)} s, the format allows at most ${format.lengthS.max} s: set each spoken shot's dur to its line (0.6 s plus 1 s per 14 characters) and drop or shorten the silent shots that matter least`,
  ];
}
