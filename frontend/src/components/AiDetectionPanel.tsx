import { Bot, Clock, Target } from 'lucide-react';
import { memo } from 'react';
import type { Detection } from '../api/live';

type AiDetectionPanelProps = {
  detections: Detection[];
};

const formatTimestamp = (value: string) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

function AiDetectionPanelComponent({ detections }: AiDetectionPanelProps) {
  return (
    <aside className="gcs-panel ai-panel" aria-label="AI detection events">
      <header className="panel-header">
        <div className="panel-icon"><Bot size={19} /></div>
        <div>
          <p className="panel-eyebrow">AI EVENTS</p>
          <h2>Detection Feed</h2>
        </div>
      </header>

      <div className="detection-list">
        {detections.length === 0 ? (
          <div className="empty-state">
            <Target size={30} />
            <strong>NO DETECTIONS</strong>
            <span>Waiting for backend AI events</span>
          </div>
        ) : detections.map((item, index) => (
          <article className="detection-card" key={`${item.label}-${item.created_at}-${index}`}>
            <div className="detection-title">
              <strong>{item.label}</strong>
              <span>{Math.round(item.confidence * 100)}%</span>
            </div>
            <div className="confidence-bar"><span style={{ width: `${Math.max(0, Math.min(100, item.confidence * 100))}%` }} /></div>
            <div className="detection-meta"><Clock size={13} /> {formatTimestamp(item.created_at)}</div>
          </article>
        ))}
      </div>
    </aside>
  );
}

export const AiDetectionPanel = memo(AiDetectionPanelComponent);
