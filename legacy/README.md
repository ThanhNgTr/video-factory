# legacy/

Data and prompts carried over from the feasibility demo. **Read-only reference.** Never import from here: the rebuild migrates this data with a script in phase 1 (roadmap §7, GĐ 1), then this folder can be deleted.

- Source: `~/Project/my-idea/video-factory`, branch `demo-3d`, commit `f79948d` (the demo code lives there, not here).
- `library/`: 5 people, 23 actions, 2 sets, 2 formulas, 1 series (`night-desk`, part 1), in the demo's schema (`modules/*/schema.ts` in the demo repo).
- `prompts/demo-prompts.md`: the demo's scene-writer, series, skit and formula-extraction prompts, with known problems listed.

Not carried over, on purpose:
- All demo code: the rebuild starts clean (roadmap §2.3 lists what changes).
- `out/`, `public/audio/`, `runs/`: generated output. The downloaded source videos in `runs/ingest/` stay out of the repo (platform terms of use, roadmap §13.1); their formulas are already in `library/formulas/`.
- `library/series/ca-dem.json`: a Vietnamese series from the 2D era that references deleted 2D characters. The rebuild is English only.
