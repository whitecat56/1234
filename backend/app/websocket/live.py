import asyncio
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.ai_service import ai_service
from app.services.camera import camera_state, live_hub
from app.services.simulator import latest_telemetry

router = APIRouter()
logger = logging.getLogger(__name__)


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
        logger.info("Live WebSocket disconnected by browser")
    except Exception as exc:  # noqa: BLE001 - log details for broken realtime sessions.
        logger.exception("Live WebSocket failed: %s", exc)
    finally:
        await live_hub.unregister(queue)


@router.websocket("/ws/camera")
async def camera_socket(websocket: WebSocket) -> None:
    await websocket.accept()
    logger.info("Camera ingest WebSocket connected")
    try:
        while True:
            payload = await websocket.receive_json()
            if payload.get("type") != "camera_frame" or not payload.get("frame"):
                logger.warning("Camera ingest ignored invalid payload keys=%s", sorted(payload.keys()))
                continue
            detections = await ai_service.analyze_camera_frame(payload)
            camera_message = await camera_state.update_frame(payload, detections)
            await live_hub.broadcast(camera_message)
    except WebSocketDisconnect:
        logger.warning("Camera ingest WebSocket disconnected")
        await live_hub.broadcast(await camera_state.offline_payload())
    except Exception as exc:  # noqa: BLE001 - camera client will reconnect; backend must keep running.
        logger.exception("Camera ingest WebSocket failed: %s", exc)
        await live_hub.broadcast(await camera_state.offline_payload(str(exc)))


async def build_live_update(tick: int) -> dict:
    camera = await camera_state.snapshot()
    return {
        "type": "live_update",
        "camera_status": camera["camera_status"],
        "video": camera["video"],
        "telemetry": latest_telemetry(tick),
        "detections": camera.get("detections", []) if camera["video"]["online"] else [],
        "route": [latest_telemetry(point) for point in range(max(1, tick - 8), tick + 1)],
        "ai": {"engine": ai_service.engine_name, "model_status": ai_service.model_status},
    }
