# ADR 0003: run state in SQLite via `node:sqlite`; artifacts as files

Date: 2026-11-16 · Status: accepted

## Context
Roadmap §4.6 asks for `runs`, `stages`, `costs` tables and resume-from-failure, with one machine and one process.

## Decision
`RunState` uses Node 24's built-in `node:sqlite` (no native dependency, no server). Artifacts stay files under `runs/<runId>/`, written atomically (temp + rename) by `ArtifactStore`. Cache key = `hash(stage, version, input hashes, params, seed)`; a stage is skipped when its key matches and its outputs exist. `audio.mix` writes `mix.json` instead of rewriting `audio.json` so downstream hashes stay stable.

## Consequences
- `vf resume` and a human edit of `script.json` need no special code: the hash changes, later stages re-run.
- Multi-machine workers (GĐ 6) will need Postgres/pg-boss; nothing in the stage API changes.
