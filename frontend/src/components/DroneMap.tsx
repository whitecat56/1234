import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { memo, useEffect, useMemo, useState } from 'react';
import type { Telemetry } from '../api/live';
import type { MissionState } from '../mission';
import type { TrackedDetection } from './VideoPanel';

type DroneMapProps = {
  telemetry: Telemetry;
  route: Telemetry[];
  detections: TrackedDetection[];
  mission: MissionState;
  selectedDetectionId?: string | null;
  onSelectDetection?: (id: string) => void;
};

const isCoordinate = (lat: number | null, lng: number | null): lat is number => typeof lat === 'number' && Number.isFinite(lat) && typeof lng === 'number' && Number.isFinite(lng);

function MapFollower({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.setView(center, map.getZoom(), { animate: true }); }, [center, map]);
  return null;
}

function ClickToCenter({ onCenter }: { onCenter: (center: [number, number]) => void }) {
  const map = useMapEvents({
    click(event: { latlng: { lat: number; lng: number } }) {
      const nextCenter: [number, number] = [event.latlng.lat, event.latlng.lng];
      onCenter(nextCenter);
      map.setView(event.latlng, map.getZoom(), { animate: true });
    },
  });
  return null;
}

const targetPoint = (center: [number, number], telemetry: Telemetry, item: TrackedDetection, index: number): [number, number] | null => {
  const lastGeo = item.geoHistory.at(-1) ?? item.world_position;
  if (lastGeo && isCoordinate(lastGeo.lat, lastGeo.lng)) return [lastGeo.lat, lastGeo.lng];
  if (typeof item.distanceMeters !== 'number') return null;
  const bearing = ((telemetry.heading ?? 0) + index * 18) * (Math.PI / 180);
  return [center[0] + Math.cos(bearing) * item.distanceMeters * 0.000009, center[1] + Math.sin(bearing) * item.distanceMeters * 0.000012];
};

function DroneMapComponent({ telemetry, route, detections, mission, selectedDetectionId, onSelectDetection }: DroneMapProps) {
  const [mode, setMode] = useState<'tactical' | 'satellite'>('tactical');
  const [manualCenter, setManualCenter] = useState<[number, number] | null>(null);
  const hasGps = isCoordinate(telemetry.lat, telemetry.lng);
  const center = useMemo<[number, number]>(() => (hasGps ? [telemetry.lat as number, telemetry.lng as number] : [41.3111, 69.2797]), [hasGps, telemetry.lat, telemetry.lng]);
  const selectedIndex = Math.max(0, detections.findIndex((item) => item.uid === selectedDetectionId));
  const focusCenter = useMemo<[number, number]>(() => {
    if (manualCenter) return manualCenter;
    if (!hasGps || !selectedDetectionId || !detections[selectedIndex]) return center;
    return targetPoint(center, telemetry, detections[selectedIndex], selectedIndex) ?? center;
  }, [center, detections, hasGps, manualCenter, selectedDetectionId, selectedIndex, telemetry]);
  const path = useMemo(
    () => route.filter((point) => isCoordinate(point.lat, point.lng)).map((point) => [point.lat as number, point.lng as number] as [number, number]),
    [route],
  );
  const missionPath = useMemo(() => mission.waypoints.map((point) => [point.lat, point.lng] as [number, number]), [mission.waypoints]);

  return (
    <section className="gcs-panel map-panel" aria-label="Map panel">
      <header className="panel-header compact map-header">
        <div>
          <p className="panel-eyebrow">TACTICAL MAP · GEO FENCE</p>
          <h2>{mode === 'satellite' ? 'Satellite Operations View' : 'Tactical Operations View'}</h2>
        </div>
        <div className="map-actions">
          <button type="button" className={mode === 'tactical' ? 'active' : ''} onClick={() => setMode('tactical')}>Tactical</button>
          <button type="button" className={mode === 'satellite' ? 'active' : ''} onClick={() => setMode('satellite')}>Satellite</button>
          <button type="button" onClick={() => setManualCenter(null)}>Center UAV</button>
          <span className={hasGps ? 'map-fix online' : 'map-fix'}>{hasGps ? 'GPS LOCK' : 'NO GPS DATA'}</span>
        </div>
      </header>
      <div className={`map-canvas ${mode}`}>
        {!hasGps ? <div className="map-no-gps">DEMO MAP · NO LIVE GPS</div> : null}
        <MapContainer center={focusCenter} zoom={15} scrollWheelZoom className="leaflet-shell">
          <MapFollower center={focusCenter} />
          <ClickToCenter onCenter={setManualCenter} />
          <TileLayer attribution="&copy; OpenStreetMap contributors" url={mode === 'satellite' ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'} />
          {path.length > 1 ? <Polyline positions={path} pathOptions={{ color: '#00ffd5', weight: 4, opacity: 0.9 }} /> : null}
          {missionPath.length > 1 ? <Polyline positions={missionPath} pathOptions={{ color: '#ffc107', weight: 3, opacity: 0.95, dashArray: '8 8' }} /> : null}
          {mission.geoFences.map((zone) => <Polyline key={zone.id} positions={[...zone.points, zone.points[0]]} pathOptions={{ color: zone.level === 'restricted' ? '#ff3b3b' : '#ffc107', weight: 3, opacity: 0.92 }}><Popup>{zone.name} · {zone.level}</Popup></Polyline>)}
          {mission.waypoints.map((point, index) => <CircleMarker key={point.id} center={[point.lat, point.lng]} radius={7} pathOptions={{ color: '#ffc107', fillColor: '#ffc107', fillOpacity: 0.9 }}><Popup>Mission waypoint {index + 1} · {point.name}</Popup></CircleMarker>)}
          {mission.pois.map((point) => <CircleMarker key={point.id} center={[point.lat, point.lng]} radius={8} pathOptions={{ color: '#b86cff', fillColor: '#b86cff', fillOpacity: 0.9 }}><Popup>Point of interest · {point.name}</Popup></CircleMarker>)}
          {hasGps ? (
            <CircleMarker center={center} radius={11} pathOptions={{ color: '#00ffd5', fillColor: '#00ffd5', fillOpacity: 0.95, weight: 2 }}>
              <Popup>Current drone position</Popup>
            </CircleMarker>
          ) : null}
          {detections.map((item, index) => {
            const point = targetPoint(center, telemetry, item, index);
            const trail = item.geoHistory.map((history) => [history.lat, history.lng] as [number, number]);
            return [
              trail.length > 1 ? <Polyline key={`${item.uid}-trail`} positions={trail} pathOptions={{ color: item.color, weight: selectedDetectionId === item.uid ? 4 : 2, opacity: 0.84 }} /> : null,
              point ? (
                <CircleMarker
                  key={`${item.uid}-marker`}
                  center={point}
                  radius={selectedDetectionId === item.uid ? 12 : 8}
                  eventHandlers={{ click: () => { onSelectDetection?.(item.uid); setManualCenter(point); } }}
                  pathOptions={{ color: item.color, fillColor: item.color, fillOpacity: item.isPredicted ? 0.38 : 0.86, weight: selectedDetectionId === item.uid ? 4 : 2 }}
                >
                  <Popup>{item.trackId} · {item.displayLabel} · {item.threatLevel} · {Math.round(item.confidence * 100)}% · RNG {item.distanceMeters !== null ? `${item.distanceMeters}m` : '—'}</Popup>
                </CircleMarker>
              ) : null,
            ];
          })}
        </MapContainer>
        <div className="map-legend"><span><i className="uav" /> UAV</span><span><i className="target" /> tracked target</span><span><i className="route" /> route</span><span><i className="danger" /> geo fence</span><span>Click map to center</span></div>
      </div>
    </section>
  );
}

export const DroneMap = memo(DroneMapComponent);
