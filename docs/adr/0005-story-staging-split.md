# ADR 0005: `script.json` (story) is separate from `scene.json` (staging)

Date: 2026-11-16 · Status: accepted

## Context
The demo had Claude write staging and story in one JSON; humans could not edit it safely and characters were placed with raw x coordinates.

## Decision
`script.write` produces `script.json` (beats, lines, cards, HUD values, choice). `script.direct` produces `scene.json` (shots on named spots, actions, camera, lighting, cues). `checkSceneMatchesScript` enforces that the shots' lines are exactly the script's lines in order, and `checkSceneRefs` that every id and spot exists. Both checks drive the LLM repair loop (max 2 repairs). `script.write` never overwrites an existing `script.json`, so a human edit survives `vf resume`.

## Consequences
- Humans edit prose, never coordinates. A changed line re-runs direct → tts (one line) → timeline → mix → render.
- Two LLM calls per episode instead of one (budgeted in roadmap §10).
