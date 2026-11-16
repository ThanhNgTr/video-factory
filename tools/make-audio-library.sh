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
# 120 s calm night pad for 'night' / 'bright' moods
ffmpeg -v error -y -f lavfi -i "sine=frequency=110:duration=120" -f lavfi -i "sine=frequency=165:duration=120" \
  -filter_complex "[0][1]amix=inputs=2,lowpass=f=600,tremolo=f=0.25:d=0.3,volume=0.35,afade=t=in:d=3,afade=t=out:st=115:d=5" -ar 48000 library/music/night-pad.wav
echo "{ \"id\": \"night-pad\", \"file\": \"night-pad.wav\", \"mood\": [\"night\", \"bright\"], \"seconds\": 120, $L }" > library/music/night-pad.json
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
echo done
