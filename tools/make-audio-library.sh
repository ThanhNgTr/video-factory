#!/usr/bin/env bash
# Synthesizes the starter music + SFX with ffmpeg so the repo needs no licensed files to run.
# shortcut: procedural placeholder audio, replace with a licensed library (roadmap S6) before publishing at volume.
set -euo pipefail
cd "$(dirname "$0")/.."
L='"license": "generated in-repo by tools/make-audio-library.sh (CC0)"'
mkdir -p library/music library/sfx
# 120 s horror drone: two detuned low sines + filtered noise, slow tremolo
ffmpeg -v error -y -f lavfi -i "sine=frequency=55:duration=120" -f lavfi -i "sine=frequency=82.5:duration=120" -f lavfi -i "anoisesrc=color=brown:duration=120:amplitude=0.4" \
  -filter_complex "[0][1]amix=inputs=2[s];[2]lowpass=f=300[n];[s][n]amix=inputs=2,tremolo=f=0.12:d=0.5,volume=0.5,afade=t=in:d=3,afade=t=out:st=115:d=5" -ar 48000 library/music/dark-drone.wav
echo "{ \"id\": \"dark-drone\", \"file\": \"dark-drone.wav\", \"mood\": [\"horror\", \"night\"], \"seconds\": 120, $L }" > library/music/dark-drone.json
# 120 s calm night pad for the night mood
ffmpeg -v error -y -f lavfi -i "sine=frequency=110:duration=120" -f lavfi -i "sine=frequency=165:duration=120" \
  -filter_complex "[0][1]amix=inputs=2,lowpass=f=600,tremolo=f=0.25:d=0.3,volume=0.35,afade=t=in:d=3,afade=t=out:st=115:d=5" -ar 48000 library/music/night-pad.wav
echo "{ \"id\": \"night-pad\", \"file\": \"night-pad.wav\", \"mood\": [\"night\"], \"seconds\": 120, $L }" > library/music/night-pad.json
sfx() { # id seconds filter
  ffmpeg -v error -y -f lavfi -i "$3" -t "$2" -ar 48000 "library/sfx/$1.wav"
  echo "{ \"id\": \"$1\", \"file\": \"$1.wav\", \"seconds\": $2, $L }" > "library/sfx/$1.json"
}
sfx stinger 1.5 "sine=frequency=1200:duration=1.5,volume='0.9*exp(-6*t)':eval=frame"
sfx thud 0.6 "sine=frequency=60:duration=0.6,volume='exp(-8*t)':eval=frame"
sfx ring 2.0 "sine=frequency=880:duration=2,tremolo=f=20:d=1,volume=0.5"
sfx flicker 0.8 "anoisesrc=color=white:duration=0.8:amplitude=0.3,highpass=f=2000,tremolo=f=30:d=1"
sfx footsteps 1.6 "anoisesrc=color=brown:duration=1.6:amplitude=0.6,lowpass=f=200,tremolo=f=2.5:d=1"
sfx door 1.2 "anoisesrc=color=pink:duration=1.2:amplitude=0.5,lowpass=f=900,volume='exp(-3*t)':eval=frame"
sfx heartbeat 2.0 "sine=frequency=50:duration=2,tremolo=f=1.2:d=1"
# weather beds under rain, snow and flood shots (video.timeline cues them per shot)
sfx rain 8 "anoisesrc=color=pink:duration=8:amplitude=0.5:seed=7,bandpass=f=1800:w=1400,tremolo=f=9:d=0.25,afade=t=in:d=0.4,afade=t=out:st=7.2:d=0.8"
sfx wind 8 "anoisesrc=color=brown:duration=8:amplitude=0.6:seed=3,lowpass=f=500,tremolo=f=0.3:d=0.6,afade=t=in:d=0.6,afade=t=out:st=7:d=1"
# the picture's sound cues (video.timeline): a tick, a tick roll for counters, a pop, a soft whoosh, a chime
sfx tick 0.06 "sine=frequency=2400:duration=0.06,volume='exp(-70*t)':eval=frame"
sfx ticks 1.2 "aevalsrc=exprs='0.6*sin(2*PI*2400*t)*exp(-90*mod(t\,0.08))*(1-t/1.2)':s=48000:d=1.2"
sfx pop 0.16 "aevalsrc=exprs='0.8*sin(2*PI*(420+900*exp(-28*t))*t)*exp(-22*t)':s=48000:d=0.16"
sfx whoosh 0.5 "anoisesrc=color=pink:duration=0.5:amplitude=0.6:seed=11,lowpass=f=2500,highpass=f=300,volume='sin(PI*t/0.5)':eval=frame"
sfx ding 1.4 "aevalsrc=exprs='0.5*(sin(2*PI*1320*t)+0.6*sin(2*PI*2640*t)+0.3*sin(2*PI*3960*t))*exp(-3.5*t)':s=48000:d=1.4"
# an upbeat loop for bright moods (explainers, comedy), synthesized in TypeScript
node tools/synth-music.ts library/music/bright-bounce.wav 64
echo "{ \"id\": \"bright-bounce\", \"file\": \"bright-bounce.wav\", \"mood\": [\"bright\"], \"seconds\": 64, \"license\": \"generated in-repo by tools/synth-music.ts (CC0)\" }" > library/music/bright-bounce.json
echo done
