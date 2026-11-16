# Video Factory

Viral link → formula → English script → 3D block characters → voiced, captioned MP4. Plan: `docs/roadmap.md`. Words: `docs/glossary.md`. Decisions: `docs/adr/`.

```bash
corepack pnpm install
./tools/make-audio-library.sh  # starter music + SFX (generated, not in git)
cp .env.example .env            # VF_LLM=claude-cli needs the Claude Code CLI logged in; VF_LLM=anthropic needs ANTHROPIC_API_KEY
pnpm vf ingest --url <link>     # learn a formula into library/formulas
pnpm vf make --series night-desk --idea "..."   # next part of a series → out/<run>.mp4
pnpm vf make --format skit
pnpm vf preview old-manager --face shock   # character sheet png (--action hold-up --holds card, --drip up)
pnpm vf runs · pnpm vf show <run> · pnpm vf resume <run> · pnpm vf run <stage> --run <run>
VF_LLM=fake pnpm vf make --format skit           # render the fixture without paying
pnpm check                       # typecheck, biome, dependency-cruiser, vitest
```

Edit a story: change `runs/<run>/script.json`, then `pnpm vf resume <run>`; only the affected stages re-run.

Layout: `packages/` (contracts, core, pipeline) · `modules/` (script, assets, audio, video; each with `domain/ ports.ts adapters/ stages/`) · `apps/cli` (composition root: `wiring.ts`) · `library/` (data) · `tools/` (python helpers, migration) · `evals/fixtures` (fake LLM answers).
