"""Explicit online preparation of independent OCR slots; never called by video.ts."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import urllib.request
import venv


def sha256(file):
    with file.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def download(url, target, expected):
    target.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=120) as response, target.open("xb") as out:
        while data := response.read(1024 * 1024):
            out.write(data)
    if sha256(target) != expected:
        raise ValueError(f"Downloaded SHA256 mismatch: {target}")


def inventory(root, paths):
    return [{"path": file.relative_to(root).as_posix(), "sha256": sha256(file)} for file in sorted(paths)]


def prepare_videocr(root, profile, extractor):
    archive = root / "downloads" / "videocr.7z"
    download(profile["archive"]["url"], archive, profile["archive"]["sha256"])
    package = root / "package"
    package.mkdir()
    subprocess.run([extractor, "-xf", str(archive), "-C", str(package)], check=True)
    candidates = list(package.rglob("videocr-cli.exe"))
    if len(candidates) != 1:
        raise ValueError("Archive must contain exactly one videocr-cli.exe")
    program = candidates[0]
    models = program.parent / "PaddleOCR.PP-OCRv6.support.files"
    required = [models / "det" / "PP-OCRv6_small_det", models / "rec" / "PP-OCRv6_small_rec"]
    files = []
    for directory in required:
        found = list(directory.rglob("*"))
        files.extend(file for file in found if file.is_file())
        if not any(file.name == "inference.json" for file in found) or not any(file.suffix == ".pdiparams" for file in found):
            raise ValueError(f"Missing Paddle model: {directory}")
    # Hash all shipped executables and native libraries as the frozen application's dependency inventory.
    binaries = [file for file in package.rglob("*") if file.is_file() and file.suffix.lower() in {".exe", ".dll", ".pyd"}]
    return {"program": program.relative_to(root).as_posix(), "models": inventory(root, files),
            "dependencies": inventory(root, binaries), "archive": profile["archive"]}


def prepare_rapidocr(root, profile, source):
    if sys.version_info[:2] != (3, 12):
        raise ValueError("RapidOCR preparation requires Windows Python 3.12")
    venv.EnvBuilder(with_pip=True).create(root / "venv")
    python = root / "venv" / "Scripts" / "python.exe"
    env = os.environ.copy()
    env["PIP_CACHE_DIR"] = str(root / "cache" / "pip")
    env["PIP_CONFIG_FILE"] = os.devnull
    requirements = source / "rapidocr-requirements-lock.txt"
    if not requirements.is_file():
        raise FileNotFoundError("Missing complete RapidOCR dependency hash lock")
    command = [str(python), "-I", "-m", "pip", "install", "--index-url", "https://pypi.org/simple",
               "--report", str(root / "pip-report.json"), "-r", str(requirements)]
    command.extend(["--require-hashes", "--only-binary=:all:"])
    subprocess.run(command, env=env, check=True)
    for model in profile["models"]:
        download(model["url"], root / model["path"], model["sha256"])
    return {"program": "venv/Scripts/python.exe", "models": profile["models"],
            "dependencies": json.loads((root / "pip-report.json").read_text(encoding="utf-8"))["install"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--app-root", required=True)
    parser.add_argument("--tool", choices=["videocr", "rapidocr"], required=True)
    parser.add_argument("--extractor", help="absolute path to existing Windows tar.exe for VideOCR's 7z archive")
    args = parser.parse_args()
    if sys.platform != "win32":
        raise ValueError("Only Windows x64 OCR preparation is supported")
    app = Path(args.app_root)
    if not app.is_absolute() or not app.is_dir():
        raise ValueError("app-root must be an existing absolute local directory")
    source = Path(__file__).resolve().parent
    profile = json.loads((source / "ocr-profiles.json").read_text(encoding="utf-8"))[args.tool]
    root = app / "tools" / args.tool / profile["version"]
    if root.exists():
        raise FileExistsError(f"Preserve existing slot; preparation refuses overwrite: {root}")
    if args.tool == "videocr" and (not args.extractor or not Path(args.extractor).is_absolute()):
        raise ValueError("VideOCR preparation requires an explicit existing tar.exe")
    root.mkdir(parents=True)
    details = prepare_videocr(root, profile, args.extractor) if args.tool == "videocr" else prepare_rapidocr(root, profile, source)
    manifest = {"tool": args.tool, "version": profile["version"], "profile": profile["profile"], **details}
    with (root / "installation.json").open("x", encoding="utf-8") as out:
        json.dump(manifest, out, ensure_ascii=False, indent=2)
    print(f"Prepared {args.tool} slot: {root}; installation is not OCR qualification")


if __name__ == "__main__":
    main()
