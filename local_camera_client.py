"""Send frames from the Windows host webcam to the backend WebSocket.

Run this script on the host OS, not inside Docker, when the backend container
cannot see /dev/video* or a Windows laptop camera directly.
"""

import argparse
import asyncio
import base64
import json
import time

import cv2
import websockets


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
            print(f"CAMERA OFFLINE: cannot open VideoCapture({camera_index}). Retrying in 2 seconds...")
            capture.release()
            await asyncio.sleep(2)
            continue

        print(f"LOCAL CAMERA MODE: VideoCapture({camera_index}) opened. Connecting to {url}")
        try:
            async with websockets.connect(url, max_size=None) as websocket:
                previous = time.perf_counter()
                while True:
                    ok, frame = capture.read()
                    if not ok:
                        print("CAMERA OFFLINE: failed to read frame. Reopening camera...")
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
            print(f"Backend connection lost: {exc}. Retrying in 2 seconds...")
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
