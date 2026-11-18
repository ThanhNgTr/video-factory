---
name: vf-characters
description: Character design for Video Factory - Person parameters, silhouette and shape language, one strong colour per cast member, faces and expressions, age and gender read, voice, personality, acting with library actions. Use when designing or editing library/people/*.json, the character designer and its gate (modules/assets/prompts/person.md, design-gate.md, assets.design), adding a Person parameter to the contract or Character2D, or when a character reads wrong in a video.
---

# Characters in Video Factory

A character is data: `Person` in `packages/contracts/src/library.ts`, drawn by `modules/assets/src/render/Character2D.tsx` as a flat 2D card with dark outlines inside the 3D set (ADR 0010), with faces measured from the reference reels (ADR 0009). When a script needs someone the library lacks, the writer describes them in `Script.newCast` (at most 3) and `assets.design` picks the parameters (`person.md`), renders a character sheet, and a gate (`design-gate.md`) scores it; below 7 the designer fixes its own design, at most 3 rounds. Designed people join `library/people` when the run ends (ADR 0018).

## Design rules

1. **Three reads, in order: silhouette, colour, detail.** The cast must be tellable apart as black shapes. Vary at least two of: `build.height` (0.7 child, 1 adult, 1.15 big adult, 1.35+ uncanny), `width`, `head`, `build.shape`, `hair.style`. Two leads with the same height and hair is a defect. A detail that helps neither the silhouette nor the colour read goes.
2. **Shape language from the role.** round/soft: friendly, harmless, comic. square: stubborn, strong, authority. lean or tall: nervous, sly, menacing. A big head (1.2+) reads young or cute. Mixing shapes makes a character: a round body with a square head or a cap reads gruff but lovable; one feature that breaks the type adds trouble (a round grandma with bushy brows).
3. **One strong colour per person** on the top (ADR 0013 gave the cast mint, mustard, pale yellow, deep purple); pants and accent support it. Keep cast hues far apart, leads more saturated than bystanders, and never the set's wall colour on a lead (`vf-sets`).
4. **The face carries the emotion.** Eyes and brows do the work. Leads get an `iris`; `lashes` for women and girls; `blush` for children or cheerful people; `glow`, `none` eyes and `grin` only for monsters. Per shot the director picks one of the nine `FACES` (neutral, happy, sad, angry, shock, sleepy, smug, cry, love).
5. **Age, gender and attitude read in one second** from hair, build, height and outfit; a dress reads as a woman better than anything else; grey or white hair gives heavy lids automatically.
6. **Two signature features at most**, from what the renderer draws (`wear`, at most 4: top-hat, cap, scarf, tie, apron, badge, raincoat-hood, gloves, name-tag, long-fingers; `outfit.pattern`; `glasses`; `mustache`). What it cannot draw (braids, a cardigan, earrings) maps to the nearest part as `person.md` says; the gate judges whether the role reads, not missing details (`limits` in `design.stage.ts`).
7. **Personality is a visible habit plus a way of talking** (under 200 characters): "fidgets, checks the clock, answers questions with questions". The director picks actions from it and `vf-dialogue` writes lines from it.
8. **The voice matches the body:** big or old → lower pitch; a child → `en-US-AnaNeural`; nervous → a slightly faster rate.
9. **Acting is library actions** (`library/actions`, posture stand/sit/lie; how keys move is `vf-motion`). Give each character a reaction of their own; the director already caps one reaction action at two per video.

## Changing the character system

- A new parameter is an optional field in `Person` (additive: every existing file must still parse, `schemaVersion` stays 1). Draw it in `Character2D.tsx` as a pure function of props and frame, add it to `person.md` (bump its version) and to the gate's `limits`, mention it in `describePerson` (`modules/script/src/domain/describe.ts`) if the writer or director should know it, test it in `modules/assets/test/character2d.test.ts`, and bump `video.render`'s version so runs re-render.
- Current limits: no true profile (3/4 view at most), legs bend at the knee only in actions that set `kneeL`/`kneeR`, one held item in the right hand, at most 4 people in a shot.
- A library edit reaches existing runs on their next resume: `assets.check` fingerprints people, actions and sets (ADR 0016).

## Check, do not guess

- `pnpm vf preview <id> [--face shock] [--action hold-up --holds card]` writes a character sheet: front, turned both ways, back and a head close-up. Look at the PNG before saying a character looks right.
- Preview the whole cast of a video and compare the sheets side by side: silhouettes, colours, heights.
- In a finished video: a contact sheet (`tools/sheets.sh`) and `frame-review.json` from `video.review`.
