"""Locked RapidOCR API adapter: local CPU models, one PNG, real API output only."""
import argparse
from contextlib import redirect_stdout
import importlib.metadata
import json
import logging
from pathlib import Path
import sys


class InferenceWarnings(logging.Handler):
    def emit(self, record):
        # RapidOCR uses this one expected warning for a successful no-text detection.
        if record.levelno >= logging.WARNING and record.getMessage() != "The text detection result is empty":
            raise RuntimeError("OCR emitted an unexpected warning; not an empty observation")


def recognize(args):
    import cv2
    import numpy as np
    from rapidocr import RapidOCR
    from rapidocr.utils.log import logger
    from rapidocr.utils.typings import EngineType, OCRVersion, ModelType

    if importlib.metadata.version("rapidocr") != "3.10.0" or importlib.metadata.version("onnxruntime") != "1.31.0":
        raise ValueError("RapidOCR or CPU ONNX Runtime version mismatch")
    logger.addHandler(InferenceWarnings())
    png = cv2.imdecode(np.frombuffer(Path(args.input).read_bytes(), dtype=np.uint8), cv2.IMREAD_COLOR)
    if png is None:
        raise ValueError("PNG decode failed")
    height, width = png.shape[:2]
    region = json.loads(args.region) if args.region else {"x": 0, "y": 0, "width": width, "height": height}
    x, y, w, h = [region[key] for key in ("x", "y", "width", "height")]
    if not all(type(value) is int for value in (x, y, w, h)) or min(x, y) < 0 or min(w, h) <= 0 or x + w > width or y + h > height:
        raise ValueError("region must lie wholly inside the decoded PNG")
    models = Path(args.models)
    engine = RapidOCR(params={
        "Global.model_root_dir": str(models), "Global.log_level": "warning",
        "Det.model_path": str(models / "PP-OCRv6_det_small.onnx"),
        "Rec.model_path": str(models / "PP-OCRv6_rec_small.onnx"),
        "Cls.model_path": str(models / "ch_ppocr_mobile_v2.0_cls_mobile.onnx"),
        "Det.engine_type": EngineType.ONNXRUNTIME, "Rec.engine_type": EngineType.ONNXRUNTIME, "Cls.engine_type": EngineType.ONNXRUNTIME,
        "Det.ocr_version": OCRVersion.PPOCRV6, "Rec.ocr_version": OCRVersion.PPOCRV6, "Cls.ocr_version": OCRVersion.PPOCRV4,
        "Det.model_type": ModelType.SMALL, "Rec.model_type": ModelType.SMALL, "Cls.model_type": ModelType.MOBILE,
        "EngineConfig.onnxruntime.use_cuda": False, "EngineConfig.onnxruntime.use_dml": False,
        "EngineConfig.onnxruntime.use_cann": False, "EngineConfig.onnxruntime.use_coreml": False,
        "EngineConfig.onnxruntime.intra_op_num_threads": 2, "EngineConfig.onnxruntime.inter_op_num_threads": 2,
    })
    # Locked-version lazy loading must not turn missing/invalid cls or rec models into 'empty'.
    engine._load_det_model()
    engine._load_cls_model()
    engine._load_rec_model()
    result = engine(png[y:y + h, x:x + w].copy())
    if result.boxes is None and result.txts is None and result.scores is None:
        boxes, texts, scores = [], [], []
    elif any(value is None for value in (result.boxes, result.txts, result.scores)):
        raise ValueError("incomplete OCR API output")
    else:
        boxes = result.boxes.tolist()
        texts = list(result.txts)
        scores = [float(score) for score in result.scores]
    if len(boxes) != len(texts) or len(texts) != len(scores):
        raise ValueError("inconsistent OCR API output")
    boxes = [[[float(point[0]) + x, float(point[1]) + y] for point in box] for box in boxes]
    return {"width": width, "height": height, "region": region,
            "transform": {"offsetX": x, "offsetY": y, "scaleX": 1, "scaleY": 1},
            "boxes": boxes, "texts": texts, "scores": scores}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True)
    parser.add_argument("--models", required=True)
    parser.add_argument("--region")
    args = parser.parse_args()
    try:
        with redirect_stdout(sys.stderr):
            result = recognize(args)
        # -I ignores PYTHONIOENCODING; ASCII JSON is stable under Windows code pages.
        print(json.dumps(result, ensure_ascii=True, allow_nan=False))
    except Exception as error:
        print(f"RapidOCR adapter failed: {type(error).__name__}; inspect input and local model/runtime profile", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
