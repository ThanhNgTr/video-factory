# Speak one line with Microsoft Edge TTS and return word timings.
# Run: uv run --with edge-tts==7.2.3 python -I tools/python/edge_tts_words.py <text> <voice> <pitch> <rate> <out.mp3>
# Prints {"words": [{"text", "start", "end"}]} (seconds) on stdout.
import asyncio
import json
import sys

import edge_tts

text, voice, pitch, rate, out = sys.argv[1:6]


async def main() -> None:
    com = edge_tts.Communicate(text, voice, pitch=pitch, rate=rate, boundary="WordBoundary")
    words = []
    with open(out, "wb") as f:
        async for chunk in com.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                start = chunk["offset"] / 1e7
                words.append({"text": chunk["text"], "start": round(start, 3), "end": round(start + chunk["duration"] / 1e7, 3)})
    print(json.dumps({"words": words}))


asyncio.run(main())
