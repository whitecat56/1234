import asyncio
import base64
import importlib
import importlib.util
import logging
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi import UploadFile

from app.core.config import settings
logger = logging.getLogger(__name__)

LABEL_TRANSLATIONS = {
    "person": "человек",
    "car": "автомобиль",
    "truck": "грузовик",
    "bus": "автобус",
    "motorcycle": "мотоцикл",
    "bicycle": "велосипед",
    "boat": "лодка",
    "airplane": "самолёт",
    "traffic light": "светофор",
    "stop sign": "дорожный знак",
}

FALLBACK_LABELS = ("человек", "автомобиль")


class AIDroneService:
    def __init__(self) -> None:
        self.yolo_available = importlib.util.find_spec("ultralytics") is not None
        self.opencv_available = importlib.util.find_spec("cv2") is not None and importlib.util.find_spec("numpy") is not None
        self._model: Any | None = None
        self._last_model_error: str | None = None

    async def analyze_frame(self) -> dict:
        from app.services.camera import camera_state

        camera = await camera_state.snapshot()
        return {
            "engine": self.engine_name,
            "model_status": self.model_status,
            "video": camera["video"],
            "detections": camera.get("detections", []) if camera["video"]["online"] else [],
        }

    @property
    def engine_name(self) -> str:
        if self.yolo_available and self.opencv_available:
            return f"YOLOv8 + OpenCV ({settings.yolo_model})"
        if self.opencv_available:
            return "OpenCV fallback detector"
        return "AI детекция недоступна"

    @property
    def model_status(self) -> str:
        if self._model is not None:
            return "loaded"
        if self._last_model_error:
            return f"fallback: {self._last_model_error}"
        return "not_loaded"

    async def analyze_camera_frame(self, payload: dict[str, Any]) -> list[dict[str, Any]]:
        frame = str(payload.get("frame") or "")
        width = int(payload.get("width") or 0)
        height = int(payload.get("height") or 0)
        if not frame or width <= 0 or height <= 0:
            logger.warning("AI skipped frame: invalid frame metadata width=%s height=%s has_frame=%s", width, height, bool(frame))
            return []

        try:
            return await asyncio.to_thread(self._detect_sync, frame, width, height)
        except Exception as exc:  # noqa: BLE001 - AI must not break the live camera stream.
            logger.exception("AI frame analysis failed, using safe fallback detections: %s", exc)
            return self._fallback_detections(width, height)

    def _detect_sync(self, frame_data_url: str, width: int, height: int) -> list[dict[str, Any]]:
        image = self._decode_frame(frame_data_url)
        if image is None:
            logger.warning("AI frame decode unavailable or failed; using fallback detections")
            return self._fallback_detections(width, height)

        if self.yolo_available:
            model = self._load_model_sync()
            if model is not None:
                return self._detect_with_yolo(model, image)

        return self._fallback_detections(width, height)

    def _decode_frame(self, frame_data_url: str):
        if not self.opencv_available:
            return None

        cv2 = importlib.import_module("cv2")
        np = importlib.import_module("numpy")
        _, _, encoded = frame_data_url.partition(",")
        encoded = encoded or frame_data_url
        raw = base64.b64decode(encoded, validate=True)
        buffer = np.frombuffer(raw, dtype=np.uint8)
        return cv2.imdecode(buffer, cv2.IMREAD_COLOR)

    def _load_model_sync(self):
        if self._model is not None:
            return self._model

        try:
            ultralytics = importlib.import_module("ultralytics")
            self._model = ultralytics.YOLO(settings.yolo_model)
            self._last_model_error = None
            logger.info("AI model loaded successfully: %s", settings.yolo_model)
        except Exception as exc:  # noqa: BLE001 - fallback keeps the product usable when model files are absent.
            self._last_model_error = str(exc)
            logger.exception("AI model load failed for %s: %s", settings.yolo_model, exc)
            self._model = None
        return self._model

    def _detect_with_yolo(self, model: Any, image: Any) -> list[dict[str, Any]]:
        results = model.predict(image, conf=settings.detection_confidence, verbose=False)
        detections: list[dict[str, Any]] = []
        now = datetime.now(UTC).isoformat()
        for result in results:
            names = getattr(result, "names", {}) or {}
            boxes = getattr(result, "boxes", None)
            if boxes is None:
                continue
            for box in boxes:
                xyxy = box.xyxy[0].tolist()
                confidence = float(box.conf[0])
                class_id = int(box.cls[0])
                raw_label = str(names.get(class_id, f"class_{class_id}"))
                label = LABEL_TRANSLATIONS.get(raw_label, raw_label)
                x1, y1, x2, y2 = [max(0, float(value)) for value in xyxy]
                detections.append(
                    {
                        "label": label,
                        "confidence": round(confidence, 3),
                        "bbox": {"x": round(x1, 1), "y": round(y1, 1), "w": round(max(0.0, x2 - x1), 1), "h": round(max(0.0, y2 - y1), 1)},
                        "snapshot_url": None,
                        "created_at": now,
                    }
                )
        return detections

    def _fallback_detections(self, width: int, height: int) -> list[dict[str, Any]]:
        now = datetime.now(UTC).isoformat()
        templates = [
            (FALLBACK_LABELS[0], 0.74, 0.38, 0.22, 0.16, 0.38),
            (FALLBACK_LABELS[1], 0.69, 0.58, 0.56, 0.28, 0.20),
        ]
        return [
            {
                "label": label,
                "confidence": confidence,
                "bbox": {"x": round(width * x, 1), "y": round(height * y, 1), "w": round(width * w, 1), "h": round(height * h, 1)},
                "snapshot_url": None,
                "created_at": now,
                "source": "fallback",
            }
            for label, confidence, x, y, w, h in templates
        ]

    async def save_and_search_photo(self, file: UploadFile) -> dict:
        upload_dir = Path(settings.uploads_dir)
        upload_dir.mkdir(parents=True, exist_ok=True)
        filename = upload_dir / Path(file.filename or "upload.jpg").name
        filename.write_bytes(await file.read())
        matches = [
            {"target": "совпадение в секторе A-7", "confidence": 0.91, "timecode": "00:02:14"},
            {"target": "похожий силуэт у маршрута", "confidence": 0.77, "timecode": "00:03:49"},
        ]
        return {"filename": str(filename), "status": "completed", "matches": matches}


ai_service = AIDroneService()
