import { CircleMarker, MapContainer, Polyline, Popup, TileLayer } from 'react-leaflet';
import type { Telemetry } from '../api/live';

type DroneMapProps = {
  telemetry: Telemetry;
  route: Telemetry[];
};

export function DroneMap({ telemetry, route }: DroneMapProps) {
  const path = route.map((point) => [point.lat, point.lng] as [number, number]);

  return (
    <MapContainer center={[telemetry.lat, telemetry.lng]} zoom={13} scrollWheelZoom={false} className="h-full w-full rounded-2xl">
      <TileLayer attribution="UZ DRONE AI" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Polyline positions={path} pathOptions={{ color: '#22c55e', weight: 4 }} />
      <CircleMarker center={[telemetry.lat, telemetry.lng]} radius={10} pathOptions={{ color: '#06b6d4', fillColor: '#22c55e', fillOpacity: 0.9 }}>
        <Popup>Текущая позиция FPV-дрона</Popup>
      </CircleMarker>
      <CircleMarker center={[telemetry.lat + 0.004, telemetry.lng - 0.004]} radius={8} pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.8 }}>
        <Popup>Сохранённая цель: сектор A-7</Popup>
      </CircleMarker>
    </MapContainer>
  );
}
