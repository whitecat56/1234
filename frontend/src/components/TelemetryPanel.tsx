import { Activity, Battery, Compass, Gauge, MapPin, Radio, Ruler, Satellite } from 'lucide-react';
import { memo } from 'react';
import type { Telemetry } from '../api/live';

type TelemetryPanelProps = {
  telemetry: Telemetry;
};

const numeric = (value: number | null, suffix = '', digits = 1) => (typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(digits)}${suffix}` : '—');
const integer = (value: number | null, suffix = '') => (typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)}${suffix}` : '—');
const gps = (lat: number | null, lng: number | null) => (typeof lat === 'number' && typeof lng === 'number' ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : 'NO GPS DATA');
const clamp = (value: number | null, fallback = 0) => Math.max(0, Math.min(100, typeof value === 'number' ? value : fallback));

const items = [
  { key: 'distance', label: 'Distance', icon: Ruler, value: (t: Telemetry) => numeric(t.distance, ' km', 2) },
  { key: 'signal', label: 'Signal', icon: Radio, value: (t: Telemetry) => integer(t.signal, '%') },
  { key: 'gps', label: 'GPS', icon: MapPin, value: (t: Telemetry) => gps(t.lat, t.lng) },
  { key: 'fix', label: 'Navigation', icon: Satellite, value: (t: Telemetry) => (typeof t.lat === 'number' && typeof t.lng === 'number' ? 'GPS LOCK' : 'NO FIX') },
];

function TelemetryPanelComponent({ telemetry }: TelemetryPanelProps) {
  const heading = telemetry.heading ?? 0;
  const roll = Math.cos((heading * Math.PI) / 180) * 12;
  const pitch = Math.sin((heading * Math.PI) / 180) * 10;

  return (
    <section className="gcs-panel telemetry-panel" aria-label="Telemetry">
      <header className="panel-header compact">
        <div className="panel-icon"><Activity size={18} /></div>
        <div>
          <p className="panel-eyebrow">AVIONICS</p>
          <h2>Flight Instruments</h2>
        </div>
      </header>
      <div className="instrument-cluster">
        <div className="artificial-horizon gauge-card">
          <span className="instrument-label">Artificial Horizon</span>
          <div className="horizon-ball"><div style={{ transform: `rotate(${roll}deg) translateY(${pitch}px)` }}><span /></div><b /></div>
        </div>
        <div className="compass-rose gauge-card">
          <span className="instrument-label">Compass</span>
          <div className="rose" style={{ transform: `rotate(${-heading}deg)` }}><i>N</i><i>E</i><i>S</i><i>W</i></div>
          <strong>{numeric(telemetry.heading, '°')}</strong>
        </div>
        <div className="tape-gauge gauge-card"><span className="instrument-label">Altitude</span><div className="tape"><i style={{ height: `${Math.min(100, (telemetry.altitude ?? 0) / 2)}%` }} /></div><strong>{numeric(telemetry.altitude, ' m')}</strong></div>
        <div className="tape-gauge gauge-card"><span className="instrument-label">Speed</span><div className="tape speed"><i style={{ height: `${Math.min(100, telemetry.speed ?? 0)}%` }} /></div><strong>{numeric(telemetry.speed, ' km/h')}</strong></div>
        <div className="battery-instrument gauge-card"><Battery size={20} /><span className="instrument-label">Battery</span><div><i style={{ width: `${clamp(telemetry.battery)}%` }} /></div><strong>{integer(telemetry.battery, '%')}</strong></div>
      </div>
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
