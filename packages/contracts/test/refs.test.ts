import { describe, expect, it } from "vitest";
import { type Camera, Diorama, type Scene, type Script, StageProp } from "../src/index.ts";
import { checkSceneRefs as checkScene, checkSceneMatchesScript } from "../src/refs.ts";
import { lib, scene } from "./fixtures.ts";

describe("checkScene", () => {
  it("accepts a valid scene", () => expect(checkScene(scene, lib)).toEqual([]));
  it("reports unknown ids, bad spots and shared spots", () => {
    const bad = structuredClone(scene);
    const s0 = bad.shots[0];
    if (!s0) throw new Error("fixture");
    s0.cast.push({ id: "ghost", spot: "center-left", action: "idle" });
    s0.cast.push({ id: "night-clerk", spot: "center-left", toSpot: "nowhere", action: "fly" });
    const errs = checkScene(bad, lib);
    expect(errs.join("\n")).toMatch(/unknown character "ghost"/);
    expect(errs.join("\n")).toMatch(/no spot "nowhere"/);
    expect(errs.join("\n")).toMatch(/unknown action "fly"/);
    expect(errs.join("\n")).toMatch(/same spot "center-left"/);
  });
  it("seats a sitter only on a seat spot, and never lets anyone walk sitting", () => {
    const at = (spot: string, action: string, toSpot?: string) => {
      const s = structuredClone(scene);
      const s0 = s.shots[0];
      if (!s0) throw new Error("fixture");
      s0.set = "roadside-diner";
      s0.cast = [{ id: "pajama-kid", spot, action, ...(toSpot ? { toSpot } : {}) }];
      return checkScene(s, lib).join("\n");
    };
    expect(at("booth-seat", "sit")).toBe("");
    expect(at("center-left", "sit")).toMatch(
      /sits \("sit"\) on "center-left", which has no seat \(seats in "roadside-diner": booth-seat, on-stool\)/,
    );
    expect(at("booth-seat", "sit-talk", "center-left")).toMatch(/walks while sitting/);
    expect(at("center-left", "lie")).toBe(""); // lying on the floor is fine
  });
  it("checks story props: a known icon, a real spot, one id each; focus may be a prop", () => {
    const at = (props: unknown[], focus?: string, camera: Camera = "wide") => {
      const s = structuredClone(scene);
      const s0 = s.shots[0];
      if (!s0) throw new Error("fixture");
      s0.props = StageProp.array().parse(props);
      s0.camera = camera;
      if (focus) s0.focus = focus;
      return checkScene(s, lib).join("\n");
    };
    const box = { id: "box", icon: "paper-sheet", spot: "center-left" };
    expect(at([box])).toBe("");
    expect(at([box], "box", "closeup")).toBe("");
    expect(at([box], "box", "insert")).toBe(""); // an insert on a prop needs nobody to hold it
    expect(at([{ ...box, icon: "unicorn" }])).toMatch(/icon "unicorn", which is neither in the library nor declared/);
    expect(at([{ ...box, spot: "roof" }])).toMatch(/no spot "roof" for prop "box"/);
    expect(at([box, box])).toMatch(/prop id "box" is already used/);
    expect(at([], "box", "closeup")).toMatch(/focus "box" is neither in the cast nor a prop/);
  });
  it("checks a diorama shot: no set needed, layers it reveals must exist, a sign needs its piece", () => {
    const at = (diorama: unknown, cast = false) => {
      const s = structuredClone(scene);
      const s0 = s.shots[0];
      if (!s0) throw new Error("fixture");
      delete s0.set;
      s0.diorama = Diorama.parse(diorama);
      if (!cast) s0.cast = [];
      delete s0.line;
      return checkScene(s, lib).join("\n");
    };
    expect(at({ layers: [{ material: "stones", thick: 0.5 }], reveal: 1 })).toBe("");
    expect(at({ layers: [], reveal: 1 })).toMatch(/reveal 1 is more than the 0 layers/);
    expect(at({ sign: "Our Rd" })).toMatch(/a sign text needs the "sign" piece/);
    expect(at({}, true)).toMatch(/a diorama shot has no cast/);
  });
  it("rejects a walk through furniture and lists clear walks", () => {
    const bad = structuredClone(scene);
    const s0 = bad.shots[0];
    if (!s0) throw new Error("fixture");
    s0.set = "roadside-diner";
    s0.cast = [{ id: "pajama-kid", spot: "entrance", toSpot: "at-counter", action: "walk" }];
    const errs = checkScene(bad, lib).join("\n");
    expect(errs).toMatch(/would walk through a (counter|cylinder) from "entrance" to "at-counter"/);
    expect(errs).toMatch(/clear walks from "entrance": .*center-right/);
  });
});

describe("checkSceneMatchesScript", () => {
  const beat = (id: string, cast: string[]) => ({ id, role: "build", action: "a", cast, lines: [], tension: "calm" });
  const script = { beats: [beat("b1", ["trucker", "pajama-kid"])] } as unknown as Script;
  const shot = (camera: string, cast: string[]) =>
    ({
      id: "s1",
      beat: "b1",
      set: "roadside-diner",
      camera,
      cast: cast.map((id) => ({ id, spot: id, action: "idle" })),
    }) as const;
  const scene = (camera: string, cast: string[]) => ({ shots: [shot(camera, cast)] }) as unknown as Scene;
  it("makes a room shot show everyone the beat puts in the room", () => {
    expect(checkSceneMatchesScript(scene("wide", ["pajama-kid"]), script).join()).toMatch(/leaves out trucker/);
    expect(checkSceneMatchesScript(scene("wide", ["pajama-kid", "trucker"]), script)).toEqual([]);
  });
  it("caps the shot count at lines plus silent beats plus two cutaways, plus one per three lines", () => {
    const many = {
      shots: Array.from({ length: 4 }, (_, i) => ({ ...shot("wide", ["trucker", "pajama-kid"]), id: `s${i}` })),
    } as unknown as Scene;
    expect(checkSceneMatchesScript(many, script).join()).toMatch(/4 shots for 1 lines and silent beats: at most 3/);
    const line = { who: "narrator", text: "x" };
    const talky = {
      beats: [{ ...beat("b1", ["trucker", "pajama-kid"]), lines: [line, line, line, line, line, line] }],
    } as unknown as Script;
    const ten = {
      shots: Array.from({ length: 10 }, (_, i) => ({ ...shot("wide", ["trucker", "pajama-kid"]), id: `s${i}` })),
    } as unknown as Scene;
    expect(checkSceneMatchesScript(ten, talky).join()).not.toMatch(/at most/);
    const eleven = { shots: [...ten.shots, { ...shot("wide", ["trucker", "pajama-kid"]), id: "s10" }] } as Scene;
    expect(checkSceneMatchesScript(eleven, talky).join()).toMatch(/11 shots for 6 lines and silent beats: at most 10/);
  });
  it("lets a close shot frame only the speaker", () => {
    expect(checkSceneMatchesScript(scene("closeup", ["pajama-kid"]), script)).toEqual([]);
  });
});

describe("checkScriptRefs", () => {
  it("asks for more lines when a script cannot reach the format's minimum length", async () => {
    const { checkScriptRefs } = await import("../src/refs.ts");
    const { readFileSync } = await import("node:fs");
    const { Script: ScriptSchema } = await import("../src/script.ts");
    const script: Script = ScriptSchema.parse(
      JSON.parse(readFileSync(new URL("../../../evals/fixtures/script.json", import.meta.url).pathname, "utf8")),
    );
    expect(checkScriptRefs(script, lib).join("\n")).not.toMatch(/at least/);
    const terse = {
      ...script,
      beats: script.beats.map((b) => ({ ...b, lines: b.lines.slice(0, 1).map((l) => ({ ...l, text: "Hi." })) })),
    };
    expect(checkScriptRefs(terse, lib).join("\n")).toMatch(/at least \d+ for the format's \d+-second minimum/);
  });
  it("keeps the HUD to formats that have one", async () => {
    const { checkScriptRefs } = await import("../src/refs.ts");
    const { readFileSync } = await import("node:fs");
    const { Script: ScriptSchema } = await import("../src/script.ts");
    const skit: Script = ScriptSchema.parse(
      JSON.parse(readFileSync(new URL("../../../evals/fixtures/script.json", import.meta.url).pathname, "utf8")),
    );
    const noHud = /this format has no HUD/;
    expect(checkScriptRefs(skit, lib).join("\n")).not.toMatch(noHud);
    expect(checkScriptRefs({ ...skit, hud: { title: "NIGHT 1" } }, lib).join("\n")).toMatch(noHud);
    const clocked = { ...skit, beats: skit.beats.map((b, i) => (i ? b : { ...b, clock: "3:05 AM" })) };
    expect(checkScriptRefs(clocked, lib).join("\n")).toMatch(noHud);
    // the series format keeps its game-like HUD
    expect(checkScriptRefs({ ...skit, format: "series", hud: { title: "NIGHT 1" } }, lib).join("\n")).not.toMatch(
      noHud,
    );
  });
});
