import { type Audio, NARRATOR, Scene, Script, type SpeechClip, type Voice } from "@vf/contracts";
import { StageError } from "@vf/core";
import { stage } from "@vf/pipeline";
import { displayWords, normalizeSpeech } from "../domain/normalize.ts";
import type { AudioDeps } from "../ports.ts";

const DEFAULT_NARRATOR: Voice = { id: "en-US-GuyNeural", pitch: "-4Hz", rate: "-5%" };

// One clip per spoken line. Word timings from the provider are mapped back onto the display words (markup kept).
export const audioTts = stage<AudioDeps>({
  name: "audio.tts",
  version: 1,
  inputs: ["scene.json", "script.json"],
  outputs: ["audio.json"],
  run: async (ctx) => {
    const scene = ctx.store.readJson("scene.json", Scene);
    const script = ctx.store.readJson("script.json", Script);
    const narrator = script.narratorVoice ?? DEFAULT_NARRATOR;
    const clips: SpeechClip[] = [];
    for (const shot of scene.shots) {
      if (!shot.line) continue;
      const voice = shot.line.who === NARRATOR ? narrator : ctx.library.people[shot.line.who]?.voice;
      if (!voice) throw new StageError("missing-reference", `no voice for speaker ${shot.line.who}`);
      const name = `audio/${shot.id}.mp3`;
      const r = await ctx.deps.tts.speak(normalizeSpeech(shot.line.text), voice, ctx.store.path(name));
      ctx.recordUsage({
        provider: ctx.config.tts,
        model: voice.id,
        inputTokens: shot.line.text.length,
        outputTokens: 0,
        costUsd: 0,
        ms: 0,
      });
      clips.push({
        shot: shot.id,
        who: shot.line.who,
        text: shot.line.text,
        file: name,
        seconds: r.seconds,
        words: alignWords(shot.line.text, r.words, r.seconds),
      });
    }
    const audio: Audio = { schemaVersion: 1, clips };
    ctx.store.writeJson("audio.json", audio);
  },
});

// Provider words come from the normalised text; display words keep markup and punctuation. Counts can differ
// ("23:58" -> three words), so distribute display words over the spoken span proportionally when they do.
export function alignWords(display: string, spoken: { text: string; start: number; end: number }[], seconds: number) {
  const words = displayWords(display);
  if (spoken.length === words.length)
    return words.map((w, i) => ({ text: w, start: spoken[i]?.start ?? 0, end: spoken[i]?.end ?? seconds }));
  const start = spoken[0]?.start ?? 0;
  const end = spoken.at(-1)?.end ?? seconds;
  const step = (end - start) / Math.max(1, words.length);
  return words.map((w, i) => ({ text: w, start: start + i * step, end: start + (i + 1) * step }));
}
