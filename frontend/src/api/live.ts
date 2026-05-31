export type Telemetry = {
  speed: number;
  altitude: number;
  battery: number;
  signal: number;
  distance: number;
  heading: number;
  lat: number;
  lng: number;
  created_at: string;
};

export type Detection = {
  label: string;
  confidence: number;
  bbox: { x: number; y: number; w: number; h: number };
  snapshot_url?: string | null;
  created_at: string;
};

export type VideoState = {
  online: boolean;
  frame: string | null;
  fps: number;
  latency_ms: number;
  resolution: string;
  width?: number;
  height?: number;
  last_seen?: string | null;
};

export type LiveUpdate = {
  type: 'live_update';
  video: VideoState;
  telemetry: Telemetry;
  detections: Detection[];
  route: Telemetry[];
};

export type CameraFrame = {
  type: 'camera_frame' | 'camera_status';
  video: VideoState;
};

export type LiveMessage = LiveUpdate | CameraFrame;

export const emptyTelemetry = (): Telemetry => ({
  speed: 0,
  altitude: 0,
  battery: 0,
  signal: 0,
  distance: 0,
  heading: 0,
  lat: 41.3111,
  lng: 69.2797,
  created_at: new Date().toISOString(),
});

export const emptyLiveUpdate = (): LiveUpdate => ({
  type: 'live_update',
  video: { online: false, frame: null, fps: 0, latency_ms: 0, resolution: 'offline', width: 0, height: 0, last_seen: null },
  telemetry: emptyTelemetry(),
  detections: [],
  route: [],
});

export const liveWebSocketUrl = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const backendHost = import.meta.env.VITE_BACKEND_WS_HOST ?? `${window.location.hostname}:8000`;
  return `${protocol}//${backendHost}/ws/live`;
};
