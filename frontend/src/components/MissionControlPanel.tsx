import { Download, MapPin, Route, Shield, Target } from 'lucide-react';
import { memo } from 'react';
import type { Telemetry } from '../api/live';
import type { MissionState } from '../mission';
import type { TrackedDetection } from './VideoPanel';

type MissionControlPanelProps = {
  mission: MissionState;
  telemetry: Telemetry;
  route: Telemetry[];
  detections: TrackedDetection[];
  selectedDetection?: TrackedDetection;
  onCreateMission: () => void;
  onAddWaypoint: () => void;
  onAddPoi: () => void;
  onAddGeoFence: () => void;
  onSaveMission: () => void;
  onLoadMission: () => void;
};

const download = (name: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
};

const csvValue = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

function MissionControlPanelComponent({ mission, telemetry, route, detections, selectedDetection, onCreateMission, onAddWaypoint, onAddPoi, onAddGeoFence, onSaveMission, onLoadMission }: MissionControlPanelProps) {
  const exportMission = () => download(`uz-drone-mission-${mission.id}.json`, JSON.stringify({ mission, telemetry, detections }, null, 2), 'application/json');
  const exportTelemetryCsv = () => {
    const rows = [telemetry, ...route].filter((item) => item.created_at);
    const header = ['created_at', 'lat', 'lng', 'altitude', 'speed', 'heading', 'battery', 'signal', 'distance'];
    const body = rows.map((row) => header.map((key) => csvValue(row[key as keyof Telemetry])).join(',')).join('\n');
    download(`uz-drone-telemetry-${mission.id}.csv`, `${header.join(',')}\n${body}`, 'text/csv');
  };
  const exportAi = () => download(`uz-drone-ai-events-${mission.id}.json`, JSON.stringify(detections, null, 2), 'application/json');

  return (
    <section className="gcs-panel mission-panel" aria-label="Mission control">
      <header className="panel-header compact">
        <div className="panel-icon"><Route size={18} /></div>
        <div>
          <p className="panel-eyebrow">MISSION CONTROL · RECORDER</p>
          <h2>{mission.name}</h2>
        </div>
      </header>

      <div className="mission-status-grid">
        <span><b>{mission.waypoints.length}</b> WAYPOINTS</span>
        <span><b>{mission.pois.length}</b> POI</span>
        <span><b>{mission.geoFences.length}</b> GEO FENCE</span>
        <span><b>{detections.length}</b> TRACKS</span>
      </div>

      <div className="mission-actions">
        <button type="button" onClick={onCreateMission}><Route size={14} /> New mission</button>
        <button type="button" onClick={onAddWaypoint}><MapPin size={14} /> Add waypoint</button>
        <button type="button" onClick={onAddPoi} disabled={!selectedDetection}><Target size={14} /> Add target POI</button>
        <button type="button" onClick={onAddGeoFence}><Shield size={14} /> Add geo fence</button>
        <button type="button" onClick={onSaveMission}>Save</button>
        <button type="button" onClick={onLoadMission}>Load</button>
      </div>

      <div className="mission-export-row">
        <button type="button" onClick={exportMission}><Download size={14} /> Mission JSON</button>
        <button type="button" onClick={exportAi}><Download size={14} /> AI JSON</button>
        <button type="button" onClick={exportTelemetryCsv}><Download size={14} /> Telemetry CSV</button>
      </div>

      <div className="mission-list">
        {[...mission.waypoints, ...mission.pois].slice(-6).map((point) => (
          <span key={point.id}><b>{point.name}</b> {point.lat.toFixed(5)}, {point.lng.toFixed(5)}</span>
        ))}
        {mission.geoFences.slice(-2).map((zone) => <span key={zone.id}><b>{zone.name}</b> {zone.points.length} vertices · {zone.level.toUpperCase()}</span>)}
      </div>
    </section>
  );
}

export const MissionControlPanel = memo(MissionControlPanelComponent);
