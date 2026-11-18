// Studio: a local web front for the factory (ADR 0014). It reads run state and artifacts, writes only the two things a
// human may change (a new idea, script.json) and hands everything else to the `vf` CLI through the job queue.
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { join } from "node:path";
import { checkScriptRefs, FrameReview, Script, ScriptReview } from "@vf/contracts";
import { ArtifactStore, loadLibrary } from "@vf/core";
import { nextPart } from "@vf/script";
import type { wire } from "../wiring.ts";
import { etaSeconds, JobQueue } from "./jobs.ts";
import {
  applyScriptForm,
  explain,
  explainError,
  fieldOf,
  type JobState,
  phaseOf,
  spokenChars,
  stepsOf,
} from "./model.ts";
import {
  type EpisodeView,
  editorPage,
  episodesPage,
  type FormatOption,
  type LearnJob,
  learnPage,
  messagePage,
  newPage,
  type RunView,
  runPage,
  runPanel,
  type SeriesOption,
} from "./pages.ts";

type Wired = ReturnType<typeof wire>;
const RUN_ID = /^[a-z0-9][a-z0-9-]{0,80}$/;
const STATIC: Record<string, string> = { "studio.css": "text/css", "studio.js": "text/javascript" };
const staticDir = new URL("./static/", import.meta.url).pathname;

// Resolves when the server closes: the caller keeps its database open until then.
export function startStudio(w: Wired, root: string, port: number): Promise<void> {
  const runsDir = w.config.runsDir;
  const jobs = new JobQueue(join(root, "apps/cli/src/main.ts"), root, runsDir);
  const lib = () => loadLibrary(w.config.libraryDir); // re-read: a finished episode updates its series bible
  const readJson = (id: string, name: string): unknown => {
    const p = join(runsDir, id, name);
    try {
      return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : undefined;
    } catch {
      return undefined; // an artifact being written right now; the next poll reads it
    }
  };

  const liveJob = (id: string): JobState | undefined => {
    const s = jobs.get(id)?.state;
    return s === "queued" || s === "running" ? s : undefined;
  };

  function runView(id: string): RunView | undefined {
    const run = w.state.getRun(id);
    const job = jobs.get(id);
    if (!run && !job) return undefined;
    const library = lib();
    const script = Script.safeParse(readJson(id, "script.json"));
    const s = script.success ? script.data : undefined;
    const dir = join(runsDir, id);
    const ingest = !!run?.params.url || job?.args[0] === "ingest";
    const phase = phaseOf(run?.status, liveJob(id), existsSync(join(dir, "video.mp4")), ingest);
    const rows = w.state.listStages(id);
    const qa = readJson(id, "qa.json") as { pass?: boolean; seconds?: number } | undefined;
    const series = run?.params.series ?? job?.args[job.args.indexOf("--series") + 1];
    return {
      id,
      title: s?.title ?? id,
      series: series ? (library.series[series]?.title ?? series) : undefined,
      part: s?.part,
      phase,
      steps: stepsOf(rows, phase, job?.state === "running" ? job.stage : undefined),
      progress: job?.state === "running" && job.stage === "video.render" ? (job.progress ?? 0) : undefined,
      eta: etaSeconds(job, Date.now()),
      error: (() => {
        const raw = (job?.state === "failed" ? job.error : undefined) ?? rows.find((r) => r.status === "failed")?.error;
        return raw ? explainError(raw) : undefined;
      })(),
      hasVideo: phase === "done" && existsSync(join(dir, "video.mp4")),
      hasThumb: phase === "done" && existsSync(join(dir, "thumb.jpg")),
      qa: qa && typeof qa.seconds === "number" ? { pass: !!qa.pass, seconds: qa.seconds } : undefined,
      cost: run ? w.state.runCost(id) : 0,
      created: w.state.listRuns().find((r) => r.id === id)?.created_at ?? "",
      chars: s ? spokenChars(s) : undefined,
      budget: s ? library.formats[s.format]?.maxSpokenChars : undefined,
      hook: s?.beats.flatMap((b) => b.lines)[0]?.text,
      review: ScriptReview.safeParse(readJson(id, "script-review.json")).data,
      frames: phase === "done" ? FrameReview.safeParse(readJson(id, "frame-review.json")).data : undefined,
      canRevise: !!s && !ingest && phase !== "running" && phase !== "queued",
    };
  }

  function episodes(): EpisodeView[] {
    const listed = w.state.listRuns().filter((r) => !w.state.getRun(r.id)?.params.url);
    const views = listed.map((r): EpisodeView => {
      const v = runView(r.id);
      return {
        id: r.id,
        title: v?.title ?? r.id,
        series: v?.series,
        part: v?.part,
        phase: v?.phase ?? "queued",
        hasThumb: !!v?.hasThumb,
        seconds: v?.qa?.seconds,
        created: r.created_at,
        hook: v?.hook,
      };
    });
    // a job waiting in the queue has no database row yet: show it first
    const listedIds = new Set(listed.map((r) => r.id));
    for (const id of jobIds)
      if (!listedIds.has(id) && !id.startsWith("ingest-") && liveJob(id)) {
        const v = runView(id);
        views.unshift({ id, title: v?.title ?? id, series: v?.series, phase: "queued", hasThumb: false, created: "" });
      }
    return views;
  }
  const jobIds: string[] = [];
  const enqueue = (id: string, args: string[]) => {
    if (!jobIds.includes(id)) jobIds.push(id);
    return jobs.add(id, args);
  };
  const busyWith = (): string | undefined => {
    const id = jobIds.find((i) => liveJob(i));
    return id ? (runView(id)?.title ?? id) : undefined;
  };

  function seriesOptions(): SeriesOption[] {
    return Object.values(lib().series).map((b) => {
      const last = b.parts.at(-1);
      const lastScript = last ? Script.safeParse(readJson(last.runId, "script.json")) : undefined;
      const next = `${b.id}-p${nextPart(b)}`;
      return {
        id: b.id,
        title: b.title,
        pending: w.state.getRun(next) || liveJob(next) ? next : undefined,
        parts: b.parts.length,
        lastTitle: last?.title,
        choice: lastScript?.success ? lastScript.data.choice : undefined,
      };
    });
  }

  // ---- routes
  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", "http://studio.local");
    const path = url.pathname;
    const send = (status: number, body: string, type = "text/html; charset=utf-8") => {
      res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
      res.end(body);
    };
    const redirect = (to: string) => {
      res.writeHead(303, { location: to });
      res.end();
    };
    if (req.method === "POST") {
      // same-origin only: another site open in the browser must not be able to start jobs here
      const origin = req.headers.origin;
      if (origin && new URL(origin).host !== req.headers.host) return send(403, "forbidden", "text/plain");
    }

    const asset = path.match(/^\/static\/([a-z.]+)$/)?.[1];
    if (req.method === "GET" && asset && STATIC[asset])
      return send(200, readFileSync(join(staticDir, asset), "utf8"), `${STATIC[asset]}; charset=utf-8`);

    if (req.method === "GET" && path === "/") return send(200, episodesPage(episodes()));

    // kinds of one-off video: built-in formats first, then those learned from samples
    const formatOptions = (): FormatOption[] =>
      Object.values(lib().formats)
        .filter((f) => f.kind !== "series")
        .sort((a, b) => Number(!!lib().formulas[a.id]) - Number(!!lib().formulas[b.id]))
        .map((f) => ({
          id: f.id,
          title:
            f.id === "explainer"
              ? "Giải thích kiến thức"
              : f.id === "skit"
                ? "Skit ngắn"
                : `Theo mẫu: ${f.id.replace(/-/g, " ")}`,
          meta:
            f.kind === "explainer"
              ? "Người dẫn kể, đồ hoạ minh hoạ con số và so sánh."
              : "Nhân vật diễn một tình huống hài hoặc hồi hộp.",
        }));
    if (path === "/new") {
      const library = lib();
      const asFormula = (f: string | null) => (f && library.formulas[f] ? f : undefined);
      if (req.method === "GET")
        return send(
          200,
          newPage(seriesOptions(), {
            busyWith: busyWith(),
            formula: asFormula(url.searchParams.get("formula")),
            formats: formatOptions(),
          }),
        );
      const form = new URLSearchParams(await body(req));
      const values = Object.fromEntries(form);
      const formula = asFormula(form.get("formula"));
      const again = (error: string) =>
        send(422, newPage(seriesOptions(), { busyWith: busyWith(), error, values, formula, formats: formatOptions() }));
      let seriesId = form.get("series") ?? "";
      if (seriesId === "__new") {
        const name = (form.get("newSeries") ?? "").trim();
        if (!name) return again("Hãy đặt tên cho series mới.");
        if (!/^[A-Za-z0-9 '\-:,.!?]+$/.test(name)) return again("Tên series chỉ dùng chữ tiếng Anh không dấu.");
        seriesId = name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        if (!seriesId) return again("Tên series cần có chữ hoặc số.");
      } else if (!library.series[seriesId]) return again("Hãy chọn một series.");
      const runId = `${seriesId}-p${nextPart(library.series[seriesId])}`;
      if (w.state.getRun(runId) || liveJob(runId)) return redirect(`/runs/${runId}`); // that part is already started
      const idea = (form.get("idea") ?? "").trim();
      const choice = form.get(`choice-${seriesId}`);
      if (seriesOptions().find((s) => s.id === seriesId)?.choice && choice !== "1" && choice !== "2")
        return again("Hãy chọn phương án khán giả đã chọn ở cuối tập trước.");
      enqueue(runId, [
        "make",
        "--run",
        runId,
        "--series",
        seriesId,
        ...(idea ? ["--idea", idea] : []),
        ...(formula ? ["--formula", formula] : []),
        ...(choice === "1" || choice === "2" ? ["--choice", choice] : []),
        ...(form.get("review") === "1" ? ["--until", "audio.mix"] : []),
      ]);
      return redirect(`/runs/${runId}`);
    }

    if (path === "/new/single" && req.method === "POST") {
      // a one-off video from a topic: a built-in format or one learned from a sample (its formula shares the id)
      const library = lib();
      const form = new URLSearchParams(await body(req));
      const values = Object.fromEntries(form);
      const format = form.get("format") ?? "";
      const idea = (form.get("singleIdea") ?? "").trim();
      const again = (error: string) =>
        send(422, newPage(seriesOptions(), { busyWith: busyWith(), error, values, formats: formatOptions() }));
      if (!library.formats[format] || library.formats[format]?.kind === "series")
        return again("Hãy chọn một thể loại.");
      if (!idea) return again("Hãy ghi chủ đề hoặc ý tưởng cho video lẻ.");
      const runId = `${format}-${new Date()
        .toISOString()
        .replace(/[^0-9]/g, "")
        .slice(0, 14)}`;
      enqueue(runId, [
        "make",
        "--run",
        runId,
        "--format",
        format,
        ...(library.formulas[format] ? ["--formula", format] : []),
        "--idea",
        idea,
      ]);
      return redirect(`/runs/${runId}`);
    }

    if (path === "/learn") {
      const ingestJobs = (): LearnJob[] => {
        const formulas = lib().formulas;
        const listed = w.state.listRuns().filter((r) => w.state.getRun(r.id)?.params.url);
        const rows: LearnJob[] = listed.map((r) => {
          const learned = (readJson(r.id, "formula.json") as { id?: string } | undefined)?.id;
          return {
            id: r.id,
            phase: runView(r.id)?.phase ?? "queued",
            created: r.created_at,
            url: w.state.getRun(r.id)?.params.url ?? "",
            formula: learned && formulas[learned] ? learned : undefined,
          };
        });
        // a learn job still in the queue has no database row yet
        for (const id of jobIds)
          if (id.startsWith("ingest-") && liveJob(id) && !listed.some((r) => r.id === id)) {
            const args = jobs.get(id)?.args ?? [];
            rows.unshift({ id, phase: "queued", created: "", url: args[args.indexOf("--url") + 1] ?? "" });
          }
        return rows;
      };
      const formulas = () =>
        Object.values(lib().formulas).map((f) => ({
          id: f.id,
          summary: f.summary,
          lengthS: f.lengthS,
          source: f.source,
          format: lib().formats[f.id]?.kind,
        }));
      if (req.method === "GET") return send(200, learnPage(formulas(), ingestJobs()));
      const form = new URLSearchParams(await body(req));
      const link = (form.get("url") ?? "").trim();
      const idea = (form.get("idea") ?? "").trim().slice(0, 500);
      let ok = false;
      try {
        ok = ["http:", "https:"].includes(new URL(link).protocol);
      } catch {
        ok = false;
      }
      if (!ok)
        return send(
          422,
          learnPage(formulas(), ingestJobs(), {
            error: "Link chưa đúng. Dán cả địa chỉ bắt đầu bằng https://",
            url: link,
            idea,
          }),
        );
      const stamp = new Date()
        .toISOString()
        .replace(/[^0-9]/g, "")
        .slice(0, 14);
      if (form.get("mode") === "like") {
        // learn the sample, then make a video like it in the same job (vf like); its page follows both
        const runId = `like-${stamp}`;
        enqueue(runId, ["like", link, "--run", runId, ...(idea ? ["--idea", idea] : [])]);
        return redirect(`/runs/${runId}`);
      }
      const runId = `ingest-${stamp}`;
      enqueue(runId, ["ingest", "--url", link, "--run", runId]);
      return redirect("/learn");
    }

    if (path === "/learn/make" && req.method === "POST") {
      // another video from a sample learned earlier: its formula and its format share an id
      const id = new URLSearchParams(await body(req)).get("formula") ?? "";
      if (!lib().formulas[id] || !lib().formats[id])
        return send(404, messagePage("Không tìm thấy", "Mẫu này không có."));
      const runId = `${id}-${new Date()
        .toISOString()
        .replace(/[^0-9]/g, "")
        .slice(0, 14)}`;
      enqueue(runId, ["make", "--run", runId, "--format", id, "--formula", id]);
      return redirect(`/runs/${runId}`);
    }

    const m = path.match(/^\/runs\/([^/]+)(?:\/(script|status\.json|resume|revise|video\.mp4|thumb\.jpg))?$/);
    const id = m?.[1];
    if (!m || !id || !RUN_ID.test(id)) return send(404, messagePage("Không tìm thấy", "Trang này không có."));
    const sub = m[2];
    const view = runView(id);
    if (!view) return send(404, messagePage("Không tìm thấy", `Không có tập nào tên ${id}.`));

    if (req.method === "GET" && !sub) return send(200, runPage(view));
    if (req.method === "GET" && sub === "status.json")
      return send(200, JSON.stringify({ phase: view.phase, panel: runPanel(view) }), "application/json");
    if (req.method === "GET" && (sub === "video.mp4" || sub === "thumb.jpg")) {
      const file = join(runsDir, id, sub);
      if (!existsSync(file)) return send(404, "not found", "text/plain");
      return sendFile(req, res, file, sub === "video.mp4" ? "video/mp4" : "image/jpeg");
    }
    if (req.method === "POST" && sub === "revise") {
      const note = (new URLSearchParams(await body(req)).get("note") ?? "").trim().slice(0, 600);
      if (note && !liveJob(id) && view.canRevise) enqueue(id, ["revise", id, "--note", note]);
      return redirect(`/runs/${id}`);
    }
    if (req.method === "POST" && sub === "resume") {
      if (!liveJob(id)) enqueue(id, ["resume", id]);
      return redirect(`/runs/${id}`);
    }
    if (sub === "script") {
      const stored = Script.safeParse(readJson(id, "script.json"));
      if (!stored.success) return send(404, messagePage("Chưa có kịch bản", "Tập này chưa có kịch bản để sửa."));
      const library = lib();
      const names: Record<string, string> = { narrator: "Người dẫn" };
      for (const p of Object.values(library.people)) names[p.id] = p.name;
      const budget = library.formats[stored.data.format]?.maxSpokenChars ?? 1000;
      if (req.method === "GET")
        return send(
          200,
          editorPage({
            id,
            script: stored.data,
            names,
            errors: {},
            topErrors: [],
            budget,
            saved: url.searchParams.has("saved"),
          }),
        );
      if (liveJob(id))
        return send(
          409,
          messagePage("Đang chạy", "Tập này đang được làm. Chờ xong rồi hãy sửa kịch bản.", "Đang chạy"),
        );
      const form = new URLSearchParams(await body(req));
      const edited = applyScriptForm(stored.data, form);
      const errors: Record<string, string> = {};
      const topErrors: string[] = [];
      const parsed = Script.safeParse(edited);
      if (!parsed.success)
        for (const issue of parsed.error.issues) {
          const f = fieldOf(issue.path);
          if (f) errors[f] ??= explain(issue.message);
          else topErrors.push(explain(issue.message));
        }
      else topErrors.push(...checkScriptRefs(parsed.data, library).map(explain));
      if (Object.keys(errors).length && !topErrors.length) topErrors.push("Có chỗ chưa hợp lệ, xem các ô đánh dấu đỏ.");
      if (!parsed.success || topErrors.length)
        return send(422, editorPage({ id, script: edited, names, errors, topErrors, budget }));
      new ArtifactStore(join(runsDir, id)).writeJson("script.json", parsed.data);
      if (form.get("next") === "render") {
        enqueue(id, ["resume", id]);
        return redirect(`/runs/${id}`);
      }
      return redirect(`/runs/${id}/script?saved=1`);
    }
    return send(405, messagePage("Không làm được", "Thao tác này không có ở đây."));
  }

  const server = createServer((req, res) => {
    handle(req, res).catch((e: unknown) => {
      if (!res.headersSent) res.writeHead(500, { "content-type": "text/html; charset=utf-8" });
      res.end(messagePage("Có lỗi", `Studio gặp lỗi: ${String(e).slice(0, 300)}`, "Có lỗi"));
    });
  });
  server.listen(port, "127.0.0.1", () => console.log(`Studio: http://localhost:${port}`));
  return new Promise((resolve, reject) => {
    server.on("close", resolve);
    server.on("error", reject);
  });
}

// form bodies are small; anything larger than 1 MB is not a form this studio sent
function body(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > 1_000_000) {
        reject(new Error("form too large"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

// byte ranges, so the browser's video player can seek
function sendFile(req: IncomingMessage, res: ServerResponse, file: string, type: string): void {
  const size = statSync(file).size;
  const r = req.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
  if (r && (r[1] || r[2])) {
    const start = r[1] ? Number(r[1]) : Math.max(0, size - Number(r[2]));
    const end = r[1] && r[2] ? Math.min(Number(r[2]), size - 1) : size - 1;
    if (start > end || start >= size) {
      res.writeHead(416, { "content-range": `bytes */${size}` });
      res.end();
      return;
    }
    res.writeHead(206, {
      "content-type": type,
      "content-range": `bytes ${start}-${end}/${size}`,
      "accept-ranges": "bytes",
      "content-length": end - start + 1,
    });
    createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { "content-type": type, "content-length": size, "accept-ranges": "bytes" });
  createReadStream(file).pipe(res);
}
