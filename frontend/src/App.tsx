import { Radio, Shield, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { emptyLiveUpdate, liveWebSocketUrl, type Detection, type LiveMessage, type LiveUpdate, type Telemetry } from './api/live';
import './App.css';
import { AiDetectionPanel } from './components/AiDetectionPanel';
import { DroneMap } from './components/DroneMap';
import { MissionControlPanel } from './components/MissionControlPanel';
import { TelemetryPanel } from './components/TelemetryPanel';
import { VideoPanel, type TrackedDetection } from './components/VideoPanel';
import { createMission, geoFenceAroundTelemetry, missionPointFromDetection, missionPointFromTelemetry, type MissionState } from './mission';

type SocketState = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'RECONNECTING';
type TrackPoint = { x: number; y: number; t: number };
type GeoPoint = { lat: number; lng: number; t: number };

type BotSortTrack = {
  uid: string;
  trackId: string;
  label: string;
  color: string;
  bbox: NonNullable<Detection['bbox']>;
  confidence: number;
  firstSeen: number;
  lastSeen: number;
  createdAt: string;
  velocityX: number;
  velocityY: number;
  missFrames: number;
  hits: number;
  trajectory: TrackPoint[];
  geoHistory: GeoPoint[];
  distanceMeters: number | null;
  movementHeadingDegrees: number | null;
  objectSpeedMetersPerSecond: number | null;
};

const CLASS_COLORS: Record<string, string> = {
  'человек': '#2dff7a',
  person: '#2dff7a',
  'автомобиль': '#2bdfff',
  car: '#2bdfff',
  'грузовик': '#ffc107',
  truck: '#ffc107',
  'мотоцикл': '#ff8a00',
  motorcycle: '#ff8a00',
  'дрон': '#b86cff',
  drone: '#b86cff',
};

const normalizeLabel = (label: string) => label.trim().toLowerCase();
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const centerOf = (bbox: NonNullable<Detection['bbox']>) => ({ x: bbox.x + bbox.w / 2, y: bbox.y + bbox.h / 2 });
const bboxIou = (a?: Detection['bbox'], b?: Detection['bbox']) => {
  if (!a || !b) return 0;
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.w * a.h + b.w * b.h - intersection;
  return union > 0 ? intersection / union : 0;
};

const movementHeading = (from: TrackPoint, to: TrackPoint) => {
  const angle = (Math.atan2(to.x - from.x, from.y - to.y) * 180) / Math.PI;
  return (angle + 360) % 360;
};

const targetGeoPoint = (telemetry: Telemetry, detection: Detection, trackIndex: number, now: number): GeoPoint | null => {
  if (typeof detection.world_position?.lat === 'number' && typeof detection.world_position?.lng === 'number') return { lat: detection.world_position.lat, lng: detection.world_position.lng, t: now };
  if (typeof telemetry.lat !== 'number' || typeof telemetry.lng !== 'number' || typeof detection.distance_meters !== 'number') return null;
  const bearing = ((telemetry.heading ?? 0) + trackIndex * 16) * (Math.PI / 180);
  return {
    lat: telemetry.lat + Math.cos(bearing) * detection.distance_meters * 0.000009,
    lng: telemetry.lng + Math.sin(bearing) * detection.distance_meters * 0.000012,
    t: now,
  };
};

const threatLevel = (distanceMeters: number | null, speedMetersPerSecond: number | null, headingDegrees: number | null, droneHeading: number | null): TrackedDetection['threatLevel'] => {
  let score = 0;
  if (distanceMeters !== null) score += distanceMeters < 45 ? 55 : distanceMeters < 90 ? 38 : distanceMeters < 180 ? 22 : 8;
  if (speedMetersPerSecond !== null) score += speedMetersPerSecond > 18 ? 32 : speedMetersPerSecond > 9 ? 22 : speedMetersPerSecond > 3 ? 10 : 0;
  if (headingDegrees !== null && droneHeading !== null) {
    const delta = Math.abs((((headingDegrees - droneHeading + 540) % 360) - 180));
    score += delta > 135 ? 16 : delta > 95 ? 10 : 0;
  }
  if (score >= 82) return 'CRITICAL';
  if (score >= 58) return 'HIGH';
  if (score >= 32) return 'MEDIUM';
  return 'LOW';
};

const matchScore = (track: BotSortTrack, detection: Detection, now: number) => {
  if (!detection.bbox || normalizeLabel(track.label) !== normalizeLabel(detection.label || 'unknown')) return -Infinity;
  const dt = Math.min(1.5, Math.max(0.05, (now - track.lastSeen) / 1000));
  const predicted = { x: centerOf(track.bbox).x + track.velocityX * dt, y: centerOf(track.bbox).y + track.velocityY * dt };
  const actual = centerOf(detection.bbox);
  const diagonal = Math.hypot(Math.max(track.bbox.w, detection.bbox.w), Math.max(track.bbox.h, detection.bbox.h));
  const distanceScore = 1 - clamp(Math.hypot(predicted.x - actual.x, predicted.y - actual.y) / Math.max(80, diagonal * 2.4), 0, 1);
  return bboxIou(track.bbox, detection.bbox) * 0.62 + distanceScore * 0.3 + detection.confidence * 0.08;
};

const updateTrack = (track: BotSortTrack, detection: Detection, telemetry: Telemetry, now: number, trackIndex: number): BotSortTrack => {
  const bbox = detection.bbox as NonNullable<Detection['bbox']>;
  const previousCenter = centerOf(track.bbox);
  const nextCenter = centerOf(bbox);
  const dt = Math.max(0.08, (now - track.lastSeen) / 1000);
  const rawVelocityX = (nextCenter.x - previousCenter.x) / dt;
  const rawVelocityY = (nextCenter.y - previousCenter.y) / dt;
  const nextTrajectory = [...track.trajectory, { ...nextCenter, t: now }].slice(-48);
  const speedPx = Math.hypot(rawVelocityX, rawVelocityY);
  const estimatedMetersPerSecond = typeof detection.distance_meters === 'number'
    ? clamp((speedPx / Math.max(20, Math.max(bbox.w, bbox.h))) * (detection.distance_meters / 30), 0, 42)
    : track.objectSpeedMetersPerSecond;
  const heading = nextTrajectory.length > 1 ? movementHeading(nextTrajectory[nextTrajectory.length - 2], nextTrajectory[nextTrajectory.length - 1]) : track.movementHeadingDegrees;
  const geo = targetGeoPoint(telemetry, detection, trackIndex, now);
  return {
    ...track,
    label: detection.label || track.label,
    bbox,
    confidence: detection.confidence,
    lastSeen: now,
    missFrames: 0,
    hits: track.hits + 1,
    velocityX: track.velocityX * 0.45 + rawVelocityX * 0.55,
    velocityY: track.velocityY * 0.45 + rawVelocityY * 0.55,
    trajectory: nextTrajectory,
    geoHistory: geo ? [...track.geoHistory, geo].slice(-48) : track.geoHistory,
    distanceMeters: typeof detection.distance_meters === 'number' ? Math.round(detection.distance_meters) : track.distanceMeters,
    movementHeadingDegrees: heading,
    objectSpeedMetersPerSecond: estimatedMetersPerSecond,
  };
};

const createTrack = (detection: Detection, telemetry: Telemetry, now: number, sequence: number, index: number): BotSortTrack => {
  const bbox = detection.bbox as NonNullable<Detection['bbox']>;
  const backendTrack = detection.track_id ?? detection.id;
  const label = detection.label || 'unknown';
  const color = CLASS_COLORS[normalizeLabel(label)] ?? '#00ffd5';
  const trackId = backendTrack !== undefined ? `T-${backendTrack}` : `BT-${String(sequence).padStart(3, '0')}`;
  const geo = targetGeoPoint(telemetry, detection, index, now);
  return {
    uid: backendTrack !== undefined ? String(backendTrack) : `botsort-${sequence}`,
    trackId,
    label,
    color,
    bbox,
    confidence: detection.confidence,
    firstSeen: now,
    lastSeen: now,
    createdAt: detection.created_at || new Date(now).toISOString(),
    velocityX: 0,
    velocityY: 0,
    missFrames: 0,
    hits: 1,
    trajectory: [{ ...centerOf(bbox), t: now }],
    geoHistory: geo ? [geo] : [],
    distanceMeters: typeof detection.distance_meters === 'number' ? Math.round(detection.distance_meters) : null,
    movementHeadingDegrees: null,
    objectSpeedMetersPerSecond: null,
  };
};

const buildTrackedDetections = (detections: Detection[], previousTracks: BotSortTrack[], sequence: number, telemetry: Telemetry): { tracked: TrackedDetection[]; tracks: BotSortTrack[]; sequence: number } => {
  const now = Date.now();
  const activeTracks = previousTracks.filter((track) => now - track.lastSeen < 14000);
  const detectionsWithBoxes = detections.filter((item) => item.bbox);
  const highConfidence = detectionsWithBoxes.filter((item) => item.confidence >= 0.5);
  const lowConfidence = detectionsWithBoxes.filter((item) => item.confidence < 0.5 && item.confidence >= 0.12);
  const usedTracks = new Set<string>();
  const usedDetections = new Set<Detection>();
  let nextSequence = sequence;
  let tracks = [...activeTracks];

  const associate = (pool: Detection[], threshold: number) => {
    pool.forEach((detection, index) => {
      const backendTrack = detection.track_id ?? detection.id;
      let matched = backendTrack !== undefined ? tracks.find((track) => track.uid === String(backendTrack) && !usedTracks.has(track.uid)) : undefined;
      if (!matched) {
        matched = tracks
          .filter((track) => !usedTracks.has(track.uid))
          .map((track) => ({ track, score: matchScore(track, detection, now) }))
          .sort((left, right) => right.score - left.score)
          .find(({ score }) => score >= threshold)?.track;
      }
      if (matched) {
        usedTracks.add(matched.uid);
        usedDetections.add(detection);
        tracks = tracks.map((track) => (track.uid === matched?.uid ? updateTrack(track, detection, telemetry, now, index) : track));
      }
    });
  };

  associate(highConfidence, 0.34);
  associate(lowConfidence, 0.46);

  detectionsWithBoxes.forEach((detection, index) => {
    if (usedDetections.has(detection)) return;
    nextSequence += 1;
    tracks.push(createTrack(detection, telemetry, now, nextSequence, index));
  });

  tracks = tracks
    .map((track) => (usedTracks.has(track.uid) || track.lastSeen === now ? track : { ...track, missFrames: track.missFrames + 1, confidence: track.confidence * 0.86 }))
    .filter((track) => now - track.lastSeen < 14000);

  const tracked = tracks
    .filter((track) => track.hits >= 1 && (track.missFrames <= 20 || now - track.lastSeen < 10000))
    .map((track, index) => ({
      label: track.label,
      confidence: clamp(track.confidence, 0.05, 1),
      bbox: track.bbox,
      created_at: track.createdAt,
      source: track.missFrames > 0 ? 'botsort_prediction' : 'yolo',
      uid: track.uid,
      trackId: track.trackId,
      color: track.color,
      displayLabel: track.label,
      distanceMeters: track.distanceMeters,
      ageSeconds: Math.max(0, Math.round((now - track.firstSeen) / 1000)),
      isLocked: index === 0 && track.confidence >= 0.55,
      firstSeen: new Date(track.firstSeen).toISOString(),
      lastSeen: new Date(track.lastSeen).toISOString(),
      trackingSeconds: Math.max(0, Math.round((now - track.firstSeen) / 1000)),
      objectSpeedMetersPerSecond: track.objectSpeedMetersPerSecond,
      movementHeadingDegrees: track.movementHeadingDegrees,
      threatLevel: threatLevel(track.distanceMeters, track.objectSpeedMetersPerSecond, track.movementHeadingDegrees, telemetry.heading),
      trajectory: track.trajectory,
      geoHistory: track.geoHistory,
      isPredicted: track.missFrames > 0,
    } satisfies TrackedDetection));

  return { tracked, tracks, sequence: nextSequence };
};

const demoFrame = (time: number) => {
  const a = (time / 900) % 360;
  const x = 42 + Math.sin(time / 1100) * 18;
  const y = 46 + Math.cos(time / 1500) * 11;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1280 720'><defs><radialGradient id='g' cx='50%' cy='45%'><stop offset='0' stop-color='#123447'/><stop offset='1' stop-color='#02060a'/></radialGradient><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='.2'/><feComponentTransfer><feFuncA type='table' tableValues='0 .16'/></feComponentTransfer></filter></defs><rect width='1280' height='720' fill='url(#g)'/><rect width='1280' height='720' filter='url(#n)' opacity='.45'/><g stroke='#00ffd5' stroke-opacity='.22' fill='none'><path d='M0 520 C260 430 470 560 760 430 S1110 340 1280 410'/><path d='M0 600 C260 520 520 650 850 520 S1120 480 1280 530'/></g><g transform='translate(${x * 12.8} ${y * 7.2}) rotate(${a})'><path d='M-90 -28 L90 -28 L128 0 L90 28 L-90 28 Z' fill='#101820' stroke='#2bdfff' stroke-width='4'/><circle r='18' fill='#00ffd5'/></g><g fill='#ffc107' opacity='.85'><circle cx='930' cy='250' r='9'/><circle cx='970' cy='270' r='5'/></g><text x='42' y='58' font-family='monospace' font-size='28' fill='#00ffd5'>UZ DRONE AI DEMO EO STREAM</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const createDemoUpdate = (previous: LiveUpdate): LiveUpdate => {
  const now = Date.now();
  const seconds = now / 1000;
  const lat = 41.3111 + Math.sin(seconds / 18) * 0.004;
  const lng = 69.2797 + Math.cos(seconds / 16) * 0.005;
  const heading = (seconds * 9) % 360;
  const detections: Detection[] = [
    { track_id: 'D-01', label: 'vehicle', confidence: 0.91, bbox: { x: 315 + Math.sin(seconds) * 46, y: 220 + Math.cos(seconds / 1.4) * 18, w: 142, h: 78 }, distance_meters: 118 + Math.sin(seconds / 3) * 22, world_position: { lat: lat + 0.0015, lng: lng + 0.002 }, created_at: new Date(now - 12000).toISOString(), source: 'demo_yolo' },
    { track_id: 'P-17', label: 'person', confidence: 0.83, bbox: { x: 810 + Math.cos(seconds / 1.1) * 34, y: 260 + Math.sin(seconds / 1.7) * 24, w: 58, h: 132 }, distance_meters: 64 + Math.cos(seconds / 2) * 12, world_position: { lat: lat - 0.0012, lng: lng + 0.0013 }, created_at: new Date(now - 26000).toISOString(), source: 'demo_yolo' },
    { track_id: 'UAV-2', label: 'drone', confidence: 0.76, bbox: { x: 610 + Math.sin(seconds / 1.9) * 74, y: 120 + Math.cos(seconds / 2.2) * 30, w: 74, h: 42 }, distance_meters: 210, world_position: { lat: lat + 0.0022, lng: lng - 0.001 }, created_at: new Date(now - 7000).toISOString(), source: 'demo_yolo' },
  ];
  const telemetry: Telemetry = { speed: 54 + Math.sin(seconds / 3) * 7, altitude: 128 + Math.cos(seconds / 5) * 12, battery: 82 - ((seconds / 20) % 9), signal: 93, distance: 1.7, heading, lat, lng, created_at: new Date(now).toISOString() };
  const route = [...previous.route, telemetry].filter((point) => point.lat !== null).slice(-80);
  return { type: 'live_update', camera_status: 'CAMERA_ONLINE', video: { online: true, status: 'CAMERA_ONLINE', frame: demoFrame(now), fps: 30, latency_ms: 38, resolution: '1280x720 DEMO', width: 1280, height: 720, last_seen: new Date(now).toISOString(), frame_number: Math.round(seconds * 30) }, telemetry, detections, route, ai: { engine: 'demo-yolo', model_status: 'demo_active' } };
};

const normalizeLiveUpdate = (message: LiveMessage, previous: LiveUpdate): LiveUpdate => {
  if (message.type === 'live_update') {
    return { ...message, detections: Array.isArray(message.detections) ? message.detections : [], route: Array.isArray(message.route) ? message.route : [], ai: message.ai ?? previous.ai };
  }
  return { ...previous, camera_status: message.camera_status, video: message.video, detections: Array.isArray(message.detections) ? message.detections : previous.detections };
};

export default function App() {
  const [data, setData] = useState<LiveUpdate>(emptyLiveUpdate());
  const [socketState, setSocketState] = useState<SocketState>('CONNECTING');
  const [socketError, setSocketError] = useState<string>('');
  const [selectedDetectionId, setSelectedDetectionId] = useState<string | null>(null);
  const [mission, setMission] = useState<MissionState>(createMission());
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const detectionTracksRef = useRef<BotSortTrack[]>([]);
  const detectionSequenceRef = useRef(0);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let disposed = false;
    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
    const markCameraOffline = () => {
      setData((previous) => ({ ...previous, camera_status: 'CAMERA_OFFLINE', video: { ...previous.video, online: false, status: 'CAMERA_OFFLINE', frame: null, fps: 0, resolution: 'offline' }, detections: [] }));
    };
    const scheduleReconnect = () => {
      if (disposed) return;
      const attempt = reconnectAttemptRef.current + 1;
      reconnectAttemptRef.current = attempt;
      const delay = Math.min(1000 * 2 ** (attempt - 1), 10000);
      setSocketState('RECONNECTING');
      setSocketError(`Повторное подключение через ${Math.round(delay / 1000)}с (попытка ${attempt})`);
      clearReconnectTimer();
      reconnectTimerRef.current = window.setTimeout(connect, delay);
    };
    const connect = () => {
      if (disposed) return;
      clearReconnectTimer();
      setSocketState(reconnectAttemptRef.current > 0 ? 'RECONNECTING' : 'CONNECTING');
      const url = liveWebSocketUrl();
      socket = new WebSocket(url);
      socket.onopen = () => { reconnectAttemptRef.current = 0; setSocketState('CONNECTED'); setSocketError(''); };
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as LiveMessage;
          if (message.type !== 'live_update' && message.type !== 'camera_frame' && message.type !== 'camera_status') return;
          setData((previous) => normalizeLiveUpdate(message, previous));
        } catch (error) {
          const details = error instanceof Error ? error.message : 'Unknown JSON parse error';
          setSocketState('ERROR');
          setSocketError(`Некорректное сообщение WebSocket: ${details}`);
          console.error('Live WebSocket message parse failed', error, event.data);
        }
      };
      socket.onerror = (event) => { setSocketState('ERROR'); setSocketError(`Ошибка WebSocket ${url}`); console.error('Live WebSocket error', event); };
      socket.onclose = (event) => {
        if (disposed) return;
        setSocketState('DISCONNECTED');
        setSocketError(`WebSocket закрыт: code=${event.code}, reason=${event.reason || 'no reason'}`);
        markCameraOffline();
        scheduleReconnect();
      };
    };
    connect();
    return () => { disposed = true; clearReconnectTimer(); socket?.close(1000, 'React component unmounted'); };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setData((previous) => (previous.video.online && previous.ai?.model_status !== 'demo_active' ? previous : createDemoUpdate(previous)));
    }, 250);
    return () => window.clearInterval(timer);
  }, []);

  const trackedDetections = useMemo(() => {
    const result = buildTrackedDetections(data.detections, detectionTracksRef.current, detectionSequenceRef.current, data.telemetry);
    detectionTracksRef.current = result.tracks;
    detectionSequenceRef.current = result.sequence;
    return result.tracked;
  }, [data.detections, data.telemetry]);

  const selectedDetection = trackedDetections.find((item) => item.uid === selectedDetectionId);
  const isDemoMode = data.ai?.model_status === 'demo_active';
  const linkLabel = useMemo(() => {
    if (isDemoMode) return 'DEMO MODE ACTIVE';
    if (socketState === 'CONNECTED') return 'BACKEND LINK CONNECTED';
    if (socketState === 'CONNECTING') return 'CONNECTING TO BACKEND';
    if (socketState === 'RECONNECTING') return 'RECONNECTING TO BACKEND';
    if (socketState === 'ERROR') return 'BACKEND LINK ERROR';
    return 'BACKEND LINK DISCONNECTED';
  }, [isDemoMode, socketState]);

  const addWaypoint = () => {
    const point = missionPointFromTelemetry(data.telemetry, 'waypoint', `WP-${mission.waypoints.length + 1}`);
    if (point) setMission((current) => ({ ...current, waypoints: [...current.waypoints, point] }));
  };
  const addPoi = () => {
    const point = missionPointFromDetection(selectedDetection, `${selectedDetection?.trackId ?? 'TARGET'} POI`);
    if (point) setMission((current) => ({ ...current, pois: [...current.pois, point] }));
  };
  const addGeoFence = () => {
    const zone = geoFenceAroundTelemetry(data.telemetry, `RESTRICTED-${mission.geoFences.length + 1}`);
    if (zone) setMission((current) => ({ ...current, geoFences: [...current.geoFences, zone] }));
  };
  const saveMission = () => localStorage.setItem('uz-drone-ai-mission', JSON.stringify(mission));
  const loadMission = () => {
    const stored = localStorage.getItem('uz-drone-ai-mission');
    if (stored) setMission(JSON.parse(stored) as MissionState);
  };

  return (
    <main className="gcs-app">
      <header className="top-command-bar">
        <div className="brand-block">
          <div className="brand-mark"><Shield size={22} /></div>
          <div><h1>UZ DRONE AI</h1><p>TACTICAL GROUND CONTROL STATION</p></div>
        </div>
        <div className="system-strip" aria-label="System state">
          <span className={data.video.online ? 'pill online' : 'pill danger'}>{isDemoMode ? 'DEMO_STREAM' : data.camera_status}</span>
          <span className={socketState === 'CONNECTED' && !isDemoMode ? 'pill online' : 'pill warning'} title={socketError}>{socketState === 'CONNECTED' && !isDemoMode ? <Wifi size={14} /> : <WifiOff size={14} />} {linkLabel}</span>
          <span className="pill"><Radio size={14} /> {data.video.resolution || 'NO VIDEO'}</span>
          <span className="pill" title={data.ai?.model_status}>AI {data.ai?.model_status ?? 'unknown'}</span>
        </div>
      </header>

      <div className="dashboard-grid">
        <VideoPanel video={data.video} telemetry={data.telemetry} detections={trackedDetections} selectedDetectionId={selectedDetectionId} onSelectDetection={setSelectedDetectionId} aiStatus={data.ai?.model_status} />
        <AiDetectionPanel detections={trackedDetections} selectedDetectionId={selectedDetectionId} onSelectDetection={setSelectedDetectionId} />
        <MissionControlPanel mission={mission} telemetry={data.telemetry} route={data.route} detections={trackedDetections} selectedDetection={selectedDetection} onCreateMission={() => setMission(createMission())} onAddWaypoint={addWaypoint} onAddPoi={addPoi} onAddGeoFence={addGeoFence} onSaveMission={saveMission} onLoadMission={loadMission} />
        <TelemetryPanel telemetry={data.telemetry} />
        <DroneMap telemetry={data.telemetry} route={data.route} detections={trackedDetections} selectedDetectionId={selectedDetectionId} onSelectDetection={setSelectedDetectionId} mission={mission} />
      </div>
    </main>
  );
}
