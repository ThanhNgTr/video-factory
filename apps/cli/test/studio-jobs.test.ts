import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { etaSeconds, type Job, JobQueue } from "../src/studio/jobs.ts";

const fake = new URL("./fixtures/fake-vf.mjs", import.meta.url).pathname;
const settled = (job: Job) =>
  new Promise<void>((resolve) => {
    const t = setInterval(() => {
      if (job.state === "done" || job.state === "failed") {
        clearInterval(t);
        resolve();
      }
    }, 20);
  });

describe("JobQueue", () => {
  it("runs jobs one at a time, reads stage and render progress from the log, keeps the log", async () => {
    const dir = mkdtempSync(join(tmpdir(), "vf-jobs-"));
    const q = new JobQueue(fake, dir, dir);
    const a = q.add("ep-a", ["make"]);
    const b = q.add("ep-b", ["make"]);
    expect(a.state).toBe("running");
    expect(b.state).toBe("queued");
    expect(q.add("ep-a", ["make"])).toBe(a); // a live job is not started twice
    await settled(a);
    expect(a).toMatchObject({ state: "done", stage: "video.render", progress: 42 });
    await settled(b);
    expect(b.state).toBe("done");
    expect(readFileSync(join(dir, "ep-a.log"), "utf8")).toContain('"progress":42');
  });
  it("marks a failed job and keeps the CLI's error line", async () => {
    const dir = mkdtempSync(join(tmpdir(), "vf-jobs-"));
    const job = new JobQueue(fake, dir, dir).add("ep-c", ["make", "--fail"]);
    await settled(job);
    expect(job.state).toBe("failed");
    expect(job.error).toBe("provider-failed: render crashed");
  });
  it("estimates the render time left from the part already done", () => {
    const job: Job = { runId: "x", args: [], state: "running", progress: 25, renderStartedAt: 0 };
    expect(etaSeconds(job, 60_000)).toBe(180);
    expect(etaSeconds({ ...job, progress: 2 }, 60_000)).toBeUndefined();
  });
});
