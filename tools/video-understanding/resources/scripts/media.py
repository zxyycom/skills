"""Native PyAV boundary: no subtitle parser, model API, or image library."""

import argparse
import json
import math
import sys
import hashlib
from importlib.metadata import version
from pathlib import Path

import av


def inspect(source):
    with av.open(source) as media:
        video = next(iter(media.streams.video), None)
        first_frame = next(media.decode(video), None) if video is not None else None
        rotation = getattr(first_frame, "rotation", None)
        return {
            "duration": media.duration / av.time_base if media.duration is not None else None,
            "start": media.start_time / av.time_base if media.start_time is not None else None,
            "streams": [
                {"index": stream.index, "type": stream.type,
                 "codec": stream.codec_context.name,
                 **({"width": stream.codec_context.width,
                     "height": stream.codec_context.height}
                    if stream.type == "video" else {}),
                 **({"rotation": float(rotation)}
                    if stream is video and rotation is not None else {}),
                 "start": float(stream.start_time * stream.time_base)
                 if stream.start_time is not None else None}
                for stream in media.streams
            ],
        }


def subtitles(source):
    segments = []
    with av.open(source) as media:
        for packet in media.demux(media.streams.subtitles[0]):
            if not packet.size:
                continue
            if packet.pts is None or packet.duration is None:
                raise ValueError("subtitle packet lacks timing")
            start = float(packet.pts * packet.time_base)
            end = float((packet.pts + packet.duration) * packet.time_base)
            segments.append({"start": start, "end": end,
                             "text": bytes(packet).decode("utf-8", errors="strict")})
    return segments


def frames(source, output, times, width):
    results = []
    with av.open(source) as media:
        stream = media.streams.video[0]
        for index, requested in enumerate(times):
            media.seek(int(requested / stream.time_base), stream=stream, backward=True)
            selected = None
            for frame in media.decode(stream):
                if frame.pts is None:
                    raise ValueError("video frame lacks PTS")
                if float(frame.pts * frame.time_base) >= requested:
                    selected = frame
                    break
            if selected is None:
                raise ValueError("no frame at or after requested time")
            actual = float(selected.pts * selected.time_base)
            pts = selected.pts
            time_base = selected.time_base
            filename = Path(output) / f"frame-{index + 1:02d}.png"
            if filename.exists():
                raise ValueError("frame output already exists")
            image = selected
            if width and image.width > width:
                image = image.reformat(width=width, height=max(1, round(image.height * width / image.width)))
            with av.open(str(filename), mode="w", format="image2") as target:
                encoder = target.add_stream("png", rate=1)
                encoder.width, encoder.height, encoder.pix_fmt = image.width, image.height, "rgb24"
                for packet in encoder.encode(image.reformat(format="rgb24")):
                    target.mux(packet)
                for packet in encoder.encode():
                    target.mux(packet)
            results.append({"file": filename.name, "requested": requested, "actual": actual,
                            "pts": pts, "timeBase": str(time_base), "streamIndex": stream.index})
    return results


def requested_times(value):
    try:
        times = json.loads(value)
        if not isinstance(times, list) or not 1 <= len(times) <= 8:
            raise ValueError()
        if any(isinstance(time, bool) or not isinstance(time, (int, float))
               or not math.isfinite(time) or time < 0 for time in times):
            raise ValueError()
        return times
    except (ValueError, TypeError):
        raise argparse.ArgumentTypeError("times must contain 1..8 finite nonnegative seconds") from None


def provenance(model, cache):
    if model == "none":
        return {"tool": "PyAV", "version": av.__version__, "profile": "subtitle-conversion", "models": []}
    from faster_whisper.utils import download_model
    model_path = Path(model)
    if not model_path.is_dir():
        model_path = Path(download_model(model, cache_dir=cache, local_files_only=True))
    models = []
    for file in sorted(model_path.iterdir()):
        if not file.is_file():
            continue
        hashed = hashlib.sha256()
        with file.open("rb") as content:
            while block := content.read(1024 * 1024):
                hashed.update(block)
        models.append({"path": str(file.resolve()), "sha256": hashed.hexdigest()})
    if not models:
        raise ValueError("no local ASR model files")
    return {"tool": "whisper-ctranslate2", "version": version("whisper-ctranslate2"),
            "profile": "cpu-int8-vad", "models": models}


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser()
    commands = parser.add_subparsers(dest="command", required=True)
    for command in ("inspect", "subtitles", "frames", "asr", "provenance"):
        subparser = commands.add_parser(command, allow_abbrev=False)
        subparser.add_argument("source")
        if command == "asr":
            subparser.add_argument("transcription_args", nargs=argparse.REMAINDER)
        elif command == "frames":
            subparser.add_argument("--output", required=True)
            subparser.add_argument("--times", type=requested_times, required=True)
            subparser.add_argument("--width", type=int, default=960)
        elif command == "provenance":
            subparser.add_argument("--cache", required=True)
    args = parser.parse_args()
    if args.command == "asr":
        # Invoke the installed CLI entry point in this process, not a model API.
        from whisper_ctranslate2.whisper_ctranslate2 import main as transcribe
        sys.argv = ["whisper-ctranslate2", args.source, *args.transcription_args]
        transcribe()
        return
    if args.command == "provenance":
        result = provenance(args.source, args.cache)
    elif args.command == "inspect":
        result = inspect(args.source)
    elif args.command == "subtitles":
        result = subtitles(args.source)
    else:
        if not 0 <= args.width <= 3840:
            parser.error("width must be 0..3840")
        result = frames(args.source, args.output, args.times, args.width)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
