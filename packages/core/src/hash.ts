import { createHash } from "node:crypto";

export const sha256 = (data: string | Uint8Array): string => createHash("sha256").update(data).digest("hex");
// Stable hash of a JSON value: key order does not matter.
export const hashJson = (v: unknown): string => sha256(stableStringify(v));

export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
    .join(",")}}`;
}
