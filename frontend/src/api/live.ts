export type Telemetry = {
  speed: number | null;
  altitude: number | null;
  battery: number | null;
  signal: number | null;
  distance: number | null;
  heading: number | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
};

export type Detection = {
  label: string;
  confidence: number;
  bbox?: { x: number; y: number; w: number; h: number } | null;
  snapshot_url?: string | null;
  created_at: string;
  source?: string;
};

export type CameraStatus = 'CAMERA_ONLINE' | 'CAMERA_OFFLINE';

export type VideoState = {
  online: boolean;
  status: CameraStatus;
  frame: string | null;
  fps: number;
  latency_ms: number;
  resolution: string;
  width?: number;
  height?: number;
  last_seen?: string | null;
  frame_number?: number;
};

export type AiState = {
  engine: string;
  model_status: string;
};

export type LiveUpdate = {
  type: 'live_update';
  camera_status: CameraStatus;
  video: VideoState;
  telemetry: Telemetry;
  detections: Detection[];
  route: Telemetry[];
  ai?: AiState;
};

export type CameraFrame = {
  type: 'camera_frame' | 'camera_status';
  camera_status: CameraStatus;
  video: VideoState;
  detections?: Detection[];
};

export type LiveMessage = LiveUpdate | CameraFrame;

export const emptyTelemetry = (): Telemetry => ({
  speed: null,
  altitude: null,
  battery: null,
  signal: null,
  distance: null,
  heading: null,
  lat: null,
  lng: null,
  created_at: '',
});

export const emptyLiveUpdate = (): LiveUpdate => ({
  type: 'live_update',
  camera_status: 'CAMERA_OFFLINE',
  video: { online: false, status: 'CAMERA_OFFLINE', frame: null, fps: 0, latency_ms: 0, resolution: 'offline', width: 0, height: 0, last_seen: null, frame_number: 0 },
  telemetry: emptyTelemetry(),
  detections: [],
  route: [],
  ai: { engine: 'unknown', model_status: 'not_loaded' },
});

export const liveWebSocketUrl = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const backendHost = import.meta.env.VITE_BACKEND_WS_HOST ?? `${window.location.hostname}:8000`;
  return `${protocol}//${backendHost}/ws/live`;
};
