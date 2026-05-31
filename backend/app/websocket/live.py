import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.camera import camera_state, live_hub
from app.services.simulator import detection_batch, latest_telemetry

router = APIRouter()


@router.websocket("/ws/live")
async def live_socket(websocket: WebSocket) -> None:
    await websocket.accept()
    queue = await live_hub.register()
    tick = 1
    try:
        await websocket.send_json(await build_live_update(tick), mode="text")
        while True:
            try:
                camera_message = await asyncio.wait_for(queue.get(), timeout=1)
                await websocket.send_json(camera_message, mode="text")
            except asyncio.TimeoutError:
                tick += 1
                await websocket.send_json(await build_live_update(tick), mode="text")
    except WebSocketDisconnect:
        return
    finally:
        await live_hub.unregister(queue)


@router.websocket("/ws/camera")
async def camera_socket(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            payload = await websocket.receive_json()
            if payload.get("type") != "camera_frame" or not payload.get("frame"):
                continue
            camera_message = await camera_state.update_frame(payload)
            await live_hub.broadcast(camera_message)
    except WebSocketDisconnect:
        await live_hub.broadcast(await camera_state.offline_payload())


async def build_live_update(tick: int) -> dict:
    camera = await camera_state.snapshot()
    return {
        "type": "live_update",
        "video": camera["video"],
        "telemetry": latest_telemetry(tick),
        "detections": detection_batch(),
        "route": [latest_telemetry(point) for point in range(max(1, tick - 8), tick + 1)],
    }
