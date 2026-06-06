import type { Telemetry } from './api/live';
import type { TrackedDetection } from './components/VideoPanel';

export type MissionPoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  kind: 'waypoint' | 'poi';
  createdAt: string;
};

export type GeoFence = {
  id: string;
  name: string;
  level: 'warning' | 'restricted';
  points: [number, number][];
  createdAt: string;
};

export type MissionState = {
  id: string;
  name: string;
  createdAt: string;
  waypoints: MissionPoint[];
  pois: MissionPoint[];
  geoFences: GeoFence[];
};

const timestampId = (prefix: string) => `${prefix}-${Date.now().toString(36)}`;

export const createMission = (): MissionState => ({
  id: timestampId('mission'),
  name: 'UZ-GCS DEMO MISSION',
  createdAt: new Date().toISOString(),
  waypoints: [],
  pois: [],
  geoFences: [],
});

export const hasCoordinate = (lat: number | null, lng: number | null): lat is number => typeof lat === 'number' && Number.isFinite(lat) && typeof lng === 'number' && Number.isFinite(lng);

export const missionPointFromTelemetry = (telemetry: Telemetry, kind: MissionPoint['kind'], name: string): MissionPoint | null => {
  if (!hasCoordinate(telemetry.lat, telemetry.lng)) return null;
  return { id: timestampId(kind), name, lat: telemetry.lat, lng: telemetry.lng as number, kind, createdAt: new Date().toISOString() };
};

export const missionPointFromDetection = (target: TrackedDetection | undefined, name: string): MissionPoint | null => {
  const last = target?.geoHistory?.at(-1) ?? target?.world_position;
  if (!last || !hasCoordinate(last.lat, last.lng)) return null;
  return { id: timestampId('poi'), name, lat: last.lat, lng: last.lng, kind: 'poi', createdAt: new Date().toISOString() };
};

export const geoFenceAroundTelemetry = (telemetry: Telemetry, name: string): GeoFence | null => {
  if (!hasCoordinate(telemetry.lat, telemetry.lng)) return null;
  const lat = telemetry.lat;
  const lng = telemetry.lng as number;
  return {
    id: timestampId('zone'),
    name,
    level: 'restricted',
    createdAt: new Date().toISOString(),
    points: [
      [lat + 0.0024, lng - 0.0022],
      [lat + 0.0038, lng + 0.0018],
      [lat - 0.0004, lng + 0.0031],
      [lat - 0.0028, lng - 0.0013],
    ],
  };
};
