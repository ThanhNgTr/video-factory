import type { Snapshot } from "../ports.ts";

// tests and VF_LLM=fake: no renderer, the fake gate never looks at the picture
export class FakeSnapshot implements Snapshot {
  readonly taken: string[] = [];
  async person(_p: unknown, outFile: string): Promise<void> {
    this.taken.push(outFile);
  }
  async set(_s: unknown, outFile: string): Promise<void> {
    this.taken.push(outFile);
  }
}
