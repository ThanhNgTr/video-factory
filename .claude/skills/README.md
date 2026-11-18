# Project skills

Know-how skills for the coding agent working on this repo. They do not change the videos by themselves: the factory's writer and director LLMs never read them, so anything worth keeping must be turned into format rules, prompts, camera code or QA checks.

`CLAUDE.md` wins wherever a skill disagrees with it (for example: no AI video models, frame-driven rendering only, English only on screen).

## From iart-ai (MIT, see `LICENSE-iart-ai`)

| Skill | Pack | Commit | Why it is here |
| --- | --- | --- | --- |
| `short-form-video` | `iart-ai/tiktok-video-skills` | `88e7152fc271` | Hook on screen from frame 1, uneven pattern interrupts every 2-4 s, open loop closed at the end, 9:16 safe areas |
| `shot-composition` | `iart-ai/motion-design-skills` | `b85e50c4cef5` | One camera move per shot, lead room, dolly-zoom recipe for scares, safe areas |
| `beat-sync-editing` | `iart-ai/motion-design-skills` | `b85e50c4cef5` | Pacing arc (shots shorten toward the climax, then hold), J/L cuts |
| `color-motion` | `iart-ai/motion-design-skills` | `b85e50c4cef5` | Rec.709 tags checked with ffprobe, grain against banding in dark scenes, restrained palettes |
| `shader-glsl` | `iart-ai/webgl-animation-skills` | `004193381368` | Glitch and chromatic aberration for scares; render heavy shaders at low resolution (CPU WebGL) |

Fetched 2026-11-16 as plain files, not with `npx skills add`. Changes from upstream: removed the iart.ai promotional footers and the "Packaged helper" lines pointing to the packs' `scripts/` folder, which is not copied (this repo verifies with `vf preview`, `video.qa` and ffmpeg contact sheets).

The skills mention sibling skills that are not installed (`animation-principles`, `motion-art-direction`, `caption-animation`, `remotion-video`, `gsap-web`, `after-effects`). Left out on purpose: `countdown-video` (only `tabular-nums` applies here), packs for web, ads, e-commerce, data, maps, Manim, and `talking-head-skills` (AI-generated footage breaks the no-AI-video rule).

## From Remotion (`remotion-dev/skills`)

Installed 2026-11-17 with the official installer (`npx skills@1.7.0 add remotion-dev/skills -a claude-code -s ... --copy`, the command `remotion skills add` runs); `skills-lock.json` records sources and hashes, `npx skills update` refreshes them. The repository carries no license file; Remotion publishes these skills for use in Remotion projects.

| Skill | Why it is here |
| --- | --- |
| `remotion-markup` | Remotion coding rules: interpolate/spring/Easing, sequencing, text measuring (`fitText`), text highlights, transitions, fonts, audio |
| `remotion-render` | Render and still options, concurrency, GL backends (GPU spike S1) |
| `remotion-docs` | Searching the Remotion docs (public Algolia search key) |
| `remotion-upgrade` | Upgrading Remotion and its packages together |
| `remotion-license` | Remotion needs a company license from 4 people up |

Left out: `remotion-best-practices` (its router turns "make a video" into creating a new Remotion project and opening Studio; here it means `vf make`), `remotion-create`, `remotion-studio`, `remotion-interactivity`, `remotion-saas`, `remotion-multimedia`, `remotion-captions` (the factory has its own captions). The maps guide inside `remotion-markup` fetches tiles at render time, which this repo forbids; `vf-motion` lists every such override.

## Written here

| Skill | Why it is here |
| --- | --- |
| `vf-motion` | This repo's overrides of `remotion-markup`, and motion principles (phases, anticipation, overshoot and settle, arcs, follow-through) applied to Character2D, the camera and Graphics. Its principles are written in our own words after reading `vibe-motion/skills`' `disney-animation-rule-skill`, which has no license and is unmaintained, so it is not copied. |
| `vf-story` | Screenwriting: hook, visual spine, open loop, escalation, fair twist, payoff; which prompt, format field or check each rule belongs in; the length budget; how to compare a prompt change while `vf eval` does not exist |
| `vf-dialogue` | Lines: speakable, punch word last, `*stress*`, subtext, distinct voices; fixing pronunciation in `normalizeSpeech`, voices, caption chunks |
| `vf-characters` | Character design from `Person` parameters: silhouette, shape language, one colour per cast member, faces, voice; adding a parameter end to end; `vf preview` |
| `vf-sets` | Set design from `Set3D`: camera front, spots and seats as blocking, walk lanes, value against the characters, furniture versus story props |
| `vf-camera` | The shot rig and editing grammar (ADR 0025): what each angle, lens, move and transition means, coverage and cutaways, `checkEditing`, measuring motion |
| `vf-fx` | Lighting, weather, prop motions, camera hits, transitions, SFX: when an effect lands, and the steps to add a new one |

The six skills above are written from this repo's prompts, contracts and ADRs plus general craft (screenwriting, character and set design, film grammar); no outside text is copied. A search on 2026-11-18 found no pack worth installing whole. A few rules were restated in our own words after reading `nolanx-ai/nolanx.ai` (MIT: shot size with a reason, lines that attack, defend, reveal, hide or break, start late in the action), `omer-metin/skills-for-antigravity` (Apache-2.0: three reads of a character, hero, support and dressing tiers, the squint test), and `jwynia/agent-skills` and `vibe-motion/skills` (no license file, so only the ideas: unequal turns in an exchange, the effort-and-stake gap in a joke, an effect never rescues a weak pose). Left out: packs built around AI image or video generation (inference-sh, fal-ai, Higgsfield, the nolanx AI storyboard parts) and `OpenMontage` (AGPL-3.0). Like the rest, they guide the coding agent only: a rule only reaches the videos once it is in a prompt, a format, a check or render code.
