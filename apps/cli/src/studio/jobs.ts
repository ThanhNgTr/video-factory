// One job at a time (rendering takes the whole CPU). Each job runs the `vf` CLI in a child process, so a crash in a
// job never takes the studio down; its log goes to runs/<runId>.log and is read for the stage and render progress.
import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { JobState } from "./model.ts";

export type Job = {
  runId: string;
  args: string[];
  state: JobState;
  stage?: string;
  progress?: number; // render %, from the log
  renderStartedAt?: number;
  error?: string;
};

export class JobQueue {
  private readonly jobs: Job[] = [];
  private readonly main: string;
  private readonly cwd: string;
  private readonly logDir: string;
  constructor(main: string, cwd: string, logDir: string) {
    this.main = main;
    this.cwd = cwd;
    this.logDir = logDir;
  }

  // the newest job for a run, so a page always shows what is happening (or last happened) to it
  get(runId: string): Job | undefined {
    return this.jobs.findLast((j) => j.runId === runId);
  }

  get busy(): boolean {
    return this.jobs.some((j) => j.state === "running" || j.state === "queued");
  }

  add(runId: string, args: string[]): Job {
    const live = this.jobs.find((j) => j.runId === runId && (j.state === "queued" || j.state === "running"));
    if (live) return live;
    const job: Job = { runId, args, state: "queued" };
    this.jobs.push(job);
    this.next();
    return job;
  }

  private next(): void {
    if (this.jobs.some((j) => j.state === "running")) return;
    const job = this.jobs.find((j) => j.state === "queued");
    if (job) this.start(job);
  }

  private start(job: Job): void {
    job.state = "running";
    mkdirSync(this.logDir, { recursive: true });
    const log = createWriteStream(join(this.logDir, `${job.runId}.log`), { flags: "a" });
    const child = spawn(process.execPath, [this.main, ...job.args], {
      cwd: this.cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let tail = "";
    const read = (chunk: Buffer) => {
      log.write(chunk);
      const text = tail + chunk.toString("utf8");
      const lines = text.split("\n");
      tail = lines.pop() ?? "";
      for (const line of lines) this.track(job, line);
    };
    child.stdout.on("data", read);
    child.stderr.on("data", read);
    child.on("error", (e) => {
      job.state = "failed";
      job.error = e.message;
      log.end();
      this.next();
    });
    child.on("close", (code) => {
      job.state = code === 0 ? "done" : "failed";
      if (code !== 0 && !job.error) job.error = tail.trim() || `exit ${code}`;
      log.end();
      this.next();
    });
  }

  // pino lines: {"stage":"video.render","msg":"start"} and {"stage":"video.render","progress":42,"msg":"rendering"}
  private track(job: Job, line: string): void {
    if (!line.startsWith("{")) {
      if (/^\w+(-\w+)*: /.test(line)) job.error = line; // a StageError printed by the CLI: "code: message"
      return;
    }
    try {
      const e = JSON.parse(line) as { stage?: string; msg?: string; progress?: number };
      if (e.stage && e.msg === "start") {
        job.stage = e.stage;
        if (e.stage === "video.render") job.renderStartedAt = Date.now();
      }
      if (typeof e.progress === "number") job.progress = e.progress;
    } catch {
      // a log line that is not JSON (a stack trace) carries nothing to track; it is in the log file
    }
  }
}

// Seconds left for a render, from how long the done part took. Undefined until there is something to go on.
export function etaSeconds(job: Job | undefined, now: number): number | undefined {
  if (job?.renderStartedAt === undefined || job.progress === undefined || job.progress < 5) return undefined;
  const elapsed = (now - job.renderStartedAt) / 1000;
  return Math.round((elapsed * (100 - job.progress)) / job.progress);
}
