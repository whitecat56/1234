import { Camera, Crosshair, Maximize2, Radio, StopCircle, Video as VideoIcon } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type WheelEvent } from 'react';
import type { Detection, Telemetry, VideoState } from '../api/live';

export type TrackedDetection = Detection & {
  uid: string;
  trackId: string;
  color: string;
  displayLabel: string;
  distanceMeters: number | null;
  ageSeconds: number | null;
  firstSeen: string;
  lastSeen: string;
  trackingSeconds: number | null;
  objectSpeedMetersPerSecond: number | null;
  movementHeadingDegrees: number | null;
  threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  trajectory: { x: number; y: number; t: number }[];
  geoHistory: { lat: number; lng: number; t: number }[];
  isPredicted: boolean;
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
  const canvasRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<BlobPart[]>([]);
  const drawTimerRef = useRef<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [recording, setRecording] = useState(false);
  const hasFrame = video.online && video.status === 'CAMERA_ONLINE' && Boolean(video.frame);
  const frameWidth = video.width && video.width > 0 ? video.width : 16;
  const frameHeight = video.height && video.height > 0 ? video.height : 9;
  const resolution = video.resolution || (video.width && video.height ? `${video.width}x${video.height}` : 'unknown');
  const bitrate = hasFrame ? Math.round((frameWidth * frameHeight * Math.max(video.fps, 1) * 0.07) / 1000) : 0;
  const heading = ((telemetry.heading ?? 0) + 360) % 360;
  const battery = typeof telemetry.battery === 'number' ? clamp(telemetry.battery, 0, 100) : 0;
  const signal = typeof telemetry.signal === 'number' ? clamp(telemetry.signal, 0, 100) : 0;
  const mediaBox = useMemo(() => {
    const stageRatio = 16 / 9;
    const frameRatio = frameWidth / frameHeight;
    if (frameRatio > stageRatio) {
      const height = (stageRatio / frameRatio) * 100;
      return { left: 0, top: (100 - height) / 2, width: 100, height };
    }
    const width = (frameRatio / stageRatio) * 100;
    return { left: (100 - width) / 2, top: 0, width, height: 100 };
  }, [frameHeight, frameWidth]);

  const cameraStatusClass = hasFrame ? 'status-online' : 'status-offline';
  const gps = useMemo(() => `${formatCoordinate(telemetry.lat)} / ${formatCoordinate(telemetry.lng)}`, [telemetry.lat, telemetry.lng]);
  const pitch = Math.sin((heading * Math.PI) / 180) * 8;
  const roll = Math.cos((heading * Math.PI) / 180) * 12;

  const handleWheelZoom = useCallback((event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    setZoom((value) => clamp(Number((value + delta).toFixed(1)), 1, 4));
  }, []);

  const handleDoubleClickZoom = useCallback(() => {
    setZoom((value) => (value >= 2 ? 1 : 2));
  }, []);

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

  const stopRecording = useCallback(() => {
    canvasRecorderRef.current?.stop();
  }, []);

  const startRecording = useCallback(() => {
    if (!hasFrame || !video.frame) return;
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const context = canvas.getContext('2d');
    if (!context) return;
    const img = shellRef.current?.querySelector<HTMLImageElement>('.live-frame');
    const draw = () => {
      context.fillStyle = '#02060a';
      context.fillRect(0, 0, canvas.width, canvas.height);
      if (img?.complete) context.drawImage(img, 0, 0, canvas.width, canvas.height);
      context.fillStyle = '#00ffd5';
      context.font = '20px monospace';
      context.fillText(`UZ DRONE AI · ${new Date().toISOString()} · ${detections.length} TRACKS`, 24, 38);
    };
    draw();
    drawTimerRef.current = window.setInterval(draw, 100);
    const stream = canvas.captureStream(30);
    const preferredType = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1') ? 'video/mp4;codecs=avc1' : 'video/webm;codecs=vp9';
    recordingChunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType: preferredType });
    recorder.ondataavailable = (event) => { if (event.data.size > 0) recordingChunksRef.current.push(event.data); };
    recorder.onstop = () => {
      if (drawTimerRef.current !== null) window.clearInterval(drawTimerRef.current);
      const type = preferredType.startsWith('video/mp4') ? 'video/mp4' : 'video/webm';
      const extension = type === 'video/mp4' ? 'mp4' : 'webm';
      const blob = new Blob(recordingChunksRef.current, { type });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `uz-drone-ai-recording-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`;
      link.click();
      URL.revokeObjectURL(link.href);
      setRecording(false);
    };
    canvasRecorderRef.current = recorder;
    recorder.start(1000);
    setRecording(true);
  }, [detections.length, hasFrame, video.frame]);

  useEffect(() => () => {
    if (drawTimerRef.current !== null) window.clearInterval(drawTimerRef.current);
    if (canvasRecorderRef.current?.state === 'recording') canvasRecorderRef.current.stop();
  }, []);

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

        <div className="video-stage" onWheel={handleWheelZoom} onDoubleClick={handleDoubleClickZoom} title="Mouse wheel zoom · double-click toggles 2× zoom">
          {hasFrame ? (
            <div className="frame-layer" style={{ aspectRatio: '16 / 9' }}>
              <div className="zoom-layer" style={{ transform: `scale(${zoom})` }}>
                <img className="live-frame" src={video.frame ?? undefined} alt="Local camera live feed" decoding="async" />
                <div className="bbox-layer" aria-label="AI bounding boxes">
                  {detections.map((item) => {
                    if (!item.bbox) return null;
                    const left = clamp(mediaBox.left + (item.bbox.x / frameWidth) * mediaBox.width, mediaBox.left, mediaBox.left + mediaBox.width);
                    const top = clamp(mediaBox.top + (item.bbox.y / frameHeight) * mediaBox.height, mediaBox.top, mediaBox.top + mediaBox.height);
                    const width = clamp((item.bbox.w / frameWidth) * mediaBox.width, 1, mediaBox.left + mediaBox.width - left);
                    const height = clamp((item.bbox.h / frameHeight) * mediaBox.height, 1, mediaBox.top + mediaBox.height - top);
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
                        <span className="bbox-label">{item.trackId} · {item.displayLabel} · {Math.round(item.confidence * 100)}% · {item.threatLevel}</span>
                        <span className="bbox-meta">RNG {item.distanceMeters !== null ? `${item.distanceMeters}m` : '—'} · SPD {item.objectSpeedMetersPerSecond !== null ? `${item.objectSpeedMetersPerSecond.toFixed(1)}m/s` : '—'} · HDG {item.movementHeadingDegrees !== null ? `${Math.round(item.movementHeadingDegrees)}°` : '—'} · {item.isPredicted ? 'PRED' : `T+${item.trackingSeconds ?? 0}s`}</span>
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
            <div className="hud-compass"><span style={{ transform: `translateX(${-heading * 1.2}px)` }}>W · NW · N · NE · E · SE · S · SW · W · NW · N</span><b>{heading.toFixed(0).padStart(3, '0')}°</b></div>
            <div className="hud-stack hud-top-left">
              <HudValue label="SPD" value={formatMetric(telemetry.speed, ' km/h')} />
              <HudValue label="ALT" value={formatMetric(telemetry.altitude, ' m')} />
              <HudValue label="HDG" value={`${heading.toFixed(0)}°`} />
            </div>
            <div className="hud-stack hud-top-right">
              <HudValue label="BAT" value={formatInteger(telemetry.battery, '%')} />
              <HudValue label="GPS" value={typeof telemetry.lat === 'number' ? 'LOCK' : 'NO FIX'} />
              <HudValue label="LINK" value={formatInteger(telemetry.signal, '%')} />
            </div>
            <div className="attitude-horizon" aria-hidden="true" style={{ transform: `rotate(${roll}deg) translateY(${pitch}px)` }}>
              <span /><i /><em />
            </div>
            <div className="hud-speed-tape"><span style={{ height: `${clamp(telemetry.speed ?? 0, 0, 120)}%` }} /><strong>{formatMetric(telemetry.speed, ' km/h')}</strong></div>
            <div className="hud-altitude-tape"><span style={{ height: `${clamp((telemetry.altitude ?? 0) / 2, 0, 100)}%` }} /><strong>{formatMetric(telemetry.altitude, ' m')}</strong></div>
            <div className="hud-battery"><span style={{ width: `${battery}%` }} /><strong>BAT {formatInteger(telemetry.battery, '%')}</strong></div>
            <div className="hud-signal"><span style={{ width: `${signal}%` }} /><strong>GPS {typeof telemetry.lat === 'number' ? '3D' : 'NO FIX'} · RF {formatInteger(telemetry.signal, '%')}</strong></div>
            <div className="hud-reticle" aria-hidden="true"><Crosshair size={54} /></div>
            <div className="lock-on-indicator">{detections.some((item) => item.isLocked) ? 'LOCK-ON TARGET TRACKING' : 'AUTO TRACK STANDBY'}</div>
            <div className="hud-bottom-left">GPS&nbsp;<strong>{gps}</strong></div>
            <div className="hud-bottom-right">RNG&nbsp;<strong>{formatMetric(telemetry.distance, ' km', 2)}</strong>&nbsp;&nbsp;AI&nbsp;<strong>{detections.length} TRACKS</strong></div>
          </div>
        </div>
      </div>

      <div className="control-toolbar" aria-label="Video controls">
        <button type="button" onClick={() => setZoom((value) => clamp(Number((value - 0.1).toFixed(1)), 1, 4))}>− Zoom</button>
        <span className="zoom-readout">{zoom.toFixed(1)}×</span>
        <button type="button" onClick={() => setZoom((value) => clamp(Number((value + 0.1).toFixed(1)), 1, 4))}>+ Zoom</button>
        <button type="button" onClick={enterFullscreen}><Maximize2 size={16} /> Fullscreen</button>
        <button type="button" onClick={openPictureInPicture} disabled={!hasFrame || !('pictureInPictureEnabled' in document)}><Camera size={16} /> PiP</button>
        <button type="button" onClick={downloadScreenshot} disabled={!video.frame}><Camera size={16} /> Screenshot</button>
        <button type="button" onClick={startRecording} disabled={!hasFrame || recording} title="Record the visible EO stream to MP4 when supported, otherwise WebM"><VideoIcon size={16} /> {recording ? 'REC ACTIVE' : 'REC MP4'}</button>
        <button type="button" onClick={stopRecording} disabled={!recording} title="Stop and export recording"><StopCircle size={16} /> Stop</button>
        <span className="toolbar-status"><Radio size={15} /> {video.online ? `Camera link active · frame ${video.frame_number ?? '—'}` : 'Camera link offline'}</span>
      </div>
    </section>
  );
}

export const VideoPanel = memo(VideoPanelComponent);
