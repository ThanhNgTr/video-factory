// Dev tool: synthesizes an upbeat, deterministic background loop for bright moods (explainers, comedy) as a WAV.
// usage: node tools/synth-music.ts <out.wav> [seconds]
// shortcut: procedural placeholder music like tools/make-audio-library.sh, replace with a licensed library (roadmap S6).
import { writeFileSync } from "node:fs";

const [out = "library/music/bright-bounce.wav", secs = "64"] = process.argv.slice(2);
const SR = 48000;
const n = Math.round(Number(secs) * SR);
const buf = new Float32Array(n);
const BPM = 104;
const beat = 60 / BPM;
const eighth = beat / 2;
// C, G, Am, F: one bar each, as semitones above C3 (MIDI 48)
const CHORDS = [
  [0, 4, 7, 12],
  [-5, -1, 2, 7],
  [-3, 0, 4, 9],
  [-7, -3, 0, 5],
];
const hz = (semi: number) => 130.81 * 2 ** (semi / 12);
let seed = 7; // a fixed noise sequence: the same file every run
const noise = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return (seed / 2147483648) * 2 - 1;
};
const add = (start: number, len: number, f: (t: number) => number) => {
  const a = Math.round(start * SR);
  const b = Math.min(n, a + Math.round(len * SR));
  for (let i = a; i < b; i++) buf[i] = (buf[i] ?? 0) + f((i - a) / SR);
};
for (let t0 = 0, step = 0; t0 < Number(secs); t0 += eighth, step++) {
  const bar = Math.floor(step / 8) % CHORDS.length;
  const chord = CHORDS[bar] ?? [0, 4, 7, 12];
  // pluck arpeggio up and down the chord, an octave up
  const pattern = [0, 1, 2, 3, 2, 1, 2, 1];
  const f = hz((chord[pattern[step % 8] ?? 0] ?? 0) + 12);
  add(t0, 0.5, (t) => 0.16 * Math.exp(-7 * t) * (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(4 * Math.PI * f * t)));
  // bass on beats 1 and 3
  if (step % 4 === 0) {
    const fb = hz((chord[0] ?? 0) - 12);
    add(t0, beat * 1.8, (t) => 0.22 * Math.exp(-2.5 * t) * Math.sin(2 * Math.PI * fb * t));
  }
  // soft kick on every beat, hi-hat on the off-beats
  if (step % 2 === 0)
    add(t0, 0.25, (t) => 0.28 * Math.exp(-18 * t) * Math.sin(2 * Math.PI * (50 + 70 * Math.exp(-30 * t)) * t));
  else add(t0, 0.06, (t) => 0.05 * Math.exp(-60 * t) * noise());
}
// fade the ends, scale to -3 dBFS peak
const fade = SR * 2;
for (let i = 0; i < fade; i++) {
  buf[i] = (buf[i] ?? 0) * (i / fade);
  buf[n - 1 - i] = (buf[n - 1 - i] ?? 0) * (i / fade);
}
const peak = buf.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
const gain = 0.708 / peak;
const data = Buffer.alloc(44 + n * 2);
data.write("RIFF", 0);
data.writeUInt32LE(36 + n * 2, 4);
data.write("WAVEfmt ", 8);
data.writeUInt32LE(16, 16);
data.writeUInt16LE(1, 20); // PCM
data.writeUInt16LE(1, 22); // mono
data.writeUInt32LE(SR, 24);
data.writeUInt32LE(SR * 2, 28);
data.writeUInt16LE(2, 32);
data.writeUInt16LE(16, 34);
data.write("data", 36);
data.writeUInt32LE(n * 2, 40);
for (let i = 0; i < n; i++)
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, (buf[i] ?? 0) * gain)) * 32767), 44 + i * 2);
writeFileSync(out, data);
console.log(out);
