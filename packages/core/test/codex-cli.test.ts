import { describe, expect, it } from "vitest";
import { z } from "zod";
import { strict } from "../src/llm/codex-cli.ts";

describe("strict", () => {
  it("closes every object and requires every property, nested ones too", () => {
    const s = strict(z.toJSONSchema(z.object({ a: z.string().optional(), b: z.array(z.object({ c: z.number() })) })));
    expect(s).toMatchObject({ additionalProperties: false, required: ["a", "b"] });
    expect(s).toMatchObject({ properties: { b: { items: { additionalProperties: false, required: ["c"] } } } });
  });
});
