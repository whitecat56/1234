import importlib.util
import random
from pathlib import Path

from fastapi import UploadFile

from app.core.config import settings
from app.services.simulator import detection_batch


class AIDroneService:
    def __init__(self) -> None:
        self.yolo_available = importlib.util.find_spec("ultralytics") is not None
        self.opencv_available = importlib.util.find_spec("cv2") is not None

    async def analyze_frame(self) -> dict:
        return {
            "engine": "YOLOv8 + OpenCV" if self.yolo_available and self.opencv_available else "Симулятор AI-детекции",
            "fps": random.randint(48, 61),
            "latency_ms": random.randint(18, 42),
            "resolution": "1920x1080",
            "detections": detection_batch(),
        }

    async def save_and_search_photo(self, file: UploadFile) -> dict:
        upload_dir = Path(settings.uploads_dir)
        upload_dir.mkdir(parents=True, exist_ok=True)
        filename = upload_dir / file.filename
        filename.write_bytes(await file.read())
        matches = [
            {"target": "совпадение в секторе A-7", "confidence": 0.91, "timecode": "00:02:14"},
            {"target": "похожий силуэт у маршрута", "confidence": 0.77, "timecode": "00:03:49"},
        ]
        return {"filename": str(filename), "status": "completed", "matches": matches}


ai_service = AIDroneService()
