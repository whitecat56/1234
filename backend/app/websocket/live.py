import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.simulator import detection_batch, latest_telemetry

router = APIRouter()


@router.websocket("/ws/live")
async def live_socket(websocket: WebSocket) -> None:
    await websocket.accept()
    tick = 1
    try:
        while True:
            await websocket.send_json(
                {
                    "type": "live_update",
                    "video": {"fps": 56 + tick % 5, "latency_ms": 24 + tick % 9, "resolution": "1920x1080"},
                    "telemetry": latest_telemetry(tick),
                    "detections": detection_batch(),
                    "route": [latest_telemetry(point) for point in range(max(1, tick - 8), tick + 1)],
                },
                mode="text",
            )
            tick += 1
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        return
