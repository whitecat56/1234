"""Send frames from the Windows host webcam to the backend WebSocket.

Run this script on the host OS, not inside Docker, when the backend container
cannot see /dev/video* or a Windows laptop camera directly.
"""

import argparse
import asyncio
import base64
import json
import logging
import time

import cv2
import websockets

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("local-camera-client")


def encode_frame(frame, jpeg_quality: int) -> str | None:
    ok, buffer = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), jpeg_quality])
    if not ok:
        return None
    return "data:image/jpeg;base64," + base64.b64encode(buffer).decode("ascii")


async def stream_camera(url: str, camera_index: int, fps: float, jpeg_quality: int) -> None:
    delay = 1.0 / max(fps, 1.0)

    while True:
        capture = cv2.VideoCapture(camera_index)
        if not capture.isOpened():
            logger.error("CAMERA OFFLINE: cannot open VideoCapture(%s). Retrying in 2 seconds...", camera_index)
            capture.release()
            await asyncio.sleep(2)
            continue

        logger.info("LOCAL CAMERA MODE: VideoCapture(%s) opened. Connecting to %s", camera_index, url)
        try:
            async with websockets.connect(url, max_size=None, ping_interval=20, ping_timeout=10, close_timeout=5) as websocket:
                logger.info("Backend camera WebSocket connected")
                previous = time.perf_counter()
                while True:
                    ok, frame = capture.read()
                    if not ok:
                        logger.error("CAMERA OFFLINE: failed to read frame. Reopening camera...")
                        break

                    now = time.perf_counter()
                    current_fps = 1.0 / max(now - previous, 0.001)
                    previous = now

                    encoded = encode_frame(frame, jpeg_quality)
                    if encoded is None:
                        continue

                    height, width = frame.shape[:2]
                    await websocket.send(
                        json.dumps(
                            {
                                "type": "camera_frame",
                                "frame": encoded,
                                "width": width,
                                "height": height,
                                "fps": current_fps,
                                "created_at": time.time(),
                            }
                        )
                    )
                    await asyncio.sleep(delay)
        except Exception as exc:  # noqa: BLE001 - keep host camera process alive and reconnect.
            logger.exception("Backend connection lost: %s. Retrying in 2 seconds...", exc)
            await asyncio.sleep(2)
        finally:
            capture.release()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Local Camera Mode host client")
    parser.add_argument("--url", default="ws://localhost:8000/ws/camera", help="Backend camera ingest WebSocket URL")
    parser.add_argument("--camera", type=int, default=0, help="OpenCV camera index for VideoCapture(index)")
    parser.add_argument("--fps", type=float, default=15.0, help="Maximum frames per second sent to backend")
    parser.add_argument("--quality", type=int, default=75, help="JPEG quality from 1 to 100")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    asyncio.run(stream_camera(args.url, args.camera, args.fps, args.quality))
