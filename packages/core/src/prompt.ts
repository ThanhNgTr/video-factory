// Prompts are versioned markdown files with {{var}} placeholders (roadmap §6.4).
import { readFileSync } from "node:fs";
import { invariant } from "./errors.ts";

export type Prompt = { version: number; text: string };

export function loadPrompt(file: string): Prompt {
  const raw = readFileSync(file, "utf8");
  const m = raw.match(/^<!--\s*version:\s*(\d+)\s*-->\n/);
  invariant(m?.[1], `prompt ${file} must start with <!-- version: N -->`);
  return { version: Number(m[1]), text: raw.slice(m[0].length) };
}

export function fillPrompt(p: Prompt, vars: Record<string, string>): string {
  return p.text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => {
    const v = vars[k];
    invariant(v !== undefined, `prompt variable ${k} missing`);
    return v;
  });
}
