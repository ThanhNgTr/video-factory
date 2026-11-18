// Dev tool: render stills of a run with the current composition code, without re-running the pipeline.
// usage: node tools/stills.ts <runDir> <outDir> <shotId> <frameOffset>... (offsets are frames into the shot)
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RemotionRenderer } from "../modules/video/src/adapters/remotion-renderer.ts";
import { COMPOSITION_ENTRY } from "../modules/video/src/stages/render.stage.ts";
import { Scene } from "../packages/contracts/src/index.ts";

const [run, outDir, shot, ...offsets] = process.argv.slice(2);
if (!run || !outDir || !shot || !offsets.length)
  throw new Error("usage: stills.ts <runDir> <outDir> <shotId> <frame>...");
const read = (f: string) => JSON.parse(readFileSync(join(run, f), "utf8"));
const props = {
  timeline: read("timeline.json"),
  scene: Scene.parse(read("scene.json")), // fills zod defaults a hand-made scene leaves out
  assets: read("assets.json"),
  seed: "stills",
  choice: read("script.json").choice,
};
const sh = props.timeline.shots.find((s: { id: string }) => s.id === shot);
if (!sh) throw new Error(`no shot ${shot}`);
const r = new RemotionRenderer();
for (const o of offsets) {
  const out = join(outDir, `${shot}-${o.padStart(3, "0")}.png`);
  await r.still({ entry: COMPOSITION_ENTRY, compositionId: "Main", props, outFile: out, frame: sh.from + Number(o) });
  console.log(out);
}
