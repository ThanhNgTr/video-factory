# Speech -> transcript JSON {"language", "segments": [{start, end, text}]}.
# Run: uv run --python 3.12 --with faster-whisper --with "av<19" python -I tools/python/transcribe.py <media> <out.json>
import json
import sys

import av  # <19: faster-whisper passes av.open(metadata_errors=), removed in PyAV 19
from faster_whisper import WhisperModel

media, out = sys.argv[1], sys.argv[2]
result = {"language": "none", "segments": []}
with av.open(media) as c:
    has_audio = bool(c.streams.audio)
if has_audio:
    model = WhisperModel("small", device="cpu", compute_type="int8")
    # vad_filter: skip music/silence so Whisper doesn't hallucinate lines on speechless videos
    segments, info = model.transcribe(media, vad_filter=True)
    result = {
        "language": info.language,
        "segments": [{"start": round(s.start, 1), "end": round(s.end, 1), "text": s.text.strip()} for s in segments],
    }
with open(out, "w") as f:
    json.dump(result, f, ensure_ascii=False, indent=1)
