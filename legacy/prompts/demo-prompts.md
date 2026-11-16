# Demo prompts (reference only)

Verbatim prompt text from the feasibility demo (`~/Project/my-idea/video-factory`, branch `demo-3d`, commit `f79948d`), taken from `modules/script/write.ts` and `modules/script/ingest.ts`. Template variables are shown as `{{name}}`.

These are the starting point for the new `modules/script/prompts/*.md` (roadmap §6.4). Known problems to fix in the rebuild:
- One prompt writes story AND staging at once → split into `script.write` and `script.direct`.
- Characters are placed with raw `x` coordinates → use named `spots` from the set.
- The JSON Schema is pasted into the prompt and the answer is parsed with a regex → use structured output.
- Language was a parameter → the rebuild is English only; drop the language variable.

---

## 1. Scene writer: shared frame (`writeScene`)

```
Write the scene for ONE vertical video (TikTok/Shorts/Reels) acted by geometric shape characters.

{{if formula}}VIRAL FORMULA to follow (reuse its STRUCTURE, pacing and mechanics only — never copy its story, dialogue, characters, names or setting):
{{formula as JSON}}
{{else}}No formula given: use a proven short-form structure.

{{if idea}}IDEA from the human (top priority):
{{idea}}
{{else}}No idea given: invent a fresh, original situation that fits the formula.

{{if lessons}}LESSONS learned from past results (follow them):
{{lessons.md}}

LIBRARY you can use:
- characters: {{people, each as a one-line description}}
- actions: {{id (dur s[, loop]), ...}}
- backgrounds: {{set ids}}
- faces: {{face ids}}
- camera: none, zoom (punch-in on "focus"), shake, zoom-shake, pan, closeup (tight on "focus" face), push (slow push-in)

RULES
{{SERIES_RULES or SKIT_RULES}}
- Prefer library characters; create at most 2 "newCharacters" only if the story truly needs a type the library lacks (voice.id one of: {{voices}}; pitch like "+20Hz", rate like "+5%"). A new character must look clearly different from everyone in the same video: different body shape AND a far-apart color.
- Positions: x in 0..1; keep characters ≥0.3 apart (e.g. 0.28 and 0.72). Use "toX" with walk/run actions to cross the frame; set flip=true when a character should face left.
- No emoji anywhere (the video font can't draw them).
- Every cast member needs an action from the list; set "face" for clear emotion. A speaking character usually uses "talk".

Output ONLY the JSON object (no prose), matching this JSON Schema:
{{Scene JSON Schema}}
```

Model: `opus` for series, `sonnet` for skits. Extra checks after parsing: every character/action/set id exists in the library, `line.who` and `focus` are in that shot's cast, a series part must have `summary`.

## 2. Series rules (`SERIES_RULES`)

```
This is PART {{part}} of an episodic mystery/suspense series in the style of a narrated survival game.
{{if previous parts}}Previous parts (keep continuity, same characters and world; open by briefly recalling the last cliffhanger):
Part 1: {{summary}}
...
{{else}}This is the first part: establish the world, the viewer's role and the rules.
- Narration language: {{language}}. All spoken lines and on-screen text in that language. A "narrator" speaks to the viewer in second person ("you"): the viewer IS the protagonist. Most lines are narrator lines (line.who = "narrator"); characters speak rarely, short and unsettling.
- In every line wrap 1–3 key words in *asterisks* (they render highlighted), e.g. "An *old man* walks in."
- Total 60–110 seconds; 20–36 shots. Speech is ~14 characters/second, so keep ALL spoken text together under 1300 characters. Mix narrated shots with silent tension shots (dur 1.5–3s, no line).
- mood "night" or "horror". Set "hud": a short game-like title (e.g. "NIGHT 1 · SHIFT") and a counterLabel for what the viewer tracks (customers, passengers, rules broken...). Set "clock" on shot 1 and advance it as time passes; set "counter" whenever it changes.
- Shot 1 = cold open: the most intriguing statement in under 3 seconds, with "text".
- Escalate: rules → something slightly wrong → clearly wrong. Use camera "closeup" on faces for reveals, "push" for slow dread, "flicker" when something is off, empty-cast establishing shots for the place.
- Ask the viewer to decide or spot the anomaly at least once (drives comments).
- Give the viewer 2–4 numbered survival rules, each shown as a "text" card (e.g. "RULE 1: *Never* say your name") while the narrator reads it; later beats must test or break those rules.
- Build to one scare near the end (closeup + zoom-shake + flicker on the threat).
- End on a cliffhanger with a two-option choice: the narrator states option 1 and option 2, and the last shot "text" is like "COMMENT *1* OR *2*?" — the most-voted option decides PART {{part + 1}}.
- Write "summary": 3–5 sentences of what happened, the character ids involved, and the exact cliffhanger, so the next part can continue.
- Optionally set "narrator" voice (default deep male).
```

## 3. Skit rules (`SKIT_RULES`)

```
- Dialogue language: {{language}}. Natural spoken lines, max ~80 characters each, punchy, funny or emotional. One speaker per shot (the "line").
- Total 18–35 seconds; 7–14 shots. A shot without a line needs "dur" (0.8–3s).
- Shot 1 is the hook: big on-screen "text" (≤ 7 words) + a line or strong reaction, camera zoom or shake.
- 2–3 characters.
- Use zoom/shake on reactions and the twist. The last shot should loop visually/verbally into the first.
```

## 4. Formula extraction (`ingest.ts`)

Input: up to 40 frames (1 fps, or fewer so they span the whole video, 480 px wide) + faster-whisper transcript. Only videos ≤ 180 s. Model: `opus`, with the Read tool to open the frames.

```
Analyze a viral short video and extract its reusable FORMULA.

Video: {{duration}}s long, title "{{title}}".
Frames, one every {{step}}s (the number in the file name is the second):
{{frames/t000.jpg ...}}
Open EVERY frame with the Read tool before answering.

Transcript (auto speech-to-text, language "{{lang}}", confidence {{p}}; may contain errors):
{{[start-end s] text, one per line, or "(no speech detected)"}}

We remake formulas as 9:16 shorts starring simple geometric shape characters (circle/square/triangle bodies with faces).
Extract only the STRUCTURE. Do NOT copy or quote the original dialogue, on-screen text, title, character names, character designs or art:
describe every beat as a generic, re-castable pattern (e.g. "A brags about X, B silently proves the opposite").
- beats: 2-10, in order, covering the whole video; t like "0-2s"; pattern = what happens and how it is shown
  (camera, timing, on-screen text, sound cue).
- whyViral: the concrete mechanisms (hook timing, reversal, relatability, loop, rewatch value...).
- cast: each role with its traits, e.g. {"role": "the boaster", "traits": "loud, overconfident"}.
- needs.actions / needs.settings: kebab-case names of the character actions/poses and the backgrounds/props
  a shape-character remake needs (e.g. "walk", "fall-over", "jump-scare"; "office", "kitchen").
- summary: one or two sentences describing the formula.
- language: the spoken language code from the transcript, or "none" if there is no speech.
- id: a short kebab-case slug describing the formula (not the video), e.g. "brag-then-humbled".
- source: "{{url}}", lengthS: {{duration}}, score: null.
Write all descriptions in English.

Return only one JSON object matching this JSON Schema:
{{Formula JSON Schema}}
```

Saving rule worth keeping: never overwrite an existing formula id (its `score` is feedback data); add `-2`, `-3`... instead.
