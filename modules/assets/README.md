# @vf/assets — B. characters and sets

Owns the look: block characters, sets with named spots, the action engine, and the reference check.

| Stage          | Reads                 | Writes                                              |
| -------------- | --------------------- | --------------------------------------------------- |
| `assets.check` | `scene.json`, library | `assets.json` (people, actions, sets used, inlined) |

- `src/render/` is the only part another module may import (`@vf/assets/render`, used by `@vf/video`): `Character`, `SetView`, `blocks`, `samplePose`.
- Render code is a pure function of props; randomness comes from the caller (seeded).
- Library data: `library/people`, `library/actions`, `library/sets` (each set has `spots`). Migrated from the demo by `tools/migrate-legacy.ts`.
- Add a character/set/action = add a JSON file; the schema in `@vf/contracts` validates it on load.
- Look at a character: `pnpm vf preview <personId> [--face shock] [--action talk]` writes `runs/previews/<id>.png` (three angles + head close-up). Iterate on `src/render/Character.tsx` with it.
- Look: soft toon, no outline (ADR 0006, back by ADR 0008 for render speed). `blocks.tsx` holds the primitives (rounded box, sphere, capsule, lathe, tube, torus arc, plate, dome) and the toon `Paint`; parts still carry a surface kind (`m="skin" | "cloth" | "eye" | "matte"`) so the physical look of ADR 0007 can return by changing `Paint` alone. Geometry is cached by parameters; mesh density is tuned for CPU render time.
- Character anatomy (`Character.tsx`): the face follows the reference reels (ADR 0009); all face proportions live in the `FACE` table as fractions of the head width. Spherical head on a short neck, capsule limbs with joint spheres and deltoids, lathe fedora and bell skirt, tube scarves and collars, buttons and pockets. Props, `characterGeometry` and pose channels are the stable API used by `@vf/video`.
