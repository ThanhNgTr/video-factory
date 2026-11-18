# Video Factory

Viral link → formula → English script → 3D block characters → voiced, captioned MP4. Plan: `docs/roadmap.md`. Words: `docs/glossary.md`. Decisions: `docs/adr/`.

**Easiest:** `pnpm vf studio`, then open http://localhost:5170. Create episodes, review and edit scripts, watch progress, download videos, and paste a viral link to get a similar video ("Làm video tương tự") in the browser (ADR 0014, 0017). Everything below is the same work from the terminal.

```bash
corepack pnpm install
./tools/make-audio-library.sh  # starter music + SFX (generated, not in git)
cp .env.example .env            # VF_LLM=claude-cli needs the Claude Code CLI logged in; VF_LLM=anthropic needs ANTHROPIC_API_KEY
pnpm vf like <link> [--idea "..."]   # a sample in, a similar video out: learn its formula + format, then make one (ADR 0017)
pnpm vf ingest --url <link>     # learn a formula and a format into library/formulas + library/formats
pnpm vf make --format explainer --idea "..."   # a narrated knowledge short over motion graphics
pnpm vf make --series night-desk --idea "..."   # next part of a series → out/<run>.mp4
pnpm vf make --format skit
pnpm vf preview old-manager --face shock   # character sheet png (--action hold-up --holds card, --drip up)
pnpm vf revise <run> --note "..." # rewrite a run's script from your note, then remake the video
pnpm vf runs · pnpm vf show <run> · pnpm vf resume <run> · pnpm vf run <stage> --run <run>
VF_REVIEWERS=claude,codex pnpm vf make ...       # Codex also reviews the finished frames (needs `codex login`)
VF_LLM=fake pnpm vf make --format skit           # render the fixture without paying
pnpm check                       # typecheck, biome, dependency-cruiser, vitest
```

Edit a story: change `runs/<run>/script.json`, then `pnpm vf resume <run>`; only the affected stages re-run.

Layout: `packages/` (contracts, core, pipeline) · `modules/` (script, assets, audio, video; each with `domain/ ports.ts adapters/ stages/`) · `apps/cli` (composition root: `wiring.ts`) · `library/` (data) · `tools/` (python helpers, migration, and dev tools: `stills.ts` renders frames of a run with the current code, `sheets.sh` tiles a video into labelled contact sheets, `review-frames.ts` has Claude and Codex list visual defects on those sheets) · `evals/fixtures` (fake LLM answers).
