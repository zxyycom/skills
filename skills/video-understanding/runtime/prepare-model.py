"""Explicit network preparation; the video CLI uses the resulting model cache offline."""

import argparse
import os
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True, help="Whisper model name, for example small")
    args = parser.parse_args()
    cache = Path(__file__).resolve().parent / "cache" / "huggingface"
    os.environ["HF_HOME"] = str(cache)
    os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
    os.environ["HF_HUB_DISABLE_IMPLICIT_TOKEN"] = "true"
    os.environ.pop("HF_HUB_OFFLINE", None)

    try:
        from faster_whisper.utils import download_model

        location = download_model(args.model, cache_dir=str(cache / "hub"))
    except Exception as error:
        print(
            f"Model preparation failed ({type(error).__name__}); "
            "check the application venv, network, and model cache permissions.",
            file=sys.stderr,
        )
        return 1
    print(f"Model {args.model} prepared: {Path(location).name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
