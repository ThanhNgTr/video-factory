// Builds the ffmpeg filter graph for the final mix: speech at its timeline position, music ducked under speech,
// SFX cues, then loudness normalisation. Pure: returns inputs + filter string, runs nothing.
export type MixClip = { file: string; startS: number };
export type MixCue = { file: string; startS: number; gainDb?: number };
export type MixPlan = { inputs: string[]; filter: string; outLabel: string };

export function planMix(o: {
  speech: MixClip[];
  music?: { file: string; gainDb: number };
  sfx: MixCue[];
  totalS: number;
  targetLufs: number;
  truePeakDb: number;
}): MixPlan {
  const inputs: string[] = [];
  const parts: string[] = [];
  const ms = (s: number) => Math.max(0, Math.round(s * 1000));
  const add = (file: string) => inputs.push(file) - 1;

  const speechLabels = o.speech.map((c, i) => {
    const idx = add(c.file);
    parts.push(`[${idx}:a]aresample=48000,aformat=channel_layouts=mono,adelay=${ms(c.startS)}:all=1[sp${i}]`);
    return `[sp${i}]`;
  });
  // silent anchor so the graph works with zero speech or zero sfx
  parts.push(`anullsrc=r=48000:cl=mono,atrim=0:${o.totalS.toFixed(3)}[anchor]`);
  parts.push(
    `${speechLabels.join("")}[anchor]amix=inputs=${speechLabels.length + 1}:normalize=0:dropout_transition=0[speech]`,
  );

  const sfxLabels = o.sfx.map((c, i) => {
    const idx = add(c.file);
    parts.push(
      `[${idx}:a]aresample=48000,aformat=channel_layouts=mono,adelay=${ms(c.startS)}:all=1,volume=${c.gainDb ?? -6}dB[fx${i}]`,
    );
    return `[fx${i}]`;
  });

  const buses = ["[speech]"];
  if (o.music) {
    const idx = add(o.music.file);
    parts.push(
      `[${idx}:a]aresample=48000,aformat=channel_layouts=mono,aloop=loop=-1:size=2e9,atrim=0:${o.totalS.toFixed(3)},volume=${o.music.gainDb}dB[mus]`,
    );
    parts.push("[speech]asplit[speechA][speechB]");
    // music is squashed while speech is present (sidechain), so narration always wins
    parts.push("[mus][speechB]sidechaincompress=threshold=0.015:ratio=10:attack=40:release=500:makeup=1[musD]");
    buses[0] = "[speechA]";
    buses.push("[musD]");
  }
  buses.push(...sfxLabels);
  parts.push(
    `${buses.join("")}amix=inputs=${buses.length}:normalize=0:dropout_transition=0,atrim=0:${o.totalS.toFixed(3)}[pre]`,
  );
  parts.push(`[pre]loudnorm=I=${o.targetLufs}:TP=${o.truePeakDb}:LRA=11[out]`);
  return { inputs, filter: parts.join(";"), outLabel: "[out]" };
}
