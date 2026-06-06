import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import { memo, useEffect, useMemo, useState } from 'react';
import type { Telemetry } from '../api/live';
import type { TrackedDetection } from './VideoPanel';

type DroneMapProps = {
  telemetry: Telemetry;
  route: Telemetry[];
  detections: TrackedDetection[];
  selectedDetectionId?: string | null;
  onSelectDetection?: (id: string) => void;
};

const isCoordinate = (lat: number | null, lng: number | null): lat is number => typeof lat === 'number' && Number.isFinite(lat) && typeof lng === 'number' && Number.isFinite(lng);

function MapFollower({ center }: { center: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);

  return null;
}

function DroneMapComponent({ telemetry, route, detections, selectedDetectionId, onSelectDetection }: DroneMapProps) {
  const [mode, setMode] = useState<'tactical' | 'satellite'>('tactical');
  const hasGps = isCoordinate(telemetry.lat, telemetry.lng);
  const center = useMemo<[number, number]>(() => (hasGps ? [telemetry.lat as number, telemetry.lng as number] : [41.3111, 69.2797]), [hasGps, telemetry.lat, telemetry.lng]);
  const selectedIndex = Math.max(0, detections.findIndex((item) => item.uid === selectedDetectionId));
  const selectedOffset = detections[selectedIndex]?.distanceMeters ?? 120;
  const focusCenter = useMemo<[number, number]>(() => {
    if (!hasGps || !selectedDetectionId) return center;
    const bearing = ((telemetry.heading ?? 0) + selectedIndex * 18) * (Math.PI / 180);
    return [center[0] + Math.cos(bearing) * selectedOffset * 0.000009, center[1] + Math.sin(bearing) * selectedOffset * 0.000012];
  }, [center, hasGps, selectedDetectionId, selectedIndex, selectedOffset, telemetry.heading]);
  const path = useMemo(
    () => route.filter((point) => isCoordinate(point.lat, point.lng)).map((point) => [point.lat as number, point.lng as number] as [number, number]),
    [route],
  );
  const missionPoints = useMemo(() => path.filter((_, index) => index % 3 === 0).slice(-4), [path]);
  const riskZone = useMemo<[number, number][]>(() => [[center[0] + 0.002, center[1] - 0.002], [center[0] + 0.004, center[1] + 0.001], [center[0] + 0.001, center[1] + 0.004]], [center]);

  return (
    <section className="gcs-panel map-panel" aria-label="Map panel">
      <header className="panel-header compact map-header">
        <div>
          <p className="panel-eyebrow">TACTICAL MAP</p>
          <h2>{mode === 'satellite' ? 'Satellite Operations View' : 'Tactical Operations View'}</h2>
        </div>
        <div className="map-actions">
          <button type="button" className={mode === 'tactical' ? 'active' : ''} onClick={() => setMode('tactical')}>Tactical</button>
          <button type="button" className={mode === 'satellite' ? 'active' : ''} onClick={() => setMode('satellite')}>Satellite</button>
          <span className={hasGps ? 'map-fix online' : 'map-fix'}>{hasGps ? 'GPS LOCK' : 'NO GPS DATA'}</span>
        </div>
      </header>
      <div className={`map-canvas ${mode}`}>
        {!hasGps ? <div className="map-no-gps">NO GPS DATA</div> : null}
        <MapContainer center={focusCenter} zoom={15} scrollWheelZoom className="leaflet-shell">
          <MapFollower center={focusCenter} />
          <TileLayer attribution="&copy; OpenStreetMap contributors" url={mode === 'satellite' ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'} />
          {path.length > 1 ? <Polyline positions={path} pathOptions={{ color: '#00ffd5', weight: 4, opacity: 0.9 }} /> : null}
          {riskZone.length ? <Polyline positions={[...riskZone, riskZone[0]]} pathOptions={{ color: '#ff3b3b', weight: 2, opacity: 0.9 }} /> : null}
          {missionPoints.map((point, index) => <CircleMarker key={`${point[0]}-${point[1]}`} center={point} radius={6} pathOptions={{ color: '#ffc107', fillColor: '#ffc107', fillOpacity: 0.9 }}><Popup>Mission waypoint {index + 1}</Popup></CircleMarker>)}
          {hasGps ? (
            <CircleMarker center={center} radius={11} pathOptions={{ color: '#00ffd5', fillColor: '#00ffd5', fillOpacity: 0.95, weight: 2 }}>
              <Popup>Current drone position</Popup>
            </CircleMarker>
          ) : null}
          {hasGps ? detections.map((item, index) => {
            const bearing = ((telemetry.heading ?? 0) + index * 18) * (Math.PI / 180);
            const distance = item.distanceMeters ?? 120;
            const point: [number, number] = [center[0] + Math.cos(bearing) * distance * 0.000009, center[1] + Math.sin(bearing) * distance * 0.000012];
            return (
              <CircleMarker
                key={item.uid}
                center={point}
                radius={selectedDetectionId === item.uid ? 10 : 7}
                eventHandlers={{ click: () => onSelectDetection?.(item.uid) }}
                pathOptions={{ color: item.color, fillColor: item.color, fillOpacity: 0.85, weight: selectedDetectionId === item.uid ? 4 : 2 }}
              >
                <Popup>{item.trackId} · {item.displayLabel} · {Math.round(item.confidence * 100)}%</Popup>
              </CircleMarker>
            );
          }) : null}
        </MapContainer>
      </div>
    </section>
  );
}

export const DroneMap = memo(DroneMapComponent);
