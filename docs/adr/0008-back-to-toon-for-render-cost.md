# ADR 0008: back to the soft toon look for render cost; keep the character shape fixes

Date: 2026-11-16 · Status: accepted · Supersedes ADR 0007 (kept for a future GPU machine)

## Context
The vinyl look of ADR 0007 (physical materials, dense meshes, N8AO + Bloom + MSAA 4) rendered at about 2.2 s per frame on the CPU-only dev machine: about 2 h 15 min for a 2-minute episode, against 19 min before. The producer chose speed over that look.

## Decision
- Shading goes back to ADR 0006: a 32-step toon ramp lifted to 0.42 in the shadow, no outline; eye parts, lash lines, mouths and the faceless sockets are unlit (`glow`) so they stay crisp in the dark.
- Lighting goes back to the per-mood table in `World.tsx` (ambient, a key light that follows the camera, two rim lights, practical lamps, fog); the character sheet goes back to its neutral light. No post-processing: `fx.tsx`, `rig.ts`, `@react-three/postprocessing` and `postprocessing` are removed, and `tsconfig` returns to `NodeNext` (Biome `useImportExtensions` stays).
- Mesh density returns to the old levels (spheres 40x28 / 16x12, rounded boxes 3 segments, capsules 6x20, tubes 48x12, lathes 32).
- Kept from ADR 0007 because they are shape, not style, and the producer asked for them: round head and features on its surface, capsule limbs with joint spheres and deltoids, lathe fedora and bell skirt, tube scarves and collars, buttons and pockets, Sam's combed fringe (a touch lighter than the cap so toon shading does not merge it), the Tall Guest's curved teeth, sockets and brow ridge, Rosa's curved apron shell and waist band, the bigger iris with a curved resting lid. The `m` surface kinds stay on every part so the physical look can return by changing `Paint` alone.
- The vinyl-era source files are archived locally in `runs/archive/vinyl-2026-11-16/` (not in version control).

## Consequences
Measured on the same frames as ADR 0007 (2 tabs, CPU WebGL): about 0.27 s per frame, about 17 minutes for a 2-minute episode.

- shortcut: the toon look is a CPU-render compromise, revisit ADR 0007 once spike S1 provides a GPU render machine.
