// Studio pages as HTML strings, rendered on the server: no build step, and every page works before its script loads.
// All dynamic text goes through `esc`. Icons are lucide paths drawn with currentColor.
import type { FrameReview, Script, ScriptReview } from "@vf/contracts";
import {
  CRITERION_LABEL,
  type ErrorView,
  field,
  type Phase,
  ROLE_LABEL,
  SPEECH,
  type StepView,
  TENSION_LABEL,
} from "./model.ts";

export const esc = (v: unknown): string => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const ICONS = {
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  alert:
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  spinner: '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
  pencil:
    '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>',
  retry: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
  download: '<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  film: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 3v18"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/>',
  back: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  next: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  script:
    '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
  pause: '<circle cx="12" cy="12" r="10"/><path d="M10 15V9"/><path d="M14 15V9"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  circle: '<circle cx="12" cy="12" r="9"/>',
} as const;
type Icon = keyof typeof ICONS;
export const icon = (name: Icon, cls = "icon"): string =>
  `<svg class="${cls}${name === "spinner" ? " spin" : ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`;

type Nav = "episodes" | "learn" | "new" | "none";
export function layout(title: string, nav: Nav, body: string): string {
  const link = (href: string, key: Nav, label: string) =>
    `<a class="nav-link" href="${href}"${nav === key ? ' aria-current="page"' : ""}>${label}</a>`;
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · Video Factory</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Ccircle cx='8' cy='8' r='6' fill='%23e5484d'/%3E%3C/svg%3E">
<link rel="stylesheet" href="/static/studio.css">
<script src="/static/studio.js" defer></script>
</head>
<body>
<a class="skip" href="#main">Bỏ qua thanh điều hướng</a>
<header class="bar">
  <a class="brand" href="/"><span class="brand-mark" aria-hidden="true"></span><span>Video Factory</span><span class="brand-sub">Studio</span></a>
  <nav class="nav" aria-label="Chính">${link("/", "episodes", "Tập phim")}${link("/learn", "learn", "Học từ video")}</nav>
  ${nav === "new" ? "" : `<a class="btn btn-primary bar-cta" href="/new">${icon("plus")}<span>Tạo tập mới</span></a>`}
</header>
<main id="main" class="page">
${body}
</main>
<footer class="foot"><p>Video Factory Studio, chạy trên máy này.</p></footer>
</body>
</html>`;
}

// ---- shared bits
const PHASE: Record<Phase, { icon: Icon; label: string }> = {
  queued: { icon: "clock", label: "Đang chờ tới lượt" },
  running: { icon: "spinner", label: "Đang làm" },
  review: { icon: "script", label: "Chờ bạn duyệt kịch bản" },
  done: { icon: "check", label: "Xong" },
  failed: { icon: "alert", label: "Bị lỗi" },
  stopped: { icon: "pause", label: "Đã dừng giữa chừng" },
};
export const badge = (phase: Phase, label = PHASE[phase].label): string =>
  `<span class="badge" data-phase="${phase}">${icon(PHASE[phase].icon)}<span>${esc(label)}</span></span>`;

export const fmtDuration = (s?: number): string => {
  if (s === undefined) return "";
  const t = Math.floor(s); // the player floors too: 125.5 s reads 2:05 everywhere
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};
// stored in UTC ("2026-11-16T08:17:03.000Z", or SQLite's "2026-11-16 08:17:03"); show the machine's local time
export const fmtDate = (sqlTime: string): string => {
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(sqlTime) ? sqlTime : `${sqlTime.replace(" ", "T")}Z`);
  if (Number.isNaN(d.getTime())) return sqlTime;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const fmtMs = (ms: number): string =>
  ms < 60_000 ? `${Math.max(1, Math.round(ms / 1000))} giây` : `${Math.round(ms / 60_000)} phút`;
const thumb = (id: string, has: boolean, cls: string): string =>
  has
    ? `<img class="${cls}" src="/runs/${esc(id)}/thumb.jpg" alt="" loading="lazy">`
    : `<span class="${cls} frame-empty" aria-hidden="true">${icon("film")}</span>`;
// "Floor Twelve - Part 2" breaks as "Floor Twelve -" / "Part 2", never with the dash or the number alone on a line
const titleHtml = (t: string): string =>
  esc(t)
    .replace(/ - /g, "&nbsp;- ")
    .replace(/Part (\d+)/g, "Part&nbsp;$1");
// a caption line as the video shows it: *marked* words highlighted
const captionHtml = (text: string): string => esc(text).replace(/\*([^*]+)\*/g, '<mark class="hl">$1</mark>');
const hookCard = (hook: string, cls: string): string =>
  `<span class="${cls} frame-hook"><small>Câu mở đầu</small><span>${esc(hook.replace(/\*/g, ""))}</span></span>`;

// ---- episodes
export type EpisodeView = {
  id: string;
  title: string;
  series?: string;
  part?: number;
  phase: Phase;
  hasThumb: boolean;
  seconds?: number;
  created: string;
  hook?: string; // the script's first spoken line, shown while there is no video yet
};
const NEXT_STEP: Record<Phase, string> = {
  queued: "Tập này đang chờ tới lượt. Máy làm từng tập một.",
  running: "Máy đang làm tập này. Bạn có thể đóng trang, việc vẫn chạy tiếp.",
  review: "Kịch bản đã xong. Đọc lại, sửa nếu muốn, rồi cho dựng hình.",
  done: "Video đã xong và qua kiểm tra. Xem, tải về, hoặc sửa kịch bản để làm lại.",
  failed: "Tập này bị lỗi giữa chừng. Mở ra để xem lỗi và thử lại.",
  stopped: "Tập này dừng giữa chừng. Mở ra để làm tiếp từ chỗ đã dừng.",
};
// the series and part only when the title does not already say them
const meta = (e: { title: string; series?: string; part?: number; seconds?: number; created?: string }): string =>
  [
    e.series && !e.title.includes(e.series) ? e.series : "",
    e.part && !e.title.includes(`Part ${e.part}`) ? `Tập ${e.part}` : "",
    fmtDuration(e.seconds),
    e.created ? fmtDate(e.created) : "",
  ]
    .filter(Boolean)
    .map(esc)
    .join(" · ");

export function episodesPage(list: EpisodeView[]): string {
  if (!list.length)
    return layout(
      "Tập phim",
      "episodes",
      `<section class="empty">
  <h1 class="display">Chưa có tập nào</h1>
  <p class="lede">Bạn đưa ý tưởng, máy viết kịch bản, dàn dựng, lồng tiếng và dựng thành video. Bạn chỉ cần duyệt kịch bản.</p>
  <ol class="how">
    <li><span><strong>Tạo tập mới.</strong> Chọn series và ghi ý tưởng, hoặc để trống.</span></li>
    <li><span><strong>Duyệt kịch bản.</strong> Khoảng 3 phút sau kịch bản sẵn sàng để bạn sửa.</span></li>
    <li><span><strong>Nhận video.</strong> Dựng hình mất khoảng 20 phút, xong là xem và tải được.</span></li>
  </ol>
  <a class="btn btn-primary btn-lg" href="/new">${icon("plus")}<span>Tạo tập đầu tiên</span></a>
</section>`,
    );
  // the lead is what needs the producer, else what is moving, else the newest
  const order: Phase[] = ["review", "failed", "stopped", "running", "queued", "done"];
  const lead = [...list].sort((a, b) => order.indexOf(a.phase) - order.indexOf(b.phase))[0] ?? list[0];
  if (!lead) return "";
  const rest = list.filter((e) => e !== lead);
  const action =
    lead.phase === "review"
      ? `<a class="btn btn-primary btn-lg" href="/runs/${esc(lead.id)}/script">${icon("pencil")}<span>Duyệt kịch bản</span></a>`
      : lead.phase === "done"
        ? `<a class="btn btn-primary btn-lg" href="/runs/${esc(lead.id)}">${icon("play")}<span>Xem video</span></a>`
        : `<a class="btn btn-lg" href="/runs/${esc(lead.id)}">${icon("next")}<span>Mở tập này</span></a>`;
  return layout(
    "Tập phim",
    "episodes",
    `<h1 class="sr-only">Tập phim</h1>
<section class="lead" aria-labelledby="lead-title"${lead.phase === "running" || lead.phase === "queued" ? ` data-live="/runs/${esc(lead.id)}/status.json" data-phase="${lead.phase}"` : ""}>
  <a class="lead-media" href="/runs/${esc(lead.id)}" tabindex="-1" aria-hidden="true">${
    lead.hasThumb || !lead.hook
      ? thumb(lead.id, lead.hasThumb, "lead-thumb")
      : hookCard(lead.hook, "lead-thumb frame-empty")
  }</a>
  <div class="lead-body">
    <p class="eyebrow">${meta(lead)}</p>
    <h2 id="lead-title" class="display"><a class="title-link" href="/runs/${esc(lead.id)}">${titleHtml(lead.title)}</a></h2>
    ${badge(lead.phase)}
    <p class="lede">${NEXT_STEP[lead.phase]}</p>
    <div class="actions">${action}</div>
  </div>
</section>
${
  rest.length
    ? `<section class="section" aria-labelledby="all-title">
  <h2 id="all-title" class="h3">Các tập khác</h2>
  <ul class="rows">${rest
    .map(
      (e) =>
        `<li><a class="row" href="/runs/${esc(e.id)}">${thumb(e.id, e.hasThumb, "row-thumb")}<span class="row-main"><span class="row-title">${esc(e.title)}</span><span class="row-meta">${meta(e)}</span></span>${badge(e.phase)}</a></li>`,
    )
    .join("")}</ul>
</section>`
    : ""
}`,
  );
}

// ---- new episode
export type SeriesOption = {
  id: string;
  title: string;
  parts: number;
  lastTitle?: string;
  choice?: { option1: string; option2: string };
  pending?: string; // the next part is already started: picking this series opens it
};
// a one-off kind of video: a built-in format (explainer, skit) or one learned from a sample
export type FormatOption = { id: string; title: string; meta: string };

export function newPage(
  series: SeriesOption[],
  o: {
    busyWith?: string;
    error?: string;
    values?: Record<string, string>;
    formula?: string;
    formats?: FormatOption[];
  } = {},
): string {
  const v = o.values ?? {};
  const open = series.filter((s) => !s.pending);
  const picked = v.series ?? open[0]?.id ?? "__new";
  const seriesCard = (s: SeriesOption) =>
    s.pending
      ? `<a class="choice choice-link" href="/runs/${esc(s.pending)}">
  ${icon("next", "icon choice-icon")}
  <span class="choice-body"><span class="choice-title">${esc(s.title)}</span>
  <span class="choice-meta">Tập ${s.parts + 1} đang làm dở. Mở tập đó để làm tiếp.</span></span>
</a>`
      : `<label class="choice">
  <input type="radio" name="series" value="${esc(s.id)}"${picked === s.id ? " checked" : ""} required>
  <span class="choice-body"><span class="choice-title">${esc(s.title)}</span>
  <span class="choice-meta">${s.parts ? `Đã có ${s.parts} tập, lần này làm tập ${s.parts + 1}` : "Chưa có tập nào, lần này làm tập 1"}${s.lastTitle ? `. Tập trước: ${esc(s.lastTitle)}` : ""}</span></span>
</label>`;
  // no default: the app cannot know which option won, and a wrong guess silently continues the wrong branch
  const votes = open
    .filter((s) => s.choice)
    .map(
      (s) => `<fieldset class="group" data-for-series="${esc(s.id)}">
  <legend>Khán giả chọn gì ở cuối tập trước của ${esc(s.title)}?</legend>
  <p class="hint">Xem bình luận của tập trước, phương án nào nhiều hơn thì chọn phương án đó.</p>
  <div class="choices">
  ${(["1", "2"] as const)
    .map(
      (n) =>
        `<label class="choice choice-sm"><input type="radio" name="choice-${esc(s.id)}" value="${n}"${v[`choice-${s.id}`] === n ? " checked" : ""}><span class="choice-body"><span class="choice-title">Phương án ${n}</span><span class="choice-meta">${esc(n === "1" ? s.choice?.option1 : s.choice?.option2)}</span></span></label>`,
    )
    .join("")}
  </div>
</fieldset>`,
    )
    .join("");
  return layout(
    "Tạo tập mới",
    "new",
    `<div class="page-head narrow"><h1 class="display">Tạo tập mới</h1>
<p class="lede">Chọn series, ghi ý tưởng nếu có. Máy tự viết kịch bản, tự chấm và sửa, rồi dựng thành video trong khoảng 25 phút.</p></div>
${o.busyWith ? `<div class="note" role="status">${icon("clock")}<p>Máy đang làm <strong>${esc(o.busyWith)}</strong>. Tập mới sẽ vào hàng chờ và tự chạy khi xong.</p></div>` : ""}
${o.error ? `<div class="alert" role="alert">${icon("alert")}<p>${esc(o.error)}</p></div>` : ""}
<form class="form narrow" method="post" action="/new" data-submit-busy>
  ${
    o.formula
      ? `<div class="note">${icon("script")}<p>Dùng công thức <strong>${esc(o.formula.replace(/-/g, " "))}</strong>. <a href="/new">Bỏ chọn</a></p></div><input type="hidden" name="formula" value="${esc(o.formula)}">`
      : ""
  }
  <fieldset class="group">
    <legend>Series</legend>
    <div class="choices">${series.map(seriesCard).join("")}
    <label class="choice">
      <input type="radio" name="series" value="__new"${picked === "__new" ? " checked" : ""}>
      <span class="choice-body"><span class="choice-title">Series mới</span><span class="choice-meta">Máy tự đặt thế giới và luật chơi từ công thức đã học.</span></span>
    </label></div>
    <div class="field" data-for-series="__new">
      <label for="newSeries">Tên series mới</label>
      <input id="newSeries" name="newSeries" maxlength="60" value="${esc(v.newSeries)}" placeholder="Ví dụ: The Last Bus" autocomplete="off">
      <p class="hint">Tiếng Anh, vì video bằng tiếng Anh.</p>
    </div>
  </fieldset>
  ${votes}
  <div class="field">
    <label for="idea">Ý tưởng <span class="optional">không bắt buộc</span></label>
    <textarea id="idea" name="idea" rows="4" maxlength="600" placeholder="Ví dụ: Theo quay lại quán một mình và gọi đúng món của tối hôm trước.">${esc(v.idea)}</textarea>
    <p class="hint">Viết tiếng Việt cũng được. Để trống thì máy tự nghĩ.</p>
  </div>
  <details class="details"${v.review === "1" ? " open" : ""}><summary>Tuỳ chọn nâng cao</summary>
  <label class="check">
    <input type="checkbox" name="review" value="1"${v.review === "1" ? " checked" : ""}>
    <span><span class="check-title">Dừng lại cho tôi đọc kịch bản trước khi dựng hình</span><span class="hint">Thường không cần: máy đã tự chấm và sửa kịch bản. Bật khi bạn muốn tự sửa tay từng câu.</span></span>
  </label>
  </details>
  <div class="actions"><button class="btn btn-primary btn-lg" type="submit">${icon("play")}<span>Bắt đầu</span></button><a class="btn btn-quiet btn-lg" href="/">Huỷ</a></div>
</form>
${o.formats?.length ? singleForm(o.formats, v) : ""}`,
  );
}

// a video outside any series: pick a kind, give a topic (ADR 0017)
function singleForm(formats: FormatOption[], v: Record<string, string>): string {
  const picked = formats.some((f) => f.id === v.format) ? v.format : formats[0]?.id;
  return `<section class="section narrow" aria-labelledby="single-title">
<h2 id="single-title" class="h3">Hoặc một video lẻ</h2>
<p class="hint">Không thuộc series nào: chọn thể loại, ghi chủ đề, máy làm trọn một video.</p>
<form class="form" method="post" action="/new/single" data-submit-busy>
  <fieldset class="group"><legend>Thể loại</legend><div class="choices">${formats
    .map(
      (f) => `<label class="choice">
      <input type="radio" name="format" value="${esc(f.id)}"${f.id === picked ? " checked" : ""}>
      <span class="choice-body"><span class="choice-title">${esc(f.title)}</span><span class="choice-meta">${esc(f.meta)}</span></span>
    </label>`,
    )
    .join("")}</div></fieldset>
  <div class="field">
    <label for="single-idea">Chủ đề hoặc ý tưởng</label>
    <textarea id="single-idea" name="singleIdea" rows="3" maxlength="600" required placeholder="Ví dụ: Vì sao gấp một tờ giấy 42 lần thì chạm tới Mặt Trăng?">${esc(v.singleIdea)}</textarea>
    <p class="hint">Viết tiếng Việt cũng được.</p>
  </div>
  <div class="actions"><button class="btn btn-primary btn-lg" type="submit">${icon("play")}<span>Làm video</span></button></div>
</form>
</section>`;
}

// ---- one episode
export type RunView = {
  id: string;
  title: string;
  series?: string;
  part?: number;
  phase: Phase;
  steps: StepView[];
  progress?: number;
  eta?: number;
  error?: ErrorView;
  hasVideo: boolean;
  hasThumb: boolean;
  qa?: { pass: boolean; seconds: number };
  cost: number;
  created: string;
  chars?: number;
  budget?: number;
  hook?: string;
  review?: ScriptReview;
  frames?: FrameReview;
  canRevise?: boolean;
};
const STEP_ICON: Record<StepView["state"], Icon> = {
  done: "check",
  active: "spinner",
  todo: "circle",
  failed: "alert",
};
const STEP_WORD: Record<StepView["state"], string> = {
  done: "xong",
  active: "đang làm",
  todo: "chưa làm",
  failed: "lỗi",
};

export function runPanel(r: RunView): string {
  const resume = (label: string, cls: string, ic: Icon) =>
    `<form method="post" action="/runs/${esc(r.id)}/resume" data-submit-busy><button class="btn ${cls}" type="submit">${icon(ic)}<span>${label}</span></button></form>`;
  const actions: Record<Phase, string> = {
    review: `<a class="btn btn-primary" href="/runs/${esc(r.id)}/script">${icon("pencil")}<span>Duyệt kịch bản</span></a>${resume("Dựng luôn, không duyệt", "btn-quiet", "play")}`,
    done: `<a class="btn btn-primary" href="/runs/${esc(r.id)}/video.mp4" download="${esc(r.id)}.mp4">${icon("download")}<span>Tải video</span></a>`,
    failed: resume("Thử lại", "btn-primary", "retry"),
    stopped: resume("Làm tiếp", "btn-primary", "retry"),
    running: "",
    queued: "",
  };
  const status: Record<Phase, string> = {
    review: "Kịch bản đã sẵn sàng. Duyệt và sửa nếu cần, rồi cho dựng hình (khoảng 20 phút).",
    done: r.qa ? `Video dài ${fmtDuration(r.qa.seconds)} và đã qua kiểm tra tự động.` : "Video đã xong.",
    failed: "Thử lại sẽ chạy tiếp từ bước lỗi, các bước đã xong được giữ nguyên.",
    stopped: "Lần chạy trước dừng giữa chừng. Làm tiếp sẽ chạy từ chỗ đã dừng.",
    running: "Bạn có thể đóng trang này, việc vẫn chạy tiếp.",
    queued: "Máy làm từng tập một. Tập này sẽ tự chạy khi tới lượt.",
  };
  const bar =
    r.phase === "running" && r.progress !== undefined
      ? `<div class="progress" role="progressbar" aria-label="Dựng hình" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${r.progress}" style="--fill:${r.progress / 100}"><span></span></div>
<p class="progress-text">Dựng hình ${r.progress}%${r.eta !== undefined ? `, còn khoảng ${Math.max(1, Math.round(r.eta / 60))} phút` : ""}</p>`
      : "";
  const error =
    r.error && (r.phase === "failed" || r.phase === "stopped")
      ? `<div class="alert" role="alert">${icon("alert")}<div><p>${esc(r.error.text)}</p><details class="details"><summary>Chi tiết kỹ thuật</summary><p class="mono">${esc(r.error.raw)}</p></details></div></div>`
      : "";
  const steps = `<ol class="steps" aria-label="Các bước">${r.steps
    .map(
      (s) =>
        `<li class="step" data-state="${s.state}">${icon(STEP_ICON[s.state])}<span class="step-label">${s.label}</span><span class="step-time"><span class="sr-only">${STEP_WORD[s.state]}</span>${s.state === "done" && s.ms ? fmtMs(s.ms) : ""}</span></li>`,
    )
    .join("")}</ol>`;
  return `<div class="status-panel" data-status-panel>
  ${badge(r.phase)}
  <p class="status-text">${status[r.phase]}</p>
  ${bar}
  ${error}
  ${actions[r.phase] ? `<div class="actions">${actions[r.phase]}</div>` : ""}
</div>
${r.phase === "done" ? `<details class="details steps-history"><summary>Các bước đã chạy</summary>${steps}</details>` : steps}`;
}

export function runPage(r: RunView): string {
  const live = r.phase === "running" || r.phase === "queued";
  // the 9:16 frame only once there is a video; before that the hook line, after the status on phones
  const media = r.hasVideo
    ? `<video class="player" controls preload="metadata" playsinline${r.hasThumb ? ` poster="/runs/${esc(r.id)}/thumb.jpg"` : ""} src="/runs/${esc(r.id)}/video.mp4"><a href="/runs/${esc(r.id)}/video.mp4">Tải video</a></video>`
    : r.hook
      ? hookCard(r.hook, "hook-card")
      : "";
  const facts = [
    r.chars !== undefined && r.budget ? ["Lời đọc", `${r.chars} / ${r.budget} ký tự`] : undefined,
    ["Chi phí", `$${r.cost.toFixed(2)}`],
    r.created ? ["Tạo lúc", fmtDate(r.created)] : undefined,
  ].filter((x): x is string[] => !!x);
  const eyebrow = meta({ title: r.title, series: r.series, part: r.part });
  return layout(
    r.title,
    "none",
    `<p class="crumb"><a href="/">${icon("back")}<span>Tập phim</span></a></p>
<div class="run"${r.hasVideo ? "" : " data-no-video"}${live ? ` data-live="/runs/${esc(r.id)}/status.json" data-phase="${r.phase}"` : ""}>
  ${media ? `<div class="run-media">${media}</div>` : ""}
  <div class="run-body">
    ${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ""}
    <h1 class="display-sm">${titleHtml(r.title)}</h1>
    <div class="live-panel" data-live-panel>${runPanel(r)}</div>
    ${reviewSection(r)}
    ${framesSection(r.frames)}
    ${reviseSection(r)}
    <dl class="facts">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
  </div>
</div>`,
  );
}

// what the script critic said; failing criteria first, in the producer's words (the notes are the critic's English)
function reviewSection(r: RunView): string {
  const rv = r.review;
  if (!rv) return "";
  const failed = rv.criteria.filter((c) => !c.pass);
  const line = rv.pass
    ? `Kịch bản đạt ${rv.score}/10 sau ${rv.rounds === 1 ? "lần chấm đầu" : `${rv.rounds} lần chấm, máy đã tự sửa ${rv.rounds - 1} lần`}.`
    : `Kịch bản chỉ đạt ${rv.score}/10 sau ${rv.rounds} lần chấm. Máy vẫn dựng video với bản tốt nhất; bạn có thể viết lại kèm ghi chú bên dưới.`;
  return `<section class="panel" aria-labelledby="review-title">
  <h2 id="review-title" class="h4">${icon(rv.pass ? "check" : "alert")}<span>Máy chấm kịch bản</span></h2>
  <p>${line}</p>
  <details class="details"><summary>Xem nhận xét${failed.length ? ` (${failed.length} điểm chưa đạt)` : ""}</summary>
  <p class="mono">${esc(rv.summary)}</p>
  <ul class="criteria">${[...failed, ...rv.criteria.filter((c) => c.pass)]
    .map(
      (c) =>
        `<li data-pass="${c.pass}">${c.pass ? icon("check", "icon crit-ok") : icon("alert", "icon crit-no")}<span><strong>${esc(CRITERION_LABEL[c.id] ?? c.id)}</strong> <span class="mono">${esc(c.note)}</span></span></li>`,
    )
    .join("")}</ul>
  </details>
</section>`;
}

const SEVERITY: Record<string, string> = { high: "nặng", medium: "vừa", low: "nhẹ" };
// what the vision reviewers saw on the finished video; reported, never blocking
function framesSection(f: FrameReview | undefined): string {
  if (!f) return "";
  const all = f.reviewers.flatMap((v) => v.defects.map((d) => ({ ...d, by: v.name })));
  const serious = all.filter((d) => d.severity !== "low").length;
  const names = f.reviewers.map((v) => (v.name === "codex" ? "Codex" : "Claude")).join(" và ");
  const line = !f.reviewers.some((v) => v.ok)
    ? "Chưa duyệt được hình: người duyệt không trả lời."
    : all.length
      ? `${names} thấy ${all.length} lỗi hình${serious ? `, ${serious} lỗi đáng chú ý` : ""}. Video vẫn dùng được; các lỗi này được ghi lại để sửa bộ dựng hình.`
      : `${names} không thấy lỗi hình nào.`;
  return `<section class="panel" aria-labelledby="frames-title">
  <h2 id="frames-title" class="h4">${icon(all.length ? "alert" : "check")}<span>Máy duyệt hình</span></h2>
  <p>${line}</p>
  ${
    all.length
      ? `<details class="details"><summary>Xem các lỗi</summary><ul class="criteria">${all
          .map(
            (d) =>
              `<li data-pass="false">${icon("alert", "icon crit-no")}<span><strong>${esc(SEVERITY[d.severity] ?? d.severity)}, khung ${esc(d.frames.join(", "))}</strong> <span class="mono">${esc(d.detail)} (${esc(d.by)})</span></span></li>`,
          )
          .join("")}</ul></details>`
      : ""
  }
</section>`;
}

// the producer's one lever: say what to change, the machine rewrites the whole script and remakes the video
function reviseSection(r: RunView): string {
  if (!r.canRevise) return "";
  return `<section class="panel" aria-labelledby="revise-title">
  <h2 id="revise-title" class="h4">${icon("retry")}<span>Chưa ưng ý?</span></h2>
  <form class="form-tight" method="post" action="/runs/${esc(r.id)}/revise" data-submit-busy>
    <div class="field">
      <label for="note">Muốn đổi gì</label>
      <textarea id="note" name="note" rows="3" maxlength="600" required placeholder="Ví dụ: đoạn tài xế xuất hiện cần đáng sợ hơn, bớt lời dẫn ở đầu."></textarea>
      <p class="hint">Viết tiếng Việt cũng được. Máy viết lại cả kịch bản theo ghi chú, tự chấm lại, rồi dựng lại video (khoảng 25 phút).</p>
    </div>
    <div class="actions"><button class="btn btn-primary" type="submit">${icon("retry")}<span>Viết lại và làm lại video</span></button><a class="btn btn-quiet" href="/runs/${esc(r.id)}/script">${icon("pencil")}<span>Tự sửa tay</span></a></div>
  </form>
</section>`;
}

// ---- script editor
export type EditorView = {
  id: string;
  script: Script;
  names: Record<string, string>; // speaker id -> display name
  errors: Record<string, string>;
  topErrors: string[];
  budget: number;
  saved?: boolean;
};
export function editorPage(e: EditorView): string {
  const s = e.script;
  const err = (name: string) =>
    e.errors[name]
      ? `<p class="field-error" id="${esc(name)}-err">${icon("alert")}<span>${esc(e.errors[name])}</span></p>`
      : "";
  const aria = (name: string) => (e.errors[name] ? ` aria-invalid="true" aria-describedby="${esc(name)}-err"` : "");
  const input = (name: string, label: string, value: string, max: number, cls = "") =>
    `<div class="field ${cls}"><label for="${esc(name)}">${label}</label><input id="${esc(name)}" name="${esc(name)}" value="${esc(value)}" maxlength="${max}"${aria(name)}>${err(name)}</div>`;
  const area = (name: string, label: string, value: string, max: number, cls: string, spoken = false) =>
    `<div class="field ${cls}"><label for="${esc(name)}">${label}</label><textarea id="${esc(name)}" name="${esc(name)}" rows="${Math.max(1, Math.ceil(value.length / 70))}" maxlength="${max}"${spoken ? ` data-spoken data-preview="${esc(name)}-pv"` : ""}${aria(name)}>${esc(value)}</textarea>${
      spoken ? `<p class="caption-preview" id="${esc(name)}-pv" aria-hidden="true">${captionHtml(value)}</p>` : ""
    }${err(name)}</div>`;
  const beats = s.beats
    .map(
      (b, i) => `<li class="beat" id="beat-${i + 1}">
  <div class="beat-head"><span class="beat-no">${i + 1}</span><h2 class="beat-role">${esc(ROLE_LABEL[b.role] ?? b.role)}</h2><span class="tag" data-tension="${esc(b.tension)}">${esc(TENSION_LABEL[b.tension] ?? b.tension)}</span></div>
  ${area(field.action(i), "Hình ảnh", b.action, 300, "field-stage")}
  ${b.text !== undefined ? input(field.text(i), "Chữ lớn trên màn hình", b.text, 60, "field-card") : ""}
  ${b.lines.map((l, j) => area(field.line(i, j), esc(e.names[l.who] ?? l.who), l.text, 220, "field-line", true)).join("")}
  ${b.lines.length ? "" : '<p class="hint">Cảnh im lặng, không có lời.</p>'}
</li>`,
    )
    .join("");
  const index = `<nav class="beat-index" aria-label="Đi tới beat">${s.beats
    .map(
      (b, i) =>
        `<a href="#beat-${i + 1}" data-tension="${esc(b.tension)}" title="${esc(ROLE_LABEL[b.role] ?? b.role)}">${i + 1}</a>`,
    )
    .join("")}</nav>`;
  return layout(
    `Kịch bản: ${s.title}`,
    "none",
    `<p class="crumb"><a href="/runs/${esc(e.id)}">${icon("back")}<span>Về tập này</span></a></p>
<div class="page-head narrow"><p class="eyebrow">Kịch bản</p><h1 class="display-sm">${titleHtml(s.title)}</h1>
<p class="lede">Sửa lời dẫn, lời thoại và chữ trên màn hình. Máy sẽ dàn dựng lại theo bản bạn lưu. Video bằng tiếng Anh nên chỉ viết tiếng Anh không dấu. Từ nằm giữa hai dấu <code>*</code> được tô vàng trên phụ đề.</p></div>
${e.saved ? `<div class="note note-ok narrow" role="status">${icon("check")}<p>Đã lưu kịch bản.</p></div>` : ""}
${e.topErrors.length ? `<div class="alert narrow" role="alert">${icon("alert")}<div><p><strong>Chưa lưu được.</strong> Sửa những chỗ sau rồi lưu lại:</p><ul>${e.topErrors.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div></div>` : ""}
<div class="editor-layout">
${index}
<form class="editor" method="post" action="/runs/${esc(e.id)}/script" data-budget="${e.budget}" data-cps="${SPEECH.charsPerSecond}" data-pad="${SPEECH.padSeconds}" data-submit-busy>
  ${input(field.title, "Tên tập", s.title, 60)}
  <ol class="beats">${beats}</ol>
  ${
    s.choice
      ? `<fieldset class="group"><legend>Lựa chọn cho khán giả ở cuối tập</legend>${input(field.choice(1), "Phương án 1", s.choice.option1, 120)}${input(field.choice(2), "Phương án 2", s.choice.option2, 120)}</fieldset>`
      : ""
  }
  <div class="savebar">
    <div class="meter" data-meter>
      <p class="meter-text" aria-live="polite" data-meter-text>Lời đọc</p>
      <div class="meter-bar" aria-hidden="true"><span></span></div>
    </div>
    <div class="savebar-actions">
      <button class="btn" type="submit" name="next" value="save"><span>Lưu</span></button>
      <button class="btn btn-primary" type="submit" name="next" value="render">${icon("play")}<span>Lưu và dựng hình</span></button>
    </div>
  </div>
</form>
</div>`,
  );
}

// ---- learn from a viral video
// format: the kind of the format learned with this formula (one-off videos), when there is one
export type FormulaView = { id: string; summary: string; lengthS: number; source: string; format?: string };
export type LearnJob = { id: string; phase: Phase; created: string; url: string; formula?: string };
const sourceName = (url: string): string => {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "")}`;
  } catch {
    return url;
  }
};
const LEARN_LABEL: Partial<Record<Phase, string>> = { done: "Đã học xong", review: "Đã học xong", running: "Đang học" };
export function learnPage(
  formulas: FormulaView[],
  jobs: LearnJob[],
  o: { error?: string; url?: string; idea?: string } = {},
): string {
  const live = jobs.find((j) => j.phase === "running" || j.phase === "queued");
  return layout(
    "Học từ video viral",
    "learn",
    `<div class="page-head narrow"><h1 class="display">Học từ video viral</h1>
<p class="lede">Dán link một video ngắn đang viral. Máy học cách làm: thể loại, nhịp, kiểu mở đầu, cách minh hoạ. Rồi tự làm một video mới cùng kiểu, không chép nội dung, nhân vật hay lời thoại.</p></div>
${o.error ? `<div class="alert narrow" role="alert">${icon("alert")}<p>${esc(o.error)}</p></div>` : ""}
<form class="form narrow" method="post" action="/learn" data-submit-busy>
  <div class="field"><label for="url">Link video mẫu</label><input id="url" name="url" type="url" required inputmode="url" placeholder="https://www.youtube.com/shorts/..." value="${esc(o.url)}"></div>
  <div class="field"><label for="idea">Chủ đề hoặc ý tưởng <span class="optional">không bắt buộc</span></label><textarea id="idea" name="idea" rows="3" maxlength="500" placeholder="Ví dụ: Vì sao gấp một tờ giấy 42 lần thì chạm tới Mặt Trăng?">${esc(o.idea)}</textarea><p class="hint">Viết tiếng Việt cũng được. Để trống thì máy làm cùng chủ đề với mẫu, bằng lời và ví dụ mới.</p></div>
  <div class="actions"><button class="btn btn-primary btn-lg" type="submit" name="mode" value="like">${icon("plus")}<span>Làm video tương tự</span></button><button class="btn btn-lg" type="submit" name="mode" value="learn">${icon("link")}<span>Chỉ học công thức</span></button></div>
</form>
${
  jobs.length
    ? `<section class="section narrow" aria-labelledby="jobs-title"${live ? ` data-live="/runs/${esc(live.id)}/status.json" data-phase="${live.phase}"` : ""}><h2 id="jobs-title" class="h3">Các lần học</h2><ul class="rows">${jobs
        .map((j) => {
          const body = `<span class="row-main"><span class="row-title">${esc(sourceName(j.url))}</span><span class="row-meta">${esc(fmtDate(j.created))}${j.formula ? ` · công thức ${esc(j.formula.replace(/-/g, " "))}` : ""}</span></span>${badge(j.phase === "review" ? "done" : j.phase, LEARN_LABEL[j.phase])}`;
          return `<li>${j.formula ? `<a class="row row-plain" href="#formula-${esc(j.formula)}">${body}</a>` : `<div class="row row-plain">${body}</div>`}</li>`;
        })
        .join("")}</ul></section>`
    : ""
}
<section class="section narrow" aria-labelledby="formulas-title">
  <h2 id="formulas-title" class="h3">Công thức đã học (${formulas.length})</h2>
  ${
    formulas.length
      ? `<ul class="cards">${formulas
          .map(
            (f) =>
              `<li class="card" id="formula-${esc(f.id)}"><h3 class="card-title">${esc(f.id.replace(/-/g, " "))}</h3><p class="card-text">${esc(f.summary)}</p><p class="row-meta">Video gốc dài ${esc(fmtDuration(f.lengthS))} · <a href="${esc(f.source)}" rel="noreferrer noopener" target="_blank">${esc(sourceName(f.source))}</a></p><div class="actions">${
                f.format
                  ? `<form method="post" action="/learn/make" data-submit-busy><input type="hidden" name="formula" value="${esc(f.id)}"><button class="btn btn-primary" type="submit">${icon("plus")}<span>Làm thêm video theo mẫu này</span></button></form>`
                  : `<a class="btn" href="/new?formula=${encodeURIComponent(f.id)}">${icon("plus")}<span>Tạo tập theo công thức này</span></a>`
              }</div></li>`,
          )
          .join("")}</ul>`
      : '<p class="hint">Chưa có công thức nào. Dán link ở trên để bắt đầu.</p>'
  }
</section>`,
  );
}

export function messagePage(title: string, text: string, status = "Không tìm thấy"): string {
  return layout(
    title,
    "none",
    `<section class="empty"><h1 class="display">${esc(status)}</h1><p class="lede">${esc(text)}</p><a class="btn btn-primary btn-lg" href="/">Về danh sách tập</a></section>`,
  );
}
