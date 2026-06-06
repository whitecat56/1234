import { Bot, Clock, Crosshair, Download, Search, Target } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import type { TrackedDetection } from './VideoPanel';

type AiDetectionPanelProps = {
  detections: TrackedDetection[];
  selectedDetectionId?: string | null;
  onSelectDetection?: (id: string) => void;
};

const formatTimestamp = (value: string) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const formatNumber = (value: number | null, suffix = '', digits = 1) => (typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(digits)}${suffix}` : '—');

function AiDetectionPanelComponent({ detections, selectedDetectionId, onSelectDetection }: AiDetectionPanelProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const classes = useMemo(() => ['all', ...Array.from(new Set(detections.map((item) => item.displayLabel)))], [detections]);
  const filtered = detections.filter((item) => {
    const matchesFilter = filter === 'all' || item.displayLabel === filter;
    const text = `${item.trackId} ${item.displayLabel} ${item.confidence} ${item.threatLevel}`.toLowerCase();
    return matchesFilter && text.includes(query.toLowerCase());
  });
  const selected = detections.find((item) => item.uid === selectedDetectionId) ?? filtered[0];

  const exportEvents = () => {
    const blob = new Blob([JSON.stringify(detections, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `uz-drone-ai-detections-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <aside className="gcs-panel ai-panel" aria-label="AI detection events">
      <header className="panel-header">
        <div className="panel-icon"><Bot size={19} /></div>
        <div>
          <p className="panel-eyebrow">REAL YOLO EVENTS · BOT-SORT TRACKER</p>
          <h2>Target Intelligence</h2>
        </div>
      </header>

      {selected ? (
        <div className={`target-intel-card threat-${selected.threatLevel.toLowerCase()}`} style={{ '--bbox-color': selected.color } as Record<string, string>}>
          <div className="target-intel-head">
            <strong>{selected.trackId}</strong>
            <span>{selected.threatLevel}</span>
          </div>
          <p>{selected.displayLabel.toUpperCase()} · {Math.round(selected.confidence * 100)}% CONF · {selected.isPredicted ? 'TRACK PREDICTED' : 'YOLO ACTIVE'}</p>
          <div className="target-intel-grid">
            <span>Detected <b>{formatTimestamp(selected.firstSeen)}</b></span>
            <span>Tracking <b>{selected.trackingSeconds ?? 0}s</b></span>
            <span>Speed <b>{formatNumber(selected.objectSpeedMetersPerSecond, ' m/s')}</b></span>
            <span>Heading <b>{formatNumber(selected.movementHeadingDegrees, '°', 0)}</b></span>
            <span>Range <b>{formatNumber(selected.distanceMeters, ' m', 0)}</b></span>
            <span>Trail <b>{selected.trajectory.length} pts</b></span>
          </div>
        </div>
      ) : null}

      <div className="ai-tools">
        <label className="search-box"><Search size={14} /><input value={query} onChange={(event: { target: HTMLInputElement }) => setQuery(event.target.value)} placeholder="Search ID / class / threat" /></label>
        <label className="select-box"><Crosshair size={14} /><select value={filter} onChange={(event: { target: HTMLSelectElement }) => setFilter(event.target.value)}>{classes.map((name) => <option key={name} value={name}>{name === 'all' ? 'All classes' : name}</option>)}</select></label>
        <button type="button" onClick={exportEvents}><Download size={14} /> JSON</button>
      </div>

      <div className="detection-list realtime-stream">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <Target size={30} />
            <strong>NO DETECTIONS</strong>
            <span>Waiting for backend AI events or demo stream</span>
          </div>
        ) : filtered.map((item) => (
          <button
            type="button"
            className={`detection-card threat-${item.threatLevel.toLowerCase()} ${selectedDetectionId === item.uid ? 'selected' : ''}`}
            key={item.uid}
            onClick={() => onSelectDetection?.(item.uid)}
            style={{ '--bbox-color': item.color } as Record<string, string>}
          >
            <div className="detection-title">
              <strong><Crosshair size={14} /> {item.trackId} · {item.displayLabel}</strong>
              <span>{item.threatLevel}</span>
            </div>
            <div className="confidence-bar"><span style={{ width: `${Math.max(0, Math.min(100, item.confidence * 100))}%`, background: item.color }} /></div>
            <div className="detection-meta"><Clock size={13} /> {Math.round(item.confidence * 100)}% · detected {formatTimestamp(item.firstSeen)} · track {item.trackingSeconds ?? 0}s · speed {formatNumber(item.objectSpeedMetersPerSecond, ' m/s')} · heading {formatNumber(item.movementHeadingDegrees, '°', 0)} · RNG {formatNumber(item.distanceMeters, ' m', 0)}</div>
            <div className="object-history">{item.trajectory.slice(-8).map((point) => <i key={`${item.uid}-${point.t}`} />)}</div>
          </button>
        ))}
      </div>
    </aside>
  );
}

export const AiDetectionPanel = memo(AiDetectionPanelComponent);
