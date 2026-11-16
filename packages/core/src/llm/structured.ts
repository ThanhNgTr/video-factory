// Parse + cross-check the model's JSON; on failure send the errors back, at most `repairs` times (roadmap §4.11).
import type { z } from "zod";
import { StageError } from "../errors.ts";
import type { Llm, LlmRequest, LlmUsage } from "./port.ts";

export type AskOptions<T> = {
  check?: (value: T) => string[];
  repairs?: number;
  onUsage?: (u: LlmUsage) => void;
};

export async function askJson<T>(
  llm: Llm,
  req: Omit<LlmRequest, "schema"> & { schema: z.ZodType<T> },
  o: AskOptions<T> = {},
): Promise<T> {
  const repairs = o.repairs ?? 2;
  let user = req.user;
  let lastErrors: string[] = [];
  for (let attempt = 0; attempt <= repairs; attempt++) {
    const { value, usage } = await llm.json({ ...req, user });
    o.onUsage?.(usage);
    const parsed = req.schema.safeParse(value);
    lastErrors = parsed.success
      ? (o.check?.(parsed.data) ?? [])
      : parsed.error.issues.map((i) => `${i.path.join(".") || "$"}: ${i.message}`);
    if (parsed.success && lastErrors.length === 0) return parsed.data;
    user = `${req.user}\n\nYour previous answer was:\n${JSON.stringify(value).slice(0, 20_000)}\n\nIt failed validation:\n- ${lastErrors.slice(0, 30).join("\n- ")}\nReturn the corrected full JSON only.`;
  }
  throw new StageError("invalid-output", `LLM output still invalid after ${repairs} repairs`, {
    details: { errors: lastErrors },
  });
}
