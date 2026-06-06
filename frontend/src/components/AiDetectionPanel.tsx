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

function AiDetectionPanelComponent({ detections, selectedDetectionId, onSelectDetection }: AiDetectionPanelProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const classes = useMemo(() => ['all', ...Array.from(new Set(detections.map((item) => item.displayLabel)))], [detections]);
  const filtered = detections.filter((item) => {
    const matchesFilter = filter === 'all' || item.displayLabel === filter;
    const text = `${item.trackId} ${item.displayLabel} ${item.confidence}`.toLowerCase();
    return matchesFilter && text.includes(query.toLowerCase());
  });

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
          <p className="panel-eyebrow">YOLO AI EVENTS</p>
          <h2>Target Intelligence</h2>
        </div>
      </header>

      <div className="ai-tools">
        <label className="search-box"><Search size={14} /><input value={query} onChange={(event: { target: HTMLInputElement }) => setQuery(event.target.value)} placeholder="Search ID / class" /></label>
        <label className="select-box"><Crosshair size={14} /><select value={filter} onChange={(event: { target: HTMLSelectElement }) => setFilter(event.target.value)}>{classes.map((name) => <option key={name} value={name}>{name === 'all' ? 'All classes' : name}</option>)}</select></label>
        <button type="button" onClick={exportEvents}><Download size={14} /> Export</button>
      </div>

      <div className="detection-list realtime-stream">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <Target size={30} />
            <strong>NO DETECTIONS</strong>
            <span>Waiting for backend AI events</span>
          </div>
        ) : filtered.map((item) => (
          <button
            type="button"
            className={`detection-card ${selectedDetectionId === item.uid ? 'selected' : ''}`}
            key={item.uid}
            onClick={() => onSelectDetection?.(item.uid)}
            style={{ '--bbox-color': item.color } as Record<string, string>}
          >
            <div className="detection-title">
              <strong><Crosshair size={14} /> {item.trackId} · {item.displayLabel}</strong>
              <span>{Math.round(item.confidence * 100)}%</span>
            </div>
            <div className="confidence-bar"><span style={{ width: `${Math.max(0, Math.min(100, item.confidence * 100))}%`, background: item.color }} /></div>
            <div className="detection-meta"><Clock size={13} /> detected {formatTimestamp(item.created_at)} · age {item.ageSeconds ?? 0}s · distance {item.distanceMeters ? `${item.distanceMeters}m` : '—'}</div>
            <div className="object-history"><i /><i /><i /><i /></div>
          </button>
        ))}
      </div>
    </aside>
  );
}

export const AiDetectionPanel = memo(AiDetectionPanelComponent);
