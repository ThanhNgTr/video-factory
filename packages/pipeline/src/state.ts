// Run state in SQLite (node:sqlite, no native dependency): runs, stages, costs (roadmap §4.6).
import { DatabaseSync } from "node:sqlite";

export type StageRow = {
  run_id: string;
  stage: string;
  version: number;
  cache_key: string;
  status: string;
  ms: number;
  error: string | null;
  at: string;
};

export class RunState {
  private readonly db: DatabaseSync;
  constructor(file: string) {
    this.db = new DatabaseSync(file);
    // several runs (a render and a new script) may share this file: wait for a lock instead of failing at once
    this.db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 10000;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, params TEXT NOT NULL, seed TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS stages (run_id TEXT NOT NULL, stage TEXT NOT NULL, version INTEGER NOT NULL, cache_key TEXT NOT NULL, status TEXT NOT NULL, ms INTEGER NOT NULL, error TEXT, at TEXT NOT NULL, PRIMARY KEY (run_id, stage));
      CREATE TABLE IF NOT EXISTS costs (run_id TEXT NOT NULL, stage TEXT NOT NULL, provider TEXT NOT NULL, model TEXT NOT NULL, input_tokens INTEGER NOT NULL, output_tokens INTEGER NOT NULL, cost_usd REAL NOT NULL, ms INTEGER NOT NULL, at TEXT NOT NULL);
    `);
  }
  upsertRun(id: string, params: Record<string, string>, seed: string, status: string): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO runs (id, params, seed, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at`,
      )
      .run(id, JSON.stringify(params), seed, status, now, now);
  }
  getRun(id: string): { id: string; params: Record<string, string>; seed: string; status: string } | undefined {
    const r = this.db.prepare("SELECT id, params, seed, status FROM runs WHERE id = ?").get(id) as
      | { id: string; params: string; seed: string; status: string }
      | undefined;
    return r && { ...r, params: JSON.parse(r.params) as Record<string, string> };
  }
  listRuns(): { id: string; status: string; created_at: string; cost: number }[] {
    return this.db
      .prepare(
        `SELECT r.id, r.status, r.created_at, COALESCE((SELECT SUM(cost_usd) FROM costs c WHERE c.run_id = r.id), 0) AS cost
         FROM runs r ORDER BY r.created_at DESC`,
      )
      .all() as { id: string; status: string; created_at: string; cost: number }[];
  }
  stageRow(runId: string, stage: string): StageRow | undefined {
    return this.db.prepare("SELECT * FROM stages WHERE run_id = ? AND stage = ?").get(runId, stage) as
      | StageRow
      | undefined;
  }
  listStages(runId: string): StageRow[] {
    return this.db.prepare("SELECT * FROM stages WHERE run_id = ? ORDER BY at").all(runId) as StageRow[];
  }
  setStage(row: Omit<StageRow, "at">): void {
    this.db
      .prepare(
        `INSERT INTO stages (run_id, stage, version, cache_key, status, ms, error, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(run_id, stage) DO UPDATE SET version = excluded.version, cache_key = excluded.cache_key, status = excluded.status, ms = excluded.ms, error = excluded.error, at = excluded.at`,
      )
      .run(row.run_id, row.stage, row.version, row.cache_key, row.status, row.ms, row.error, new Date().toISOString());
  }
  addCost(c: {
    runId: string;
    stage: string;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    ms: number;
  }): void {
    this.db
      .prepare(
        "INSERT INTO costs (run_id, stage, provider, model, input_tokens, output_tokens, cost_usd, ms, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        c.runId,
        c.stage,
        c.provider,
        c.model,
        c.inputTokens,
        c.outputTokens,
        c.costUsd,
        c.ms,
        new Date().toISOString(),
      );
  }
  // total spend of a run, or only of the cost rows after a mark (one invocation; rowids never tie like times can)
  runCost(runId: string, afterMark = 0): number {
    const r = this.db
      .prepare("SELECT COALESCE(SUM(cost_usd), 0) AS c FROM costs WHERE run_id = ? AND rowid > ?")
      .get(runId, afterMark) as { c: number };
    return r.c;
  }
  costMark(): number {
    return (this.db.prepare("SELECT COALESCE(MAX(rowid), 0) AS m FROM costs").get() as { m: number }).m;
  }
  listCosts(runId: string): { stage: string; provider: string; model: string; cost_usd: number; ms: number }[] {
    return this.db
      .prepare("SELECT stage, provider, model, cost_usd, ms FROM costs WHERE run_id = ? ORDER BY at")
      .all(runId) as {
      stage: string;
      provider: string;
      model: string;
      cost_usd: number;
      ms: number;
    }[];
  }
  close(): void {
    this.db.close();
  }
}
