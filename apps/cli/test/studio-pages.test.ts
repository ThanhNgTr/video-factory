import { describe, expect, it } from "vitest";
import { explainError, phaseOf } from "../src/studio/model.ts";
import { fmtDuration, learnPage, newPage } from "../src/studio/pages.ts";

describe("studio pages", () => {
  it("never offers a series with a part in progress as a choice, and preselects one that is free", () => {
    const html = newPage([
      { id: "busy", title: "Busy", parts: 1, pending: "busy-p2", choice: { option1: "a", option2: "b" } },
      { id: "free", title: "Free", parts: 0 },
    ]);
    expect(html).toContain('href="/runs/busy-p2"');
    expect(html).not.toContain('value="busy"');
    expect(html).toMatch(/value="free" checked/);
    expect(html).not.toContain('name="choice-busy"'); // its vote belongs to the part in progress
  });
  it("leaves the audience vote unanswered until the producer picks it", () => {
    const html = newPage([{ id: "s", title: "S", parts: 1, choice: { option1: "a", option2: "b" } }]);
    expect(html).toContain('name="choice-s"');
    expect(html).not.toMatch(/name="choice-s" value="\d" checked/);
  });
  it("says a finished learn job is learned, not waiting for a script review", () => {
    expect(phaseOf("done", undefined, false, true)).toBe("done");
    const html = learnPage(
      [],
      [{ id: "ingest-1", phase: "done", created: "", url: "https://www.instagram.com/reel/X/" }],
    );
    expect(html).toContain("Đã học xong");
    expect(html).not.toContain("duyệt kịch bản");
    expect(html).toContain("instagram.com/reel/X");
  });
  it("offers a similar video from a link, and another one from a sample learned with its format", () => {
    const sample = { id: "fold-facts", summary: "s", lengthS: 50, source: "https://youtube.com/shorts/x" };
    const html = learnPage(
      [
        { ...sample, format: "explainer" },
        { ...sample, id: "old-formula" },
      ],
      [],
    );
    expect(html).toContain('name="mode" value="like"');
    expect(html).toContain('action="/learn/make"');
    expect(html).toContain('value="fold-facts"');
    expect(html).toContain("/new?formula=old-formula"); // a formula without a format still starts a series episode
  });
  it("offers a one-off video from a topic next to the series form", () => {
    const html = newPage([], {
      formats: [
        { id: "explainer", title: "Giải thích kiến thức", meta: "m" },
        { id: "fold-facts", title: "Theo mẫu: fold facts", meta: "m" },
      ],
    });
    expect(html).toContain('action="/new/single"');
    expect(html).toMatch(/name="format" value="explainer" checked/);
    expect(html).toContain('name="singleIdea"');
    expect(newPage([])).not.toContain("/new/single"); // nothing to offer, no form
  });
  it("explains pipeline errors in plain words and keeps the raw text", () => {
    const e = explainError("provider-failed: claude cli failed: spawn claude ENOENT");
    expect(e.text).toMatch(/Không gọi được/);
    expect(e.raw).toContain("ENOENT");
    expect(explainError("something odd").text).toMatch(/Bấm Thử lại/);
  });
  it("formats lengths the way the player does", () => {
    expect(fmtDuration(119.6)).toBe("1:59");
    expect(fmtDuration(125.533)).toBe("2:05");
  });
});
