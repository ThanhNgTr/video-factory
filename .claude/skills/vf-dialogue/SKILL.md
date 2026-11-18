---
name: vf-dialogue
description: Dialogue and narration rules for Video Factory - speakable lines, distinct character voices, subtext, punch words, *stress* markers, line length and shot timing, edge-tts pronunciation and voices, caption chunks. Use when changing how lines are written (prompts write.md, revise.md, review.md, format rules), spoken (modules/audio normalizeSpeech, EdgeTts, Person.voice) or captioned (captionChunks, Overlay), or when a line sounds or reads wrong in a finished video.
---

# Lines in Video Factory

A line travels: `Line {who, text}` in `script.json` → `audio.tts` (`normalizeSpeech` → edge-tts → inner pauses cut to 0.4 s, ADR 0016) → word timings → captions (at most 3 words a chunk, `*stressed*` words highlighted, words not yet spoken grey), visemes from the letters, and a 14-frame gesture on each stressed word (ADR 0013). Write for the ear first, the eye second, the animator third.

## Craft rules

1. **Speakable as written.** No stage directions, parentheses, "he says", action descriptions or emoji inside a line (`speakable` criterion). Every character is read aloud by a TTS voice.
2. **One thought per line.** One shot carries one line, and a shot lasts about 0.6 s plus 1 s per 14 characters (a 50-character line is 4.2 s). Skit lines stay under about 80 characters.
3. **Punch word last.** The reveal, the name, the joke lands at the end of the sentence. Captions show three words at a time, so a punch in the middle appears early. A lone punch word after a full stop stays its own caption beat ("first shift. | Again.").
4. **Stress 1-3 words with `*asterisks*`.** They are highlighted and trigger a gesture. Stress the surprising word, not the obvious one; stressing everything flattens both.
5. **Subtext over statement.** Characters rarely say what they feel ("I'm scared"); they deflect, joke, ask, change the subject. The narrator gives what the picture cannot (time, rules, numbers) and never describes what the viewer already sees.
6. **Each character sounds like their `personality`** (`library/people/*.json`): word choice, length, rhythm. A calm one speaks little and precisely; a bluffer over-explains; a child asks. Swap two speakers' names: if nothing feels wrong, the voices are not written yet.
7. **Every line does a job:** it attacks, defends, reveals, hides or breaks something, often two at once. Give each speaker a want in the scene they would never say out loud; the lines circle it.
8. **Exchanges trade lines, but not like a metronome.** Speakers alternate, which gives the director shot and reverse, yet lines of equal length in strict turns sound written: let one push, one cut in, one go quiet. More than two lines from one speaker in a row needs a reaction or cutaway (the director cuts away at least every 8 s of talk).
9. **Fragments are beats, not savings.** "Silence.", "No *Ava*." at most three per script (`write.md`).
10. **Second person, present tense** for POV and rules formats: "You hear the bell. You don't turn around."
11. **Numbers are said the way they are written** and must match the graphic exactly; check how `normalizeSpeech` reads digits and times (`numberWords`, `timeWords`).
12. US English, plain ASCII, contractions welcome.

## When it sounds wrong

- **Mispronounced word** (a name, slang: "hon" was read "Han"): add a rule to `normalizeSpeech` in `modules/audio/src/domain/normalize.ts` with a case in `modules/audio/test/normalize.test.ts`, and bump `audio.tts`'s version. Never misspell the script to fix the voice: captions show the script text.
- **Homographs and acronyms** (read, live, lead, wind; NASA vs N-A-S-A): rephrase, or normalize.
- **Voices** (`Person.voice`: `id` en-US only, `pitch` like "-8Hz", `rate` like "-5%"): the allowed ids are `VOICES` in `modules/assets/src/stages/design.stage.ts` (AnaNeural is a child). Lower pitch reads older, bigger or menacing. Two characters in one scene need clearly different voices: another voice id, or pitch and rate far enough apart to tell with eyes closed. The narrator is `Script.narratorVoice` or the series bible's `narratorVoice`.
- **A caption flashes or pre-reveals:** the rules are `captionChunks` in `modules/video/src/domain/timeline.ts` (tested in `modules/video/test/timeline.test.ts`), not the script.
- Listen to the run's voiced audio and read the captions on a contact sheet (`tools/sheets.sh`) before judging.

## Where to change

- Rules for every short: `write.md` and `revise.md` together, plus a criterion in `review.md`. Genre rules: the format's `rules` and `rubric` (the skit format's `natural-lines`).
- Bump the prompt version and compare before and after as in `vf-story` ("Changing a prompt").
