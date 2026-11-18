# ADR 0014: Studio, a local web front served by the CLI

Date: 2026-11-17 · Status: accepted

## Context
Every operation was a `vf` command in a terminal. The producer is not a programmer and asked for a simple, convenient interface. The roadmap had deferred a dashboard ("dashboard đẹp" in the do-not-do list, `vf runs`/`vf show` instead); the producer's request overrides that. The factory's rule still holds: a human only adds ideas and edits `script.json`; every other step is automatic.

## Decision
- `vf studio [--port 5170]` starts a web server inside `apps/cli` (the composition root, so it reuses `wire()`, the library and the run state; no new app or package). It listens on 127.0.0.1 only and rejects cross-origin POSTs.
- Pages are HTML rendered on the server (`studio/pages.ts`): no bundler, no build step, Node's strip-only TypeScript serves them as they are, and every page works before its small script loads. `studio/static/studio.css` is the single token layer (colour, type, space, motion on `:root`), mobile first; `studio.js` adds live progress polling, the script length meter, series-dependent fields and a double-submit guard.
- Screens follow the producer's jobs only: episodes (the one that needs them leads), new episode (series, optional idea, last vote, stop for script review), one episode (player, status with the one next action, steps, render % and time left), script editor (beats with on-screen text and lines, a sticky length meter against the format's budget, save or save and render), learn from a viral link.
- Saving a script parses it with the `Script` contract and `checkScriptRefs`, maps zod issue paths to the editor's fields with Vietnamese explanations, and writes `script.json` atomically through `ArtifactStore`; nothing is saved when anything is invalid.
- Work runs through `studio/jobs.ts`: one job at a time (a render takes the whole CPU), each in a child process running the same `vf` CLI (`make --until audio.mix`, `resume`, `ingest`), so a crash in a job never stops the studio. Its log goes to `runs/<runId>.log` and is read for the current stage and the render progress.
- UI copy is Vietnamese, the operator's language. Everything that ends up in a video stays English, and the editor says so.

## Consequences
- Jobs are children of the studio process: stopping the studio stops them, and a stopped run reads as "stopped" with a Continue button (`vf resume` underneath). A run started from a terminal also reads as stopped until it finishes (no cross-process liveness check yet).
- No accounts or remote access: the studio is for the machine it runs on. Exposing it on a network needs authentication first.
- Tested: the view model (phases, steps, form-to-script mapping, messages), the job queue with a fake CLI, and every page against the design gates (no overflow 280-951 px at 125 % text, WCAG AA in default/hover/focus, no generated-UI tells, no emoji).

## Design review (same day)
An adversarial design review sent the first version back. Changed:
- The screen never says something false: a series with a part in progress is a link to that part, not a choice whose idea and vote would be dropped; a finished learn job reads "learned", not "waiting for script review" (`phaseOf(..., ingest)`); the audience vote has no default and the server refuses a missing one.
- One thing leads on phones too: without a video the run page shows the status and its action first, the hook line after; the 9:16 frame appears only with a video. On the home page the episode that needs the producer has the largest type.
- Colour: "done" is neutral, amber means "needs you", red means live work; failures are a filled alert with one Vietnamese sentence (`explainError`) and the raw text under "technical details".
- Script editor: the episode title is the heading, spoken lines are larger than the stage direction, each line shows a live caption preview (marked words in the video's yellow), and a beat index jumps to any beat.
- Durations floor like the player; the header is sticky only from 768 px; the developer footer is gone.
Not done: a shipped display font, a poster grid for finished episodes on wide screens, Vietnamese summaries of learned formulas (they are English, written by the LLM).
