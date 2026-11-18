# ADR 0012: A beat's cast is everyone in the place; room shots show all of them

Date: 2026-11-16 · Status: accepted

## Context
In "The Halfway Diner" part 1 characters appeared and vanished between shots: Dot was gone from every wide shot after handing over the rules, Hank vanished while Theo walked in. The writer listed only who acts in a beat, and the director and renderer draw only a shot's cast, so nothing tracked who was still in the room.

## Decision
- `Beat.cast` (script) now means everyone in the place during the beat, silent bystanders included. A character stays in every following beat until a beat's action shows them leave, and comes back only in a beat that shows them return (writer prompt v2).
- The director shows the whole beat cast in shots that frame the room (wide, push, pan, shake); bystanders play `idle` on their usual spot. Medium, closeup, over-shoulder and zoom-shake shots may frame only their subjects. A character who leaves walks to the door or the spot they leave by (director prompt v3).
- `checkSceneMatchesScript` enforces the room-shot rule, so the director's repair loop fixes a missing bystander.

## Consequences
- No schema change: `Beat.cast` keeps its shape (max 4), only its meaning widens. Older scripts that list only actors still parse; re-staging them gives room shots with fewer people, as before.
- A beat holds at most 4 people, and a shot at most 4; bigger crowds need a contract change.
- Exits are stated in prose (`action`) and staged by the director; nothing checks that a character who left actually walked out.
