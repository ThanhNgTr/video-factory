// Studio view model: pure functions from run state and artifacts to what the screens show. UI copy is Vietnamese
// (the operator's language); everything that ends up in a video stays English.
import type { Script } from "@vf/contracts";

// The pipeline's stages grouped into the steps a producer cares about.
export const STEPS = [
  { key: "script", label: "Viết kịch bản", stages: ["script.write"] },
  { key: "direct", label: "Dàn dựng", stages: ["script.direct", "script.bible", "assets.check"] },
  { key: "voice", label: "Giọng đọc", stages: ["audio.tts"] },
  { key: "sound", label: "Âm thanh", stages: ["video.timeline", "audio.mix"] },
  { key: "render", label: "Dựng hình", stages: ["video.render"] },
  { key: "check", label: "Kiểm tra", stages: ["video.qa", "video.thumb"] },
] as const;

export type Phase = "queued" | "running" | "review" | "done" | "failed" | "stopped";
export type JobState = "queued" | "running" | "done" | "failed";

// What the producer should see for a run. A live job wins over the database, which lags a little behind it.
// A learn run (ingest) ends with a formula, not a video, so "done" never means "waiting for script review" there.
export function phaseOf(
  dbStatus: string | undefined,
  job: JobState | undefined,
  hasVideo: boolean,
  ingest = false,
): Phase {
  if (job === "queued") return "queued";
  if (job === "running") return "running";
  if (dbStatus === "failed") return "failed";
  if (dbStatus === "paused") return "review";
  if (dbStatus === "done") return hasVideo || ingest ? "done" : "review";
  if (dbStatus === "running") return "stopped"; // shortcut: a run started from the terminal also reads as stopped
  return "queued";
}

export type StageRow = { stage: string; status: string; ms: number; error?: string | null };
export type StepView = { key: string; label: string; state: "done" | "active" | "todo" | "failed"; ms: number };

export function stepsOf(rows: readonly StageRow[], phase: Phase, currentStage?: string): StepView[] {
  let activeSet = false;
  return STEPS.map((s) => {
    const mine = rows.filter((r) => (s.stages as readonly string[]).includes(r.stage));
    const ms = mine.reduce((n, r) => n + (r.ms || 0), 0);
    const failed = mine.some((r) => r.status === "failed");
    const done = s.stages.every((st) => mine.some((r) => r.stage === st && r.status === "done"));
    const isCurrent = currentStage !== undefined && (s.stages as readonly string[]).includes(currentStage);
    let state: StepView["state"] = "todo";
    if (failed && !isCurrent) state = "failed";
    else if (phase === "running" && (isCurrent || (!currentStage && !done && !activeSet))) state = "active";
    else if (done) state = "done";
    if (state === "active") activeSet = true;
    return { key: s.key, label: s.label, state, ms };
  });
}

export const ROLE_LABEL: Record<string, string> = {
  hook: "Mở đầu",
  setup: "Dẫn dắt",
  build: "Tăng dần",
  twist: "Bước ngoặt",
  payoff: "Cao trào",
  loop: "Vòng lặp",
  cta: "Kêu gọi bình chọn",
};
// the script critic's criteria in the producer's words (ids from modules/script/src/domain/review.ts and the formats)
export const CRITERION_LABEL: Record<string, string> = {
  hook: "Mở đầu cuốn hút",
  "one-idea": "Một ý chính",
  "open-loop": "Gài câu hỏi từ đầu",
  "no-dead-air": "Không có đoạn thừa",
  visual: "Mỗi beat có thứ nhìn thấy đổi",
  fresh: "Không lặp lại video cũ",
  escalation: "Căng dần",
  payoff: "Cái kết đáng xem",
  speakable: "Lời đọc tự nhiên",
  "muted-clarity": "Hiểu được khi tắt tiếng",
  original: "Nội dung của riêng mình",
  rules: "Luật chơi bị thử thách",
  wrongness: "Bất thường tăng dần",
  "viewer-role": "Người xem là nhân vật chính",
  vote: "Kết bằng bình chọn 1/2",
  hud: "Đồng hồ và bộ đếm",
  continuity: "Nối mạch series",
  punchline: "Cú chốt",
  "natural-lines": "Thoại tự nhiên",
  loop: "Mời xem lại",
};
export const TENSION_LABEL: Record<string, string> = { calm: "Bình thường", uneasy: "Bất an", scary: "Đáng sợ" };

export const spokenChars = (s: Script): number =>
  s.beats.reduce((n, b) => n + b.lines.reduce((m, l) => m + l.text.replace(/\*/g, "").length, 0), 0);
// shortcut: fitted on one episode after TTS pauses were compressed (885 characters -> 95.5 s); refit with more episodes
export const SPEECH = { charsPerSecond: 13, padSeconds: 7 } as const; // studio.js: seconds = chars / cps + pad

// Form field names used by the script editor. They mirror zod issue paths so errors land on the right field.
export const field = {
  title: "title",
  action: (i: number) => `b${i}.action`,
  text: (i: number) => `b${i}.text`,
  line: (i: number, j: number) => `b${i}.l${j}`,
  choice: (n: 1 | 2) => `choice${n}`,
};

// The edited script: the stored one with the form's values written over it. Validation happens afterwards.
export function applyScriptForm(script: Script, form: URLSearchParams): Script {
  const get = (k: string) => form.get(k)?.replace(/\r\n/g, "\n").trim();
  const title = get(field.title);
  return {
    ...script,
    title: title ?? script.title,
    beats: script.beats.map((b, i) => {
      const text = get(field.text(i));
      const next = {
        ...b,
        action: get(field.action(i)) ?? b.action,
        lines: b.lines.map((l, j) => ({ ...l, text: get(field.line(i, j)) ?? l.text })),
      };
      if (text === undefined) return next;
      const { text: _old, ...rest } = next;
      return text ? { ...rest, text } : rest;
    }),
    choice: script.choice && {
      option1: get(field.choice(1)) ?? script.choice.option1,
      option2: get(field.choice(2)) ?? script.choice.option2,
    },
  };
}

// zod issue paths -> editor field names; anything without a field is reported at the top of the form.
export function fieldOf(path: readonly PropertyKey[]): string | undefined {
  const [a, b, c, d, e] = path;
  if (a === "title") return field.title;
  if (a === "choice" && (b === "option1" || b === "option2")) return field.choice(b === "option1" ? 1 : 2);
  if (a === "beats" && typeof b === "number") {
    if (c === "action") return field.action(b);
    if (c === "text") return field.text(b);
    if (c === "lines" && typeof d === "number" && e === "text") return field.line(b, d);
  }
  return undefined;
}

// Pipeline errors are English and technical: one Vietnamese sentence on what happened and what to do, raw text kept
// for a "technical details" disclosure. Rows keep only the message; the CLI's own line starts with the code.
export type ErrorView = { text: string; raw: string };
const ERRORS: [RegExp, string][] = [
  [
    /^provider-transient|rate.?limit|timed? ?out|ECONNRESET|ETIMEDOUT/i,
    "Dịch vụ AI hoặc giọng đọc đang quá tải. Đợi vài phút rồi bấm Thử lại.",
  ],
  [
    /^provider-failed|cli failed|ENOENT|spawn/i,
    "Không gọi được dịch vụ AI, giọng đọc hoặc bộ dựng hình. Bấm Thử lại; nếu vẫn lỗi, cần người kỹ thuật xem chi tiết.",
  ],
  [
    /^invalid-output|still invalid/i,
    "Máy viết ra kết quả sai nhiều lần liền. Bấm Thử lại; nếu vẫn lỗi, sửa kịch bản cho ngắn gọn hơn.",
  ],
  [
    /^missing-reference|bad reference|unknown (character|set|action|format|formula|sfx)/i,
    "Kịch bản nhắc tới nhân vật, bối cảnh hoặc động tác không có trong thư viện. Sửa kịch bản rồi thử lại.",
  ],
  [
    /^qa-failed|failed QA/i,
    "Video không qua kiểm tra tự động (độ dài, khung hình đen hoặc đoạn im lặng). Sửa kịch bản cho ngắn hơn rồi dựng lại.",
  ],
  [/^budget-exceeded|budget/i, "Tập này đã chạm giới hạn chi phí. Cần người kỹ thuật nâng giới hạn trước khi thử lại."],
  [/^io|ENOSPC|EACCES|no space/i, "Máy hết chỗ trống hoặc không ghi được file. Cần người kỹ thuật dọn ổ đĩa."],
];
export const explainError = (raw: string): ErrorView => ({
  raw,
  text:
    ERRORS.find(([re]) => re.test(raw))?.[1] ??
    "Có một bước bị lỗi. Bấm Thử lại; nếu vẫn lỗi, gửi phần chi tiết cho người kỹ thuật.",
});

// Vietnamese wording for the zod and reference-check messages the producer can actually fix.
export function explain(message: string): string {
  if (/plain US English/.test(message)) return "Chỉ dùng chữ tiếng Anh không dấu (video bằng tiếng Anh).";
  const tooBig = message.match(/expected string to have <=(\d+) characters/);
  if (tooBig) return `Dài quá: tối đa ${tooBig[1]} ký tự.`;
  if (/expected string to have >=1 characters/.test(message)) return "Không được để trống.";
  const spoken = message.match(/total spoken text is (\d+) characters, max (\d+)/);
  if (spoken) return `Lời đọc dài ${spoken[1]} ký tự, tối đa ${spoken[2]}. Hãy cắt bớt vài câu.`;
  return message;
}
