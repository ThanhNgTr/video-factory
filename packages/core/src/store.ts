// Artifact store: stages know names ("audio.json", "audio/s01.mp3"), the store knows paths. Writes are atomic.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { z } from "zod";
import { StageError } from "./errors.ts";
import { sha256 } from "./hash.ts";

export class ArtifactStore {
  readonly dir: string;
  constructor(dir: string) {
    this.dir = dir;
    mkdirSync(dir, { recursive: true });
  }
  path(name: string): string {
    if (name.includes("..")) throw new StageError("io", `bad artifact name ${name}`);
    const p = join(this.dir, name);
    mkdirSync(dirname(p), { recursive: true });
    return p;
  }
  exists(name: string): boolean {
    return existsSync(join(this.dir, name));
  }
  readText(name: string): string {
    return readFileSync(this.path(name), "utf8");
  }
  readJson<T>(name: string, schema: z.ZodType<T>): T {
    const r = schema.safeParse(JSON.parse(this.readText(name)));
    if (!r.success)
      throw new StageError("invalid-output", `${name} does not match its schema`, {
        details: { issues: r.error.issues },
      });
    return r.data;
  }
  writeText(name: string, text: string): void {
    const p = this.path(name);
    const tmp = `${p}.tmp-${process.pid}`;
    writeFileSync(tmp, text);
    renameSync(tmp, p);
  }
  writeJson(name: string, value: unknown): void {
    this.writeText(name, `${JSON.stringify(value, null, 2)}\n`);
  }
  writeBytes(name: string, bytes: Uint8Array): void {
    const p = this.path(name);
    const tmp = `${p}.tmp-${process.pid}`;
    writeFileSync(tmp, bytes);
    renameSync(tmp, p);
  }
  hash(name: string): string {
    return sha256(readFileSync(this.path(name)));
  }
}
