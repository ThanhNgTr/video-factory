# ADR 0023: Premises before the script; the studio remembers what it made

Date: 2026-11-17 · Status: accepted

## Context
The writer wrote one draft straight from the format rules and the formula, and the critic judged it against a compliance checklist (hook, one idea, open loop...). Drafts passed at 7.5 and were correct but flat and alike: the first idea that fits, the same library character in the same kind of place, a hook the viewer can finish themselves. The only memory of past videos was a list of series part titles. The producer's review named it: scripts are dull and boxed in, videos repeat each other.

## Decision
- **Pitch, then write.** `script.write` first asks for five premises from five set angles (character comedy, viewer as protagonist, absurd escalation, mystery or reversal, surprising specific), each with a hook line, a protagonist, a place, a visual spine (the one picture that changes shot by shot), a twist and three scores (scroll-stop, visual, fresh), and a pick with a reason (`prompts/premise.md`). The writer then writes the picked premise and records it in `Script.premise`. One extra LLM call per fresh script; a human-edited script or a producer's rewrite note skips it.
- **The studio remembers.** When a run finishes, `vf make` keeps `{title, premise, cast}` in `library/premises/<runId>.json` (`Library.premises`). The pitch, the writer and the critic all get the list as MADE BEFORE and must take another angle, protagonist and place.
- **The critic judges freshness and the first two seconds.** New universal criterion `fresh` (not a repeat of MADE BEFORE, a turn the hook does not give away); the score now says a competent, predictable script is a 6 and 8+ needs something the viewer has not seen. `review.md` v3.

## Consequences
- Each fresh script costs one more call (about 30-60 s). The pick is the writer model's own judgement, not a separate critic's; a separate picker is a later step if pitches prove better than picks.
- The memory is append-only JSON in the library, like icons and designs; it grows one small file per video and is read whole into three prompts, so at a few hundred videos it will need a cap (most recent N, or an embedding filter: roadmap GĐ 5 duplicate filter).
- `vf eval` (roadmap GĐ 3) should measure whether picked premises score higher with the critic than first drafts did.

## Correction (same day)
The first version pitched five genre angles for every script and scored "fresh" against the obvious take on the topic, so a remake of one sample came out as a blend of five genres and every earlier video. The producer rejected that: one sample in, one similar video out. Since `premise.md` v3 / `review.md` v4, with a formula given the five premises keep the sample's genre, tone, point of view and mechanics and vary only the story that fills them; MADE BEFORE only stops the studio repeating its own earlier stories.
