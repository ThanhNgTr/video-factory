// scene.json + audio.json -> frames. Pure.

import type { Audio, Caption, Diorama, Scene, Timeline } from "@vf/contracts";
import { type Cue, dioramaDrops, graphicCues, LAND } from "./graphic-timing.ts";
import { DROP_SECONDS } from "./prop-motion.ts";

export const SPEECH_LEAD_FRAMES = 6; // silence before a line starts
export const SPEECH_TAIL_FRAMES = 10; // breathing room after a line
export const JCUT_FRAMES = 15; // a J-cut holds the picture before this long while the new line already plays

export function buildTimeline(
  scene: Scene,
  audio: Audio,
  video: { fps: number; width: number; height: number },
): Timeline {
  const { fps } = video;
  const clips = new Map(audio.clips.map((c) => [c.shot, c]));
  let from = 0;
  let clock: string | undefined;
  let counter: number | undefined;
  const captions: Caption[] = [];
  const cues: Cue[] = [];
  let lastDiorama: Diorama | undefined; // a diorama's new layers are the ones the last diorama shot lacked
  const shots: Timeline["shots"] = [];
  for (const s of scene.shots) {
    const clip = clips.get(s.id);
    const speechFrames = clip ? Math.ceil(clip.seconds * fps) : undefined;
    // a J-cut (ADR 0025): the picture before holds JCUT_FRAMES longer while this line already starts, so the voice
    // leads the eye into the cut
    const prev = shots.at(-1);
    const j = s.jcut && prev && speechFrames ? JCUT_FRAMES : 0;
    if (prev && j) {
      prev.frames += j;
      from += j;
    }
    const frames = Math.max(
      Math.round(s.dur * fps),
      speechFrames ? SPEECH_LEAD_FRAMES - j + speechFrames + SPEECH_TAIL_FRAMES : 0,
    );
    const speechFrom = speechFrames ? from - j + SPEECH_LEAD_FRAMES : undefined;
    clock = s.clock ?? clock;
    counter = s.counter ?? counter;
    if (clip && speechFrom !== undefined) {
      let open = false;
      for (const w of clip.words) {
        const starts = w.text.startsWith("*");
        const ends = w.text.replace(/[.,!?;:"')]+$/, "").endsWith("*") || /\*[.,!?;:"')]*$/.test(w.text);
        const highlight = open || starts;
        if (starts && !ends) open = true;
        if (ends) open = false;
        captions.push({
          shot: s.id,
          frame: speechFrom + Math.round(w.start * fps),
          text: w.text.replaceAll("*", ""),
          highlight,
        });
      }
    }
    // sounds the picture calls for: a whoosh into a graphic, its parts popping, ticking and landing; an inset's
    // or a diorama's new layers landing; a chime as the last shot opens
    if (s.graphic) {
      cues.push({ frame: from, id: "whoosh" });
      for (const c of graphicCues(s.graphic, frames)) cues.push({ frame: from + c.frame, id: c.id });
    } else if (s.inset) for (const c of graphicCues(s.inset, frames)) cues.push({ frame: from + c.frame, id: c.id });
    else if (s.diorama) {
      for (const c of dioramaDrops(s.diorama, frames, lastDiorama))
        cues.push({ frame: from + c.frame + LAND, id: "thud" });
      lastDiorama = s.diorama;
    }
    // a story prop that drops in lands with a thud
    for (const pr of s.props)
      if (pr.motion === "drop") cues.push({ frame: from + Math.round((pr.at + DROP_SECONDS) * fps), id: "thud" });
    // weather beds under rain, snow and flood water: 8 s beds, another when a shot outlasts one
    if (s.fx)
      for (let t = 0; t < frames; t += 8 * fps) cues.push({ frame: from + t, id: s.fx === "rain" ? "rain" : "wind" });
    if (s === scene.shots.at(-1)) cues.push({ frame: from + 2, id: "ding" });
    shots.push({ id: s.id, from, frames, speechFrom, speechFrames, clock, counter });
    from += frames;
  }
  return { schemaVersion: 1, fps, width: video.width, height: video.height, totalFrames: from, shots, captions, cues };
}

export type CaptionChunk = { shot: string; from: number; to: number; words: Caption[] };

// Group a line's words into on-screen chunks of at most `max` words, breaking early at sentence punctuation.
export function captionChunks(
  captions: readonly Caption[],
  shotEnd: (shot: string) => number,
  max = 3,
  joinGap = 10, // frames: a lone word said this soon after the chunk before belongs to it (0.33 s at 30 fps)
): CaptionChunk[] {
  const chunks: CaptionChunk[] = [];
  let cur: Caption[] = [];
  const flush = (shot: string) => {
    const first = cur[0];
    if (!first) return;
    chunks.push({ shot, from: first.frame, to: 0, words: cur });
    cur = [];
    void shotEnd;
  };
  for (let i = 0; i < captions.length; i++) {
    const c = captions[i];
    if (!c) continue;
    const prev = cur[0];
    if (prev && prev.shot !== c.shot) flush(prev.shot);
    cur.push(c);
    const next = captions[i + 1];
    const breakHere = cur.length >= max || /[.!?,;:]$/.test(c.text) || !next || next.shot !== c.shot;
    if (breakHere) flush(c.shot);
  }
  // a lone word left over ("say your | name.", "coming, | hon.") flashed for a few frames: join it to the chunk before.
  // Not after a full stop, nor after a comma and a real pause: "first shift. | Again." is a beat, joined it would show
  // the punch word early
  for (let i = chunks.length - 1; i > 0; i--) {
    const ch = chunks[i];
    const pv = chunks[i - 1];
    const word = ch?.words[0];
    const last = pv?.words.at(-1);
    if (
      ch &&
      pv &&
      word &&
      last &&
      ch.words.length === 1 &&
      pv.shot === ch.shot &&
      pv.words.length <= max &&
      !/[.!?]$/.test(last.text) &&
      // cut mid-phrase by the word limit: always rejoin; after a comma: only when said right after
      (!/[,;:]$/.test(last.text) || word.frame - last.frame <= joinGap)
    ) {
      pv.words.push(...ch.words);
      chunks.splice(i, 1);
    }
  }
  for (let i = 0; i < chunks.length; i++) {
    const ch = chunks[i];
    const nx = chunks[i + 1];
    if (!ch) continue;
    ch.to = nx && nx.shot === ch.shot ? nx.from : shotEnd(ch.shot);
  }
  return chunks;
}
