import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import { memo, useEffect, useMemo } from 'react';
import type { Telemetry } from '../api/live';

type DroneMapProps = {
  telemetry: Telemetry;
  route: Telemetry[];
};

const isCoordinate = (lat: number | null, lng: number | null): lat is number => typeof lat === 'number' && Number.isFinite(lat) && typeof lng === 'number' && Number.isFinite(lng);

function MapFollower({ center }: { center: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);

  return null;
}

function DroneMapComponent({ telemetry, route }: DroneMapProps) {
  const hasGps = isCoordinate(telemetry.lat, telemetry.lng);
  const center = useMemo<[number, number]>(() => (hasGps ? [telemetry.lat as number, telemetry.lng as number] : [41.3111, 69.2797]), [hasGps, telemetry.lat, telemetry.lng]);
  const path = useMemo(
    () => route.filter((point) => isCoordinate(point.lat, point.lng)).map((point) => [point.lat as number, point.lng as number] as [number, number]),
    [route],
  );

  return (
    <section className="gcs-panel map-panel" aria-label="Map panel">
      <header className="panel-header compact map-header">
        <div>
          <p className="panel-eyebrow">MAP</p>
          <h2>OpenStreetMap Tactical View</h2>
        </div>
        <span className={hasGps ? 'map-fix online' : 'map-fix'}>{hasGps ? 'GPS LOCK' : 'NO GPS DATA'}</span>
      </header>
      <div className="map-canvas">
        {!hasGps ? <div className="map-no-gps">NO GPS DATA</div> : null}
        <MapContainer center={center} zoom={15} scrollWheelZoom={false} className="leaflet-shell">
          <MapFollower center={center} />
          <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {path.length > 1 ? <Polyline positions={path} pathOptions={{ color: '#00ff9d', weight: 4, opacity: 0.85 }} /> : null}
          {hasGps ? (
            <CircleMarker center={center} radius={10} pathOptions={{ color: '#00ff9d', fillColor: '#00ff9d', fillOpacity: 0.9, weight: 2 }}>
              <Popup>Current drone position</Popup>
            </CircleMarker>
          ) : null}
        </MapContainer>
      </div>
    </section>
  );
}

export const DroneMap = memo(DroneMapComponent);
