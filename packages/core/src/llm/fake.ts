// FakeLlm: answers from fixtures keyed by schemaName. Tests and CI never pay for a call.
import type { Llm, LlmRequest, LlmResult } from "./port.ts";

type Fixture = unknown | ((req: LlmRequest) => unknown);

export class FakeLlm implements Llm {
  readonly calls: LlmRequest[] = [];
  private readonly fixtures: Record<string, Fixture>;
  constructor(fixtures: Record<string, Fixture>) {
    this.fixtures = fixtures;
  }
  async json(req: LlmRequest): Promise<LlmResult> {
    this.calls.push(req);
    const f = this.fixtures[req.schemaName];
    if (f === undefined) throw new Error(`FakeLlm: no fixture for ${req.schemaName}`);
    const value = typeof f === "function" ? (f as (r: LlmRequest) => unknown)(req) : f;
    return { value, usage: { inputTokens: 0, outputTokens: 0, costUsd: 0, ms: 0, provider: "fake", model: req.model } };
  }
}
