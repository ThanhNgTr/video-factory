// Spoken-text normalisation for US English TTS: times, "#N", abbreviations. Markup (*word*) is stripped.
const ONES = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

export function numberWords(n: number): string {
  if (n < 20) return ONES[n] ?? String(n);
  if (n < 100) return `${TENS[Math.floor(n / 10)]}${n % 10 ? `-${ONES[n % 10]}` : ""}`;
  return String(n);
}

// "23:58" -> "eleven fifty-eight", "3:00 AM" -> "three o'clock A M", "12:07" -> "twelve oh seven"
export function timeWords(h: number, m: number, suffix?: string): string {
  const hour = numberWords(h % 12 === 0 ? 12 : h % 12);
  const minutes = m === 0 ? "o'clock" : m < 10 ? `oh ${numberWords(m)}` : numberWords(m);
  return `${hour} ${minutes}${suffix ? ` ${suffix.toUpperCase().split("").join(" ")}` : ""}`;
}

export function normalizeSpeech(text: string): string {
  return text
    .replaceAll("*", "")
    .replace(/\b(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?\b/g, (_, h: string, m: string, s?: string) =>
      timeWords(Number(h), Number(m), s),
    )
    .replace(
      /\b(\d{1,2})\s*(AM|PM)\b/g,
      (_, h: string, s: string) => `${numberWords(Number(h))} ${s.split("").join(" ")}`,
    )
    .replace(/#\s*(\d+)/g, (_, n: string) => `number ${numberWords(Number(n))}`)
    .replace(/\bRm\.?\b/g, "room")
    .replace(/\bhon\b/gi, "hun") // "hon" (honey) is read as "Han"
    .replace(/\s+/g, " ")
    .trim();
}

// Words of the display text (markup kept) in order, so TTS word timings can be mapped back onto captions.
export const displayWords = (text: string): string[] => text.split(/\s+/).filter(Boolean);
