import asyncio
from datetime import UTC, datetime, timedelta
from typing import Any

CAMERA_OFFLINE_AFTER_SECONDS = 3


class LocalCameraState:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._latest_frame: dict[str, Any] | None = None
        self._last_seen: datetime | None = None

    async def update_frame(self, payload: dict[str, Any]) -> dict[str, Any]:
        now = datetime.now(UTC)
        width = int(payload.get("width") or 0)
        height = int(payload.get("height") or 0)
        frame = str(payload.get("frame") or "")
        fps = float(payload.get("fps") or 0)

        frame_payload = {
            "type": "camera_frame",
            "video": {
                "online": True,
                "frame": frame,
                "width": width,
                "height": height,
                "fps": round(fps, 1),
                "latency_ms": 0,
                "resolution": f"{width}x{height}" if width and height else "unknown",
                "last_seen": now.isoformat(),
            },
        }
        async with self._lock:
            self._latest_frame = frame_payload
            self._last_seen = now
        return frame_payload

    async def snapshot(self) -> dict[str, Any]:
        async with self._lock:
            latest_frame = self._latest_frame
            last_seen = self._last_seen

        online = last_seen is not None and datetime.now(UTC) - last_seen <= timedelta(seconds=CAMERA_OFFLINE_AFTER_SECONDS)
        if online and latest_frame is not None:
            return latest_frame

        return {
            "type": "camera_status",
            "video": {
                "online": False,
                "frame": None,
                "width": 0,
                "height": 0,
                "fps": 0,
                "latency_ms": 0,
                "resolution": "offline",
                "last_seen": last_seen.isoformat() if last_seen else None,
            },
        }

    async def offline_payload(self) -> dict[str, Any]:
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
        return queue

    async def unregister(self, queue: asyncio.Queue[dict[str, Any]]) -> None:
        async with self._lock:
            self._clients.discard(queue)

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
                pass


camera_state = LocalCameraState()
live_hub = LiveClientHub()
