---
name: vf-story
description: Story and screenwriting rules for Video Factory - formulas, premises, beats, hooks, open loops, escalation, twists, payoffs, series continuity, the length budget. Use when changing what the premise picker, writer or critic do (modules/script/prompts/premise.md, write.md, review.md, revise.md, formula.md, format.md), a format's rules or rubric (library/formats), a series bible, or when diagnosing why a script is flat, long or predictable.
---

# Story in Video Factory

The writer is an LLM. You never write the stories; you shape them through prompts, format data and checks. A script is made by `script.write`: pitch 5 premises and pick one (`premise.md`, ADR 0023) → write (`write.md`) → critic (`review.md` + the format's `rubric`) → at most 2 rewrites (`revise.md`), best draft kept (ADR 0015). `script.json` is the only artifact a human edits.

## Where each lever lives

| Lever | File |
| --- | --- |
| Mechanics learned from a sample (beats by second, roles, whyViral, cast as functions) | `prompts/formula.md` → `library/formulas/<id>.json` |
| Genre: length, beats, speech budget, writing rules, rubric, staging | `prompts/format.md` (learned) or a hand-written `library/formats/<id>.json` |
| Angle, protagonist, place, visual spine, twist, freshness | `prompts/premise.md`, memory in `library/premises/` |
| Beats, cast presence, lines | `prompts/write.md` (and `revise.md`, which must keep the same rules) |
| Judging | `prompts/review.md` (shared criteria) + `Format.rubric` (`must` decides pass) |
| Hard limits the repair loop fixes | `checkScriptRefs` in `packages/contracts/src/refs.ts` |
| Series continuity | `library/series/<id>.json` (bible), `script.bible`, `bibleBefore` |

Put a rule where it belongs: genre-specific → that format's `rules`/`rubric` (data, no code). Shared by every short → `write.md` plus a criterion in `review.md`. Checkable by code → `checkScriptRefs`; a check that sends the draft back beats a prompt paragraph the model may skip.

## What a good script does here

1. **Hook in 2 seconds, picture plus line.** Beat 1 has the on-screen card (skit: 7 words or fewer, always under 60 chars) and the strongest image already up. No greeting, no context: start as late in the action as the story allows. Strong openers: conflict or danger already happening, a rule being broken, an impossible number, second person ("You have one night..."), the ending shown first.
2. **One idea, one visual spine.** The spine is the one object or picture that changes shot after shot (a box sinking, a bill growing, a door never where it was). Sound off, the spine still tells the story. A premise without a nameable spine is not ready.
3. **Open a loop early, close it last.** Plant every payoff: the rule card in beat 2 is tested in beat 6; the object shown early matters at the end. The payoff introduces nothing new.
4. **Escalate in countable steps.** Each beat raises stakes, size or weirdness. Rule of three: set up, confirm, break. Every beat changes something visible (`visual` criterion); a beat where only the narration changes is dead air.
5. **Twist in the last third, surprising but fair:** it reinterprets something already on screen, and the hook does not give it away (`fresh`).
6. **End on the payoff, then loop or vote.** The last image echoes the first so the rewatch seams, or a two-way `choice` asks for the next part.
7. **Engines by genre.** Comedy: a flaw the camera can see (greedy, cowardly, too literal) drives the action, bystanders react; the gap does the joke (huge effort for a tiny stake, precision aimed at the wrong target, a perfect job nobody needed), and the joke is never explained afterwards. Horror: a rule, a wrong detail, the cost of breaking it. Explainer: a surprising number climbed through landmarks, every value correct (`accurate` is a must).
8. **Write to the stage.** Only what the renderer can show (`write.md`, "What the stage can show"): standing, walking, sitting, lying, library actions, held items, story props with motions, weather, light, cards, graphics. Splashing liquid or hands handling objects become a prop motion or a cut to the result.
9. **Presence is continuous** (ADR 0012): `Beat.cast` is everyone in the place, bystanders included; nobody appears or vanishes without a beat that shows it.
10. **Remake = same mechanics, new story.** Never the sample's names, setting, lines or characters (CLAUDE.md). A formula's `cast` lists roles by function, never looks. With a formula given, all five premises keep its genre, tone and point of view (ADR 0023 correction).

## Length budget

- Hand-written formats: the narrator runs about 10 characters a second plus about 7 s of pauses and cards (ADR 0016). Learned formats: `maxSpokenChars = 13 x (lengthS.max - 7)` (`format.md`).
- `checkScriptRefs` also asks for a minimum, `maxSpokenChars x (min - 7) / (max - 7)`; QA accepts a video up to 10% under the format's minimum, never over its maximum.
- Over budget: cut lines, not beats. Fragments ("Silence.") stay at three or fewer.

## Changing a prompt

- Bump `<!-- version: N -->` on the prompt's first line.
- `vf eval` is planned (roadmap GĐ 3) but not built. Until it is, compare before and after on 2-3 fixed ideas per affected format: `pnpm vf make --format <id> --idea "..." --until script.write`, then read `runs/<run>/script.json` and `script-review.json` (score, failed criteria, fixes). These are paid LLM calls: ask before running more than a few. Say in the commit what you compared.
- Tests never call an LLM: `FakeLlm` answers come from `evals/fixtures/*.json`; update the fixture when the expected shape changes.

## Diagnose a flat script

| Symptom | Look at |
| --- | --- |
| Score about 6, "predictable" | The premise pick (spine, hook line, twist), not the lines |
| `visual` fails | Beat `action`s describe feelings or restate narration; rewrite them as objects and people changing |
| Middle sags | A missing escalation step; count beats per `role` against the formula |
| Twist feels cheap | No plant: add the setup beat it reinterprets |
| Same face and place again | MADE BEFORE (`library/premises/`) not reaching the prompt, or the pick ignoring it |
| Over length after voicing | Speech rate changed: re-check ADR 0016's numbers before blaming the writer |

See also `vf-dialogue` for the lines themselves and `short-form-video` for hook, retention and loop grammar.
