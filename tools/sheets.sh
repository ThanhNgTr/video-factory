#!/usr/bin/env bash
# Dev tool: one labelled frame per segment of a video (scene cuts + a 4 s grid, segments >= 2 s), tiled 3x3 per sheet.
# usage: tools/sheets.sh <video.mp4> <outdir>
set -euo pipefail
v="$1"; out="$2"; mkdir -p "$out/frames"
dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$v")
cuts=$(ffmpeg -v info -i "$v" -vf "select='gt(scene,0.18)',showinfo" -an -f null - 2>&1 | grep -o 'pts_time:[0-9.]*' | cut -d: -f2)
grid=$(awk -v d="$dur" 'BEGIN{for(t=4;t<d;t+=4)print t}')
pts=$(printf "0\n%s\n%s\n%s\n" "$cuts" "$grid" "$dur" | awk NF | sort -n | uniq)
i=0; prev=""
for t in $pts; do
  if [ -z "$prev" ]; then prev="$t"; continue; fi
  awk -v a="$prev" -v b="$t" 'BEGIN{exit !(b-a>=2.0)}' || continue
  i=$((i+1)); mid=$(awk -v a="$prev" -v b="$t" 'BEGIN{printf "%.2f",(a+b)/2}'); lab=$(printf "f%02d" $i)
  ffmpeg -v error -y -ss "$mid" -i "$v" -frames:v 1 -vf "scale=360:-1,drawtext=text='$lab  ${mid}s':x=8:y=h-34:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=5" "$out/frames/$lab.png"
  prev="$t"
done
n=0; for s in $(seq 1 9 "$i"); do
  n=$((n+1)); ffmpeg -v error -y -start_number "$s" -i "$out/frames/f%02d.png" -frames:v 1 -vf "tile=3x3:padding=6:color=black" "$out/sheet$n.jpg"
done
ls "$out"/sheet*.jpg
