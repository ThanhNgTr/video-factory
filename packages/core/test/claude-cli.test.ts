import { Set3D } from "@vf/contracts";
import { describe, expect, it } from "vitest";
import { cliSchema } from "../src/llm/claude-cli.ts";

describe("claude cli schema", () => {
  it("writes tuples as fixed-length arrays (valid for the CLI's draft-07 check and the API's 2020-12) without $schema", () => {
    const text = JSON.stringify(cliSchema(Set3D));
    expect(text).not.toContain("prefixItems");
    expect(text).not.toContain("$schema");
    expect(text).toContain('{"type":"array","items":{"type":"number"},"minItems":3,"maxItems":3}');
  });
});
