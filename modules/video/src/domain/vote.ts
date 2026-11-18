// The end card's vote, in the words the script uses. Pure.
import type { Scene } from "@vf/contracts";

// the vote card's text: the last shot's, or the last card its beat carries (the director puts a beat's card on the
// beat's first shot, so the final shot of the vote beat often has none)
export const voteText = (scene: Pick<Scene, "shots">): string | undefined => {
  const last = scene.shots.at(-1);
  return last?.text ?? scene.shots.filter((s) => s.beat === last?.beat && s.text).at(-1)?.text;
};

// the two badges follow the vote the script asks for: "COMMENT *A* OR *B*" -> A, B; anything else -> 1, 2
export const voteLabels = (text?: string): [string, string] =>
  /\bA\s+OR\s+B\b/i.test((text ?? "").replaceAll("*", "")) ? ["A", "B"] : ["1", "2"];
