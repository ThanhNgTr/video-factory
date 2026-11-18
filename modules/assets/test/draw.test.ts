import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DrawnIcons, type Library } from "@vf/contracts";
import { ArtifactStore, createLogger, FakeLlm, type LlmRequest, loadConfig } from "@vf/core";
import type { StageContext } from "@vf/pipeline";
import { describe, expect, it } from "vitest";
import { FakeSnapshot } from "../src/adapters/fake-snapshot.ts";
import { FakeRasterizer } from "../src/adapters/ffmpeg-rasterizer.ts";
import type { AssetsDeps } from "../src/ports.ts";
import { assetsDraw, MAX_DRAWS } from "../src/stages/draw.stage.ts";

const root = new URL("../../..", import.meta.url).pathname;
const svg = (n: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><circle cx="256" cy="256" r="${100 + n}" fill="#ccc"/><circle cx="200" cy="200" r="20" fill="#999"/><circle cx="300" cy="300" r="30" fill="#999"/></svg>`;
const paper = { schemaVersion: 1 as const, id: "paper-sheet", brief: "a sheet of paper", svg: svg(0), score: 9 };

function context(llm: FakeLlm): StageContext<AssetsDeps> {
  const store = new ArtifactStore(mkdtempSync(join(tmpdir(), "vf-draw-")));
  store.writeJson("scene.json", {
    schemaVersion: 1,
    title: "t",
    mood: "night",
    shots: ["a", "b", "c"].map((id) => ({
      id,
      beat: "b",
      camera: "wide",
      cast: [],
      graphic: { kind: "icons", items: [{ icon: "the-moon" }] },
      dur: 2,
    })),
    icons: [
      { id: "the-moon", brief: "the full Moon, pale grey with craters" },
      { id: "paper-sheet", brief: "a sheet of paper" },
      { id: "blob", brief: "something nobody can draw" },
    ],
  });
  return {
    runId: "t",
    seed: "t",
    store,
    config: loadConfig(root),
    library: { icons: { "paper-sheet": paper } } as unknown as Library,
    log: createLogger("silent"),
    deps: { llm, rasterizer: new FakeRasterizer(), snapshot: new FakeSnapshot() },
    params: {},
    recordUsage: () => undefined,
  };
}

const subject = (r: LlmRequest) =>
  /Icon id: ([\w-]+)/.exec(r.user)?.[1] ?? /Intended subject: ([\w-]+)/.exec(r.user)?.[1];

describe("assets.draw", () => {
  it("redraws from the gate's defects until an icon passes, skips library icons, leaves out what never passes", async () => {
    let moonGates = 0;
    const llm = new FakeLlm({
      icon: (r: LlmRequest) => ({ svg: svg(r.user.includes("previous_svg") ? 2 : 1) }),
      "icon-guess": { guess: "a grey circle", confidence: 6 },
      "icon-gate": (r: LlmRequest) =>
        subject(r) === "the-moon"
          ? ++moonGates === 1
            ? { recognizable: 5, defects: ["no craters"] }
            : { recognizable: 8, defects: [] }
          : { recognizable: 2, defects: ["unreadable"] },
    });
    const ctx = context(llm);
    await assetsDraw.run(ctx);
    const out = ctx.store.readJson("icons.json", DrawnIcons);
    expect(Object.keys(out.icons)).toEqual(["the-moon"]);
    expect(out.icons["the-moon"]?.score).toBe(8);
    expect(out.failed).toEqual([
      { id: "blob", brief: "something nobody can draw", score: 2, problems: ["unreadable"] },
    ]);
    const draws = llm.calls.filter((c) => c.schemaName === "icon");
    expect(draws.filter((c) => subject(c) === "the-moon")).toHaveLength(2);
    expect(draws.find((c) => subject(c) === "the-moon" && c.user.includes("no craters"))).toBeDefined();
    expect(draws.filter((c) => subject(c) === "blob")).toHaveLength(MAX_DRAWS);
    expect(draws.some((c) => subject(c) === "paper-sheet")).toBe(false);
    // the gate is told what the blind viewer saw
    expect(llm.calls.find((c) => c.schemaName === "icon-gate")?.user).toContain('said: "a grey circle"');
  });
  it("sends an unsafe drawing back to the drawer before anyone looks at it", async () => {
    const answers = ['<svg viewBox="0 0 512 512"><script>x()</script></svg>', svg(1)];
    const llm = new FakeLlm({
      icon: () => ({ svg: answers.shift() ?? svg(1) }),
      "icon-guess": { guess: "the moon", confidence: 9 },
      "icon-gate": { recognizable: 9, defects: [] },
    });
    const ctx = context(llm);
    await assetsDraw.run(ctx);
    // icons are drawn in parallel: whichever got the unsafe answer was asked again with the reason
    const repaired = llm.calls.filter((c) => c.schemaName === "icon" && /not allowed: tag <script>/.test(c.user));
    expect(repaired).toHaveLength(1);
  });
});
