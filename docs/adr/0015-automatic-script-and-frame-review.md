# ADR 0015: The machine reviews its own scripts and frames; the producer steers with a note

Date: 2026-11-17 · Status: accepted

## Context
The factory makes many kinds of shorts (stories, comedy, explainers, ...) and must not need a human per video (CLAUDE.md). Yet episode 1 needed a human eye three times: a stage direction inside a spoken line, a script over the length budget, characters cut by the frame. The first Studio also stopped every new episode for a human script review by default, which broke the no-per-video-approval rule.

## Decision
- **Script critic inside `script.write`.** After writing, an LLM critic (`modules/script/prompts/review.md`, model `models.review`, default opus) judges the script against nine criteria every short shares (hook, one idea, open loop, no dead air, escalation, payoff, speakable lines, clear with sound off, original) plus the format's own `rubric`, which is data in `library/formats/*.json`. A new genre brings its rubric; no code changes. The critic must judge every criterion or its answer is repaired.
- A script passes at score 7 or more with every `must` criterion passing. Otherwise the writer rewrites it from the critic's fixes (`prompts/revise.md`) at most twice; the best draft is kept (passing beats failing, then score). The verdict goes to `script-review.json`. It never blocks the episode.
- **The producer steers with a note, not a per-line edit.** `vf revise <run> --note "..."` (Studio: "Viết lại và làm lại video") rewrites the whole script from the note, keeping what works, then the critic loop runs and every later stage is remade. A whole-script rewrite keeps setups and payoffs consistent; an edit to one section often breaks a later one. A human-edited `script.json` is judged but never rewritten without a note. The line-by-line editor stays as an advanced tool.
- A rewrite keeps its own part number, and its series context holds only earlier parts (`bibleBefore`): the critic's first real run caught part 1 being judged as a repeated part 2 after the bible had recorded it.
- **Frame review after every render.** `video.review` takes one labelled frame per shot, tiles them 3x3 and asks every configured reviewer (`VF_REVIEWERS`, Claude by default, Codex optional) for visible defects. It writes `frame-review.json` and never fails the run; the Studio shows the findings.
- **The Studio runs straight through by default.** "Stop for my script review" moved under advanced options, off by default. The producer's jobs are: an idea, the audience vote, watching the video, and a note when it is not right.

## Consequences
- Each episode costs one to three more LLM calls for the script and one per frame reviewer (about 30 s for Claude, 3-4 minutes for Codex), all on subscriptions today.
- The critic is an LLM: it can be wrong both ways. It is a signal plus an automatic second draft, not a guarantee; `vf eval` (roadmap GD 3) should measure it on known good and bad scripts.
- Frame defects are reported, not fixed: most come from renderer code (camera framing), which a re-staging would not change. Feeding them back to the director automatically is a later step.
- Formats still carry genre-specific staging (horror lighting, sets). Knowledge and explainer formats will need their own visual building blocks (diagrams, text-led layouts), not only a rubric.
