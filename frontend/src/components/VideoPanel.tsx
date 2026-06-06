import { Camera, Crosshair, Maximize2, Radio, StopCircle, Video as VideoIcon } from 'lucide-react';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import type { Detection, Telemetry, VideoState } from '../api/live';

export type TrackedDetection = Detection & {
  uid: string;
  trackId: string;
  color: string;
  displayLabel: string;
  distanceMeters: number | null;
  ageSeconds: number | null;
  isLocked: boolean;
};

type VideoPanelProps = {
  video: VideoState;
  telemetry: Telemetry;
  detections: TrackedDetection[];
  selectedDetectionId?: string | null;
  onSelectDetection?: (id: string) => void;
  aiStatus?: string;
};

const formatMetric = (value: number | null, suffix = '', digits = 1) => (typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(digits)}${suffix}` : '—');
const formatInteger = (value: number | null, suffix = '') => (typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)}${suffix}` : '—');
const formatCoordinate = (value: number | null) => (typeof value === 'number' && Number.isFinite(value) ? value.toFixed(6) : 'NO GPS DATA');
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function HudValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="hud-value">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function VideoPanelComponent({ video, telemetry, detections, selectedDetectionId, onSelectDetection, aiStatus }: VideoPanelProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const hasFrame = video.online && video.status === 'CAMERA_ONLINE' && Boolean(video.frame);
  const frameWidth = video.width && video.width > 0 ? video.width : 16;
  const frameHeight = video.height && video.height > 0 ? video.height : 9;
  const resolution = video.resolution || (video.width && video.height ? `${video.width}x${video.height}` : 'unknown');
  const bitrate = hasFrame ? Math.round((frameWidth * frameHeight * Math.max(video.fps, 1) * 0.07) / 1000) : 0;

  const cameraStatusClass = hasFrame ? 'status-online' : 'status-offline';
  const gps = useMemo(() => `${formatCoordinate(telemetry.lat)} / ${formatCoordinate(telemetry.lng)}`, [telemetry.lat, telemetry.lng]);
  const pitch = Math.sin(((telemetry.heading ?? 0) * Math.PI) / 180) * 8;
  const roll = Math.cos(((telemetry.heading ?? 0) * Math.PI) / 180) * 12;

  const enterFullscreen = useCallback(() => {
    shellRef.current?.requestFullscreen?.();
  }, []);

  const openPictureInPicture = useCallback(async () => {
    const img = shellRef.current?.querySelector<HTMLImageElement>('.live-frame');
    if (!img || !('pictureInPictureEnabled' in document)) return;

    const canvas = document.createElement('canvas');
    canvas.width = frameWidth;
    canvas.height = frameHeight;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(img, 0, 0, frameWidth, frameHeight);
    const stream = canvas.captureStream(Math.max(1, Math.round(video.fps || 10)));
    const pipVideo = document.createElement('video');
    pipVideo.muted = true;
    pipVideo.srcObject = stream;
    await pipVideo.play();
    await pipVideo.requestPictureInPicture();
  }, [frameHeight, frameWidth, video.fps]);

  const downloadScreenshot = useCallback(() => {
    if (!video.frame) return;
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
            <span className="panel-eyebrow">EO/IR LIVE DRONE FEED</span>
          </div>
          <div className="video-stats" aria-label="Camera stream metadata">
            <span>FPS {hasFrame ? video.fps.toFixed(1) : '—'}</span>
            <span>{hasFrame ? resolution : 'NO STREAM'}</span>
            <span>{hasFrame ? `${video.latency_ms}ms` : 'NO LATENCY'}</span>
            <span>{hasFrame ? `${bitrate} kbps` : 'NO BITRATE'}</span>
            <span className={cameraStatusClass}>AI {aiStatus ?? 'unknown'}</span>
          </div>
        </div>

        <div className="video-stage">
          {hasFrame ? (
            <div className="frame-layer" style={{ aspectRatio: `${frameWidth} / ${frameHeight}` }}>
              <div className="zoom-layer" style={{ transform: `scale(${zoom})` }}>
                <img className="live-frame" src={video.frame ?? undefined} alt="Local camera live feed" decoding="async" />
                <div className="bbox-layer" aria-label="AI bounding boxes">
                  {detections.map((item) => {
                    if (!item.bbox) return null;
                    const left = clamp((item.bbox.x / frameWidth) * 100, 0, 100);
                    const top = clamp((item.bbox.y / frameHeight) * 100, 0, 100);
                    const width = clamp((item.bbox.w / frameWidth) * 100, 1, 100 - left);
                    const height = clamp((item.bbox.h / frameHeight) * 100, 1, 100 - top);
                    const isSelected = selectedDetectionId === item.uid;
                    return (
                      <button
                        type="button"
                        className={`bbox yolo-box ${item.isLocked || isSelected ? 'locked' : ''}`}
                        key={item.uid}
                        style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%`, '--bbox-color': item.color } as Record<string, string | number>}
                        onClick={() => onSelectDetection?.(item.uid)}
                        aria-label={`Select ${item.displayLabel} ${item.trackId}`}
                      >
                        <span className="bbox-label">{item.trackId} · {item.displayLabel} · {Math.round(item.confidence * 100)}%</span>
                        <span className="bbox-meta">{item.distanceMeters ? `${item.distanceMeters}m` : 'RNG —'} · T+{item.ageSeconds ?? 0}s</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
          {!hasFrame ? (
            <div className="offline-overlay" role="status" aria-live="polite">
              <strong>CAMERA OFFLINE</strong>
              <span>Waiting for local camera stream</span>
            </div>
          ) : null}

          <div className="aviation-hud" aria-label="Flight telemetry overlay">
            <div className="hud-compass"><span style={{ transform: `translateX(${-(telemetry.heading ?? 0) * 1.2}px)` }}>W · NW · N · NE · E · SE · S · SW · W · NW · N</span></div>
            <div className="hud-stack hud-top-left">
              <HudValue label="SPD" value={formatMetric(telemetry.speed, ' km/h')} />
              <HudValue label="ALT" value={formatMetric(telemetry.altitude, ' m')} />
              <HudValue label="HDG" value={formatMetric(telemetry.heading, '°')} />
            </div>
            <div className="hud-stack hud-top-right">
              <HudValue label="BAT" value={formatInteger(telemetry.battery, '%')} />
              <HudValue label="GPS" value={typeof telemetry.lat === 'number' ? 'LOCK' : 'NO FIX'} />
              <HudValue label="CAM" value={`PAN ${formatMetric(telemetry.heading, '°')} / TILT ${pitch.toFixed(1)}°`} />
            </div>
            <div className="attitude-horizon" aria-hidden="true" style={{ transform: `rotate(${roll}deg) translateY(${pitch}px)` }}>
              <span />
            </div>
            <div className="hud-reticle" aria-hidden="true"><Crosshair size={54} /></div>
            <div className="lock-on-indicator">{detections.some((item) => item.isLocked) ? 'LOCK-ON TARGET TRACKING' : 'AUTO TRACK STANDBY'}</div>
            <div className="hud-bottom-left">GPS&nbsp;<strong>{gps}</strong></div>
            <div className="hud-bottom-right">RNG&nbsp;<strong>{formatMetric(telemetry.distance, ' km', 2)}</strong>&nbsp;&nbsp;AI&nbsp;<strong>{detections.length} TRACKS</strong></div>
          </div>
        </div>
      </div>

      <div className="control-toolbar" aria-label="Video controls">
        <button type="button" onClick={() => setZoom((value) => clamp(Number((value - 0.1).toFixed(1)), 1, 2.5))}>− Zoom</button>
        <span className="zoom-readout">{zoom.toFixed(1)}×</span>
        <button type="button" onClick={() => setZoom((value) => clamp(Number((value + 0.1).toFixed(1)), 1, 2.5))}>+ Zoom</button>
        <button type="button" onClick={enterFullscreen}><Maximize2 size={16} /> Fullscreen</button>
        <button type="button" onClick={openPictureInPicture} disabled={!hasFrame || !('pictureInPictureEnabled' in document)}><Camera size={16} /> PiP</button>
        <button type="button" onClick={downloadScreenshot} disabled={!video.frame}><Camera size={16} /> Screenshot</button>
        <button type="button" disabled title="Recording is not available for the current backend stream"><VideoIcon size={16} /> REC</button>
        <button type="button" disabled title="Recording is not active"><StopCircle size={16} /> Stop</button>
        <span className="toolbar-status"><Radio size={15} /> {video.online ? `Camera link active · frame ${video.frame_number ?? '—'}` : 'Camera link offline'}</span>
      </div>
    </section>
  );
}

export const VideoPanel = memo(VideoPanelComponent);
