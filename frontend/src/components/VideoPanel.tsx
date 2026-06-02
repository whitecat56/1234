import { Camera, Maximize2, Radio, StopCircle, Video as VideoIcon } from 'lucide-react';
import { memo, useCallback, useMemo, useRef } from 'react';
import type { Telemetry, VideoState } from '../api/live';

type VideoPanelProps = {
  video: VideoState;
  telemetry: Telemetry;
};

const formatMetric = (value: number | null, suffix = '', digits = 1) => (typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(digits)}${suffix}` : '—');
const formatInteger = (value: number | null, suffix = '') => (typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)}${suffix}` : '—');
const formatCoordinate = (value: number | null) => (typeof value === 'number' && Number.isFinite(value) ? value.toFixed(6) : 'NO GPS DATA');

function HudValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="hud-value">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function VideoPanelComponent({ video, telemetry }: VideoPanelProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const hasFrame = video.online && video.status === 'CAMERA_ONLINE' && Boolean(video.frame);
  const resolution = video.resolution || (video.width && video.height ? `${video.width}x${video.height}` : 'unknown');

  const cameraStatusClass = hasFrame ? 'status-online' : 'status-offline';
  const gps = useMemo(() => `${formatCoordinate(telemetry.lat)} / ${formatCoordinate(telemetry.lng)}`, [telemetry.lat, telemetry.lng]);

  const enterFullscreen = useCallback(() => {
    shellRef.current?.requestFullscreen?.();
  }, []);

  const downloadScreenshot = useCallback(() => {
    if (!video.frame) {
      return;
    }
    const link = document.createElement('a');
    link.href = video.frame;
    link.download = `uz-drone-ai-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;
    link.click();
  }, [video.frame]);

  return (
    <section className="gcs-panel video-panel" aria-label="LIVE DRONE FEED">
      <div ref={shellRef} className="video-shell scanline">
        <div className="video-topbar">
          <div>
            <span className={`camera-dot ${cameraStatusClass}`} />
            <span className="panel-eyebrow">LIVE DRONE FEED</span>
          </div>
          <div className="video-stats" aria-label="Camera stream metadata">
            <span>FPS {hasFrame ? video.fps.toFixed(1) : '—'}</span>
            <span>{hasFrame ? resolution : 'NO STREAM'}</span>
            <span className={cameraStatusClass}>{video.status}</span>
          </div>
        </div>

        <div className="video-stage">
          {hasFrame ? <img className="live-frame" src={video.frame ?? undefined} alt="Local camera live feed" decoding="async" /> : null}
          {!hasFrame ? (
            <div className="offline-overlay" role="status" aria-live="polite">
              <strong>CAMERA OFFLINE</strong>
              <span>Waiting for local camera stream</span>
            </div>
          ) : null}

          <div className="hud-grid" aria-label="Flight telemetry overlay">
            <div className="hud-stack hud-top-left">
              <HudValue label="SPD" value={formatMetric(telemetry.speed, ' km/h')} />
              <HudValue label="ALT" value={formatMetric(telemetry.altitude, ' m')} />
            </div>
            <div className="hud-stack hud-top-right">
              <HudValue label="BAT" value={formatInteger(telemetry.battery, '%')} />
              <HudValue label="SIG" value={formatInteger(telemetry.signal, '%')} />
            </div>
            <div className="hud-reticle" aria-hidden="true" />
            <div className="hud-bottom-left">GPS&nbsp;<strong>{gps}</strong></div>
            <div className="hud-bottom-right">HDG&nbsp;<strong>{formatMetric(telemetry.heading, '°')}</strong>&nbsp;&nbsp;DST&nbsp;<strong>{formatMetric(telemetry.distance, ' km', 2)}</strong></div>
          </div>
        </div>
      </div>

      <div className="control-toolbar" aria-label="Video controls">
        <button type="button" onClick={enterFullscreen}><Maximize2 size={16} /> Fullscreen</button>
        <button type="button" onClick={downloadScreenshot} disabled={!video.frame}><Camera size={16} /> Screenshot</button>
        <button type="button" disabled title="Recording is not available for the current backend stream"><VideoIcon size={16} /> Start Recording</button>
        <button type="button" disabled title="Recording is not active"><StopCircle size={16} /> Stop Recording</button>
        <span className="toolbar-status"><Radio size={15} /> {video.online ? 'Camera link active' : 'Camera link offline'}</span>
      </div>
    </section>
  );
}

export const VideoPanel = memo(VideoPanelComponent);
