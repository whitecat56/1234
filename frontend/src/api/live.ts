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

export type LiveUpdate = {
  type: 'live_update';
  video: { fps: number; latency_ms: number; resolution: string };
  telemetry: Telemetry;
  detections: Detection[];
  route: Telemetry[];
};

export const demoUpdate = (tick: number): LiveUpdate => {
  const now = new Date().toISOString();
  const telemetry = {
    speed: Number((62 + Math.sin(tick / 4) * 12).toFixed(1)),
    altitude: Number((128 + Math.cos(tick / 5) * 24).toFixed(1)),
    battery: Math.max(18, Number((93 - tick * 0.28).toFixed(1))),
    signal: Number((91 + Math.sin(tick / 3) * 6).toFixed(1)),
    distance: Number((1.2 + tick * 0.06).toFixed(2)),
    heading: Number(((tick * 11) % 360).toFixed(1)),
    lat: 41.3111 + Math.sin(tick / 12) * 0.012,
    lng: 69.2797 + Math.cos(tick / 12) * 0.012,
    created_at: now,
  };

  return {
    type: 'live_update',
    video: { fps: 56 + (tick % 5), latency_ms: 24 + (tick % 9), resolution: '1920x1080' },
    telemetry,
    detections: ['человек', 'автомобиль', 'антенна', 'тепловая цель'].map((label, index) => ({
      label,
      confidence: Number((0.72 + ((tick + index) % 20) / 100).toFixed(2)),
      bbox: { x: 120 + index * 150, y: 90 + index * 45, w: 130, h: 92 },
      snapshot_url: null,
      created_at: now,
    })),
    route: Array.from({ length: 12 }, (_, index) => ({ ...telemetry, lat: telemetry.lat + index * 0.0008, lng: telemetry.lng - index * 0.0006 })),
  };
};
