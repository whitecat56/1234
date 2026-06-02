import { Activity, Battery, Compass, Gauge, MapPin, Radio, Ruler, Satellite } from 'lucide-react';
import { memo } from 'react';
import type { Telemetry } from '../api/live';

type TelemetryPanelProps = {
  telemetry: Telemetry;
};

const numeric = (value: number | null, suffix = '', digits = 1) => (typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(digits)}${suffix}` : '—');
const integer = (value: number | null, suffix = '') => (typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)}${suffix}` : '—');
const gps = (lat: number | null, lng: number | null) => (typeof lat === 'number' && typeof lng === 'number' ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : 'NO GPS DATA');

const items = [
  { key: 'speed', label: 'Speed', icon: Gauge, value: (t: Telemetry) => numeric(t.speed, ' km/h') },
  { key: 'altitude', label: 'Altitude', icon: Activity, value: (t: Telemetry) => numeric(t.altitude, ' m') },
  { key: 'distance', label: 'Distance', icon: Ruler, value: (t: Telemetry) => numeric(t.distance, ' km', 2) },
  { key: 'battery', label: 'Battery', icon: Battery, value: (t: Telemetry) => integer(t.battery, '%') },
  { key: 'signal', label: 'Signal', icon: Radio, value: (t: Telemetry) => integer(t.signal, '%') },
  { key: 'heading', label: 'Heading', icon: Compass, value: (t: Telemetry) => numeric(t.heading, '°') },
  { key: 'gps', label: 'GPS', icon: MapPin, value: (t: Telemetry) => gps(t.lat, t.lng) },
  { key: 'fix', label: 'Navigation', icon: Satellite, value: (t: Telemetry) => (typeof t.lat === 'number' && typeof t.lng === 'number' ? 'GPS LOCK' : 'NO FIX') },
];

function TelemetryPanelComponent({ telemetry }: TelemetryPanelProps) {
  return (
    <section className="gcs-panel telemetry-panel" aria-label="Telemetry">
      <header className="panel-header compact">
        <div className="panel-icon"><Activity size={18} /></div>
        <div>
          <p className="panel-eyebrow">TELEMETRY</p>
          <h2>Flight Instruments</h2>
        </div>
      </header>
      <div className="telemetry-grid">
        {items.map(({ key, label, icon: Icon, value }) => (
          <div className="telemetry-tile" key={key}>
            <Icon size={17} />
            <span>{label}</span>
            <strong>{value(telemetry)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

export const TelemetryPanel = memo(TelemetryPanelComponent);
