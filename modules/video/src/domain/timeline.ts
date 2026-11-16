// scene.json + audio.json -> frames. Pure.
import type { Audio, Caption, Scene, Timeline } from "@vf/contracts";

export const SPEECH_LEAD_FRAMES = 6; // silence before a line starts
export const SPEECH_TAIL_FRAMES = 10; // breathing room after a line

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
  const shots = scene.shots.map((s) => {
    const clip = clips.get(s.id);
    const speechFrames = clip ? Math.ceil(clip.seconds * fps) : undefined;
    const frames = Math.max(
      Math.round(s.dur * fps),
      speechFrames ? SPEECH_LEAD_FRAMES + speechFrames + SPEECH_TAIL_FRAMES : 0,
    );
    const speechFrom = speechFrames ? from + SPEECH_LEAD_FRAMES : undefined;
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
    const row = { id: s.id, from, frames, speechFrom, speechFrames, clock, counter };
    from += frames;
    return row;
  });
  return { schemaVersion: 1, fps, width: video.width, height: video.height, totalFrames: from, shots, captions };
}

export type CaptionChunk = { shot: string; from: number; to: number; words: Caption[] };

// Group a line's words into on-screen chunks of at most `max` words, breaking early at sentence punctuation.
export function captionChunks(
  captions: readonly Caption[],
  shotEnd: (shot: string) => number,
  max = 3,
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
  for (let i = 0; i < chunks.length; i++) {
    const ch = chunks[i];
    const nx = chunks[i + 1];
    if (!ch) continue;
    ch.to = nx && nx.shot === ch.shot ? nx.from : shotEnd(ch.shot);
  }
  return chunks;
}
