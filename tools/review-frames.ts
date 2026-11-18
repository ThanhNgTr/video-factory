// Dev tool: two reviewers (Claude via claude-cli, Codex via codex-cli) look at contact sheets and list visual defects.
// usage: node tools/review-frames.ts <sheetDir> [claudeModel]   (sheets from tools/sheets.sh)
import { readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { askJson, ClaudeCliLlm, CodexCliLlm, loadConfig } from "../packages/core/src/index.ts";

const [dir, claudeModel = "opus"] = process.argv.slice(2);
if (!dir) throw new Error("usage: review-frames.ts <sheetDir> [claudeModel]");
const sheets = readdirSync(dir)
  .filter((f) => /^sheet\d+\.jpg$/.test(f))
  .sort((a, b) => a.localeCompare(b, "en", { numeric: true }))
  .map((f) => ({ path: `${dir}/${f}` }));

const Review = z.object({
  defects: z.array(
    z.object({
      frames: z.array(z.string()),
      kind: z.enum([
        "face-hidden",
        "inside-furniture",
        "cut-off",
        "bad-framing",
        "text-overflow",
        "continuity",
        "other",
      ]),
      severity: z.enum(["high", "medium", "low"]),
      detail: z.string(),
    }),
  ),
});

const system = `You are a strict visual QA reviewer at an automated animation studio. You check frames of a finished vertical (9:16) horror short before it is published.

The style is intended and is NOT a defect: flat 2D cartoon characters (big round heads, sticker eyes, dark outlines) standing inside simple low-poly 3D sets; dim, flickering, red or blacked-out lighting; a HUD at the top (night label, clock, counter); big uppercase captions near 60% of the height, white with yellow keywords, where words not spoken yet are drawn grey; cream "SURVIVAL RULE" cards; the final "PART 2 / COMMENT 1 OR 2" vote card; an empty room in an establishing shot; a close-up of a held item filling the frame.

Report the defects a viewer would notice:
- face-hidden: a character's face or mouth is hidden by furniture or by another character
- inside-furniture: a character overlaps or stands inside a prop, or foreground furniture blocks the view of the subject
- cut-off: an important character, hand or held object is cut by the frame edge
- bad-framing: a close-up so tight that the face is cropped, or the subject is lost in the frame
- text-overflow: a caption or card is clipped by the frame edge or collides with other text
- continuity: a character vanishes or appears between frames of the same moment without a visible reason
- other: anything else clearly broken (glitches, wrong layering, floating parts)`;
const user = `The ${sheets.length} attached images are contact sheets of frames in time order. Each frame is labelled at its bottom-left with its id (fNN) and time in seconds. Report every defect once, listing all frame ids it affects. Report only what you can see; when unsure, leave it out.`;

const run = async (name: string, llm: ClaudeCliLlm | CodexCliLlm) => {
  const t0 = Date.now();
  const r = await askJson(llm, {
    model: claudeModel as "opus",
    system,
    user,
    images: sheets,
    schema: Review,
    schemaName: "review",
  });
  const out = { reviewer: name, seconds: Math.round((Date.now() - t0) / 1000), ...r };
  writeFileSync(`${dir}/review-${name}.json`, JSON.stringify(out, null, 2));
  return out;
};
const claudeBin = loadConfig(fileURLToPath(new URL("..", import.meta.url))).claudeBin ?? "claude";
const results = await Promise.allSettled([
  run("claude", new ClaudeCliLlm(claudeBin, 5)),
  run("codex", new CodexCliLlm("codex")),
]);
for (const res of results) {
  if (res.status === "rejected") {
    console.log(`\n=== failed: ${String(res.reason).slice(0, 300)}`);
    continue;
  }
  const r = res.value;
  console.log(`\n=== ${r.reviewer} (${r.seconds}s, ${r.defects.length} defects)`);
  for (const d of r.defects) console.log(`- [${d.severity}] ${d.kind} ${d.frames.join(",")}: ${d.detail}`);
}
