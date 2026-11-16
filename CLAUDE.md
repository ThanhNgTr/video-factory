# Video Factory

A near fully automated factory for vertical short videos: viral formula → English script → 3D low-poly block characters → voiced, captioned MP4. The plan, phases, architecture and conventions are in `docs/roadmap.md` (Vietnamese). Read the section for the phase you are working on before starting a task.

Current phase: **GĐ 1–3 scaffolded (16/11/2026)**: monorepo, contracts, core, pipeline, four modules and the `vf` CLI exist and produce an MP4 end to end. Still open from GĐ 0: spikes S1 (GPU render), S2 (paid TTS), S5 (platform API approval). `grep -rn "shortcut:" packages modules apps` lists the known interim choices.

Run things with `corepack pnpm` (`pnpm vf make ...`, `pnpm check`). Node runs TypeScript in strip-only mode: no enums, no `constructor(private x)` parameter properties, explicit `.ts` import extensions.

## Hard rules

- **English only (US English)** for everything in a video: narration, dialogue, on-screen text, captions, titles, descriptions, hashtags. Code, identifiers, comments and commits are English too. Docs in `docs/` may be Vietnamese.
- No AI video models. A video is data (JSON) rendered by our own code.
- Humans only add ideas and edit `script.json`. Never design a production step that needs a human (no per-video approval, no designer).
- Learn mechanics from viral videos; never copy the source's story, characters, setting, names or dialogue.
- `legacy/` is read-only reference from the demo. Migrate from it with a script; never import from it.

## Architecture (roadmap §4)

- Modular monolith: `packages/` (contracts, core, pipeline), `modules/` (script, assets, audio, video), `services/publish`, `apps/` (cli, worker, studio).
- Modules talk only through artifacts defined in `packages/contracts`. No module imports another, except `video` → `assets/render`. Import a package only through its `index.ts`.
- Inside a module: `domain/` is pure (no I/O, no SDK, no `process.env`, no `Date.now()`, no `Math.random()`); `ports.ts` holds types only; `adapters/` implement ports; `stages/` are pipeline steps and receive adapters through `ctx`.
- Adapters are wired only in `apps/*/src/wiring.ts`. No DI container.
- Parse with zod at every trust boundary (LLM output, library JSON, human-edited `script.json`, API responses, config); trust the types inside.
- Artifacts are immutable and written atomically (temp file + rename). Stages know artifact names, not paths.
- Errors: `StageError { code, retryable, details }`. Transient → the adapter retries with backoff; bad data → self-repair at most 2 times; broken invariant → crash. No empty `catch`.
- Render code is a pure function of `(props, frame)`: no `Math.random`, `Date.now`, cross-frame state or fetch. Use Remotion's `random(seed)`.
- Only `core/config` reads `process.env`. Never log secrets.
- LLM calls always use structured output with a schema. Prompts live in `modules/*/prompts/*.md` with a version; changing a prompt or model means running `vf eval`.

## Conventions (roadmap §6)

- TypeScript `strict` + `noUncheckedIndexedAccess`; no `any`; types come from `z.infer`.
- Biome for lint and format; dependency-cruiser enforces the import rules in CI.
- Use the terms in `docs/glossary.md` (created in GĐ 1): Formula, Beat, Script, Scene, Shot, Spot, Cue, Run, Stage, Artifact, Port, Adapter.
- Bump a stage's `version` when its logic changes; bump `schemaVersion` and add a migration when a contract changes.
- A shortcut with a known limit gets `// shortcut: <limit>, <when to upgrade>`.
- Tests: Vitest. Domain logic has unit tests; every bug fix gets a test; pipeline tests use `FakeLlm`/`FakeTts`, so CI never makes paid calls.

## Done means

CI green · tests per roadmap §6.6 · the module README is updated if its inputs, outputs or usage changed · an ADR in `docs/adr/` for every architecture decision.
