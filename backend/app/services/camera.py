import asyncio
import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from app.core.config import settings

CAMERA_ONLINE = "CAMERA_ONLINE"
CAMERA_OFFLINE = "CAMERA_OFFLINE"

logger = logging.getLogger(__name__)


class LocalCameraState:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._latest_frame: dict[str, Any] | None = None
        self._last_seen: datetime | None = None
        self._frame_count = 0

    async def update_frame(self, payload: dict[str, Any], detections: list[dict[str, Any]] | None = None) -> dict[str, Any]:
        now = datetime.now(UTC)
        width = int(payload.get("width") or 0)
        height = int(payload.get("height") or 0)
        frame = str(payload.get("frame") or "")
        fps = float(payload.get("fps") or 0)
        created_at = float(payload.get("created_at") or 0)
        latency_ms = max(0, round((now.timestamp() - created_at) * 1000)) if created_at > 0 else 0

        async with self._lock:
            self._frame_count += 1
            frame_number = self._frame_count

        frame_payload = {
            "type": "camera_frame",
            "camera_status": CAMERA_ONLINE,
            "video": {
                "online": True,
                "status": CAMERA_ONLINE,
                "frame": frame,
                "width": width,
                "height": height,
                "fps": round(fps, 1),
                "latency_ms": latency_ms,
                "resolution": f"{width}x{height}" if width and height else "unknown",
                "last_seen": now.isoformat(),
                "frame_number": frame_number,
            },
            "detections": detections or [],
        }
        async with self._lock:
            self._latest_frame = frame_payload
            self._last_seen = now
        logger.debug(
            "Camera frame accepted: frame=%s size=%sx%s fps=%.1f latency_ms=%s detections=%s",
            frame_number,
            width,
            height,
            fps,
            latency_ms,
            len(detections or []),
        )
        return frame_payload

    async def snapshot(self) -> dict[str, Any]:
        async with self._lock:
            latest_frame = self._latest_frame
            last_seen = self._last_seen

        online = last_seen is not None and datetime.now(UTC) - last_seen <= timedelta(seconds=settings.camera_offline_after_seconds)
        if online and latest_frame is not None:
            return latest_frame

        return {
            "type": "camera_status",
            "camera_status": CAMERA_OFFLINE,
            "video": {
                "online": False,
                "status": CAMERA_OFFLINE,
                "frame": None,
                "width": 0,
                "height": 0,
                "fps": 0,
                "latency_ms": 0,
                "resolution": "offline",
                "last_seen": last_seen.isoformat() if last_seen else None,
                "frame_number": 0,
            },
            "detections": [],
        }

    async def offline_payload(self, reason: str = "camera websocket disconnected") -> dict[str, Any]:
        logger.warning("Camera marked offline: %s", reason)
        async with self._lock:
            self._last_seen = None
            self._latest_frame = None
        return await self.snapshot()


class LiveClientHub:
    def __init__(self) -> None:
        self._clients: set[asyncio.Queue[dict[str, Any]]] = set()
        self._lock = asyncio.Lock()

    async def register(self) -> asyncio.Queue[dict[str, Any]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=3)
        async with self._lock:
            self._clients.add(queue)
            logger.info("Live WebSocket client connected. clients=%s", len(self._clients))
        return queue

    async def unregister(self, queue: asyncio.Queue[dict[str, Any]]) -> None:
        async with self._lock:
            self._clients.discard(queue)
            logger.info("Live WebSocket client disconnected. clients=%s", len(self._clients))

    async def broadcast(self, message: dict[str, Any]) -> None:
        async with self._lock:
            clients = list(self._clients)

        for queue in clients:
            if queue.full():
                try:
                    queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass
            try:
                queue.put_nowait(message)
            except asyncio.QueueFull:
                logger.warning("Dropped live message because a client queue stayed full")


camera_state = LocalCameraState()
live_hub = LiveClientHub()
