import math
import random
from datetime import UTC, datetime

BASE_LAT = 41.3111
BASE_LNG = 69.2797
LABELS = ["человек", "автомобиль", "антенна", "здание", "тепловая цель"]


def latest_telemetry(tick: int = 1) -> dict:
    return {
        "speed": round(62 + math.sin(tick / 4) * 12, 1),
        "altitude": round(128 + math.cos(tick / 5) * 24, 1),
        "battery": max(18, round(93 - tick * 0.35, 1)),
        "signal": round(91 + math.sin(tick / 3) * 6, 1),
        "distance": round(1.2 + tick * 0.06, 2),
        "heading": round((tick * 11) % 360, 1),
        "lat": BASE_LAT + math.sin(tick / 12) * 0.012,
        "lng": BASE_LNG + math.cos(tick / 12) * 0.012,
        "created_at": datetime.now(UTC),
    }


def detection_batch() -> list[dict]:
    return [
        {
            "label": random.choice(LABELS),
            "confidence": round(random.uniform(0.72, 0.98), 2),
            "bbox": {"x": random.randint(80, 640), "y": random.randint(40, 320), "w": random.randint(90, 220), "h": random.randint(80, 180)},
            "snapshot_url": None,
            "created_at": datetime.now(UTC),
        }
        for _ in range(random.randint(2, 5))
    ]


def history_points() -> list[dict]:
    return [latest_telemetry(index) for index in range(1, 36)]
