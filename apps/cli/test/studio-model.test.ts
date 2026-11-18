import type { Script } from "@vf/contracts";
import { describe, expect, it } from "vitest";
import { applyScriptForm, explain, fieldOf, phaseOf, spokenChars, stepsOf } from "../src/studio/model.ts";

const script = {
  schemaVersion: 1,
  format: "series",
  title: "The Diner",
  summary: "s",
  mood: "horror",
  cast: ["night-cook"],
  beats: [
    {
      id: "b1",
      role: "hook",
      action: "A",
      cast: [],
      lines: [{ who: "narrator", text: "Your *first* shift." }],
      tension: "calm",
      text: "PART 1",
    },
    { id: "b2", role: "build", action: "B", cast: [], lines: [], tension: "uneasy" },
  ],
  choice: { option1: "Sign", option2: "Open" },
  publish: { title: "t", description: "d", hashtags: [] },
} as unknown as Script;

describe("studio model", () => {
  it("reads a live job before the database, and a run left running as stopped", () => {
    expect(phaseOf("running", "running", false)).toBe("running");
    expect(phaseOf("paused", undefined, false)).toBe("review");
    expect(phaseOf("done", undefined, true)).toBe("done");
    expect(phaseOf("running", undefined, false)).toBe("stopped");
  });
  it("marks steps done up to the pause and the render as still to do", () => {
    const rows = [
      "script.write",
      "script.direct",
      "script.bible",
      "assets.check",
      "audio.tts",
      "video.timeline",
      "audio.mix",
    ].map((stage) => ({ stage, status: "done", ms: 10 }));
    const steps = stepsOf(rows, "review");
    expect(steps.map((s) => s.state)).toEqual(["done", "done", "done", "done", "todo", "todo"]);
    expect(stepsOf(rows, "running", "video.render")[4]?.state).toBe("active");
  });
  it("writes form values over the script, dropping an emptied text card", () => {
    const form = new URLSearchParams({
      title: "New title",
      "b0.l0": "Your *last* shift.",
      "b0.text": "",
      choice2: "Run",
    });
    const s = applyScriptForm(script, form);
    expect(s.title).toBe("New title");
    expect(s.beats[0]?.lines[0]?.text).toBe("Your *last* shift.");
    expect(s.beats[0]?.text).toBeUndefined();
    expect(s.choice).toEqual({ option1: "Sign", option2: "Run" });
    expect(s.beats[1]?.action).toBe("B");
  });
  it("maps validation paths to fields and says what to fix", () => {
    expect(fieldOf(["beats", 0, "lines", 1, "text"])).toBe("b0.l1");
    expect(fieldOf(["choice", "option2"])).toBe("choice2");
    expect(fieldOf(["publish", "title"])).toBeUndefined();
    expect(explain("total spoken text is 1100 characters, max 1000: cut lines")).toMatch(/1100 ký tự, tối đa 1000/);
  });
  it("counts spoken characters without the highlight marks", () => expect(spokenChars(script)).toBe(17));
});
