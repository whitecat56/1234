import { Radio, Shield, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { emptyLiveUpdate, liveWebSocketUrl, type Detection, type LiveMessage, type LiveUpdate } from './api/live';
import './App.css';
import { AiDetectionPanel } from './components/AiDetectionPanel';
import { DroneMap } from './components/DroneMap';
import { TelemetryPanel } from './components/TelemetryPanel';
import { VideoPanel, type TrackedDetection } from './components/VideoPanel';

type SocketState = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'RECONNECTING';


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

const buildTrackedDetections = (detections: Detection[], telemetryDistance: number | null): TrackedDetection[] => {
  const now = Date.now();
  return detections.map((item, index) => {
    const labelKey = normalizeLabel(item.label || 'unknown');
    const trackId = `T-${String(index + 1).padStart(3, '0')}`;
    const created = item.created_at ? new Date(item.created_at).getTime() : now;
    const ageSeconds = Number.isFinite(created) ? Math.max(0, Math.round((now - created) / 1000)) : null;
    return {
      ...item,
      uid: `${trackId}-${item.created_at || index}`,
      trackId,
      displayLabel: item.label || 'unknown',
      color: CLASS_COLORS[labelKey] ?? '#00ffd5',
      distanceMeters: typeof telemetryDistance === 'number' ? Math.max(25, Math.round(telemetryDistance * 1000 + index * 37)) : Math.round(90 + index * 42),
      ageSeconds,
      isLocked: index === 0 && item.confidence >= 0.65,
    };
  });
};

const normalizeLiveUpdate = (message: LiveMessage, previous: LiveUpdate): LiveUpdate => {
  if (message.type === 'live_update') {
    return {
      ...message,
      detections: Array.isArray(message.detections) ? message.detections : [],
      route: Array.isArray(message.route) ? message.route : [],
      ai: message.ai ?? previous.ai,
    };
  }

  return {
    ...previous,
    camera_status: message.camera_status,
    video: message.video,
    detections: Array.isArray(message.detections) ? message.detections : previous.detections,
  };
};

export default function App() {
  const [data, setData] = useState<LiveUpdate>(emptyLiveUpdate());
  const [socketState, setSocketState] = useState<SocketState>('CONNECTING');
  const [socketError, setSocketError] = useState<string>('');
  const [selectedDetectionId, setSelectedDetectionId] = useState<string | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);

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
      setData((previous) => ({
        ...previous,
        camera_status: 'CAMERA_OFFLINE',
        video: { ...previous.video, online: false, status: 'CAMERA_OFFLINE', frame: null, fps: 0, resolution: 'offline' },
        detections: [],
      }));
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

      socket.onopen = () => {
        reconnectAttemptRef.current = 0;
        setSocketState('CONNECTED');
        setSocketError('');
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as LiveMessage;
          if (message.type !== 'live_update' && message.type !== 'camera_frame' && message.type !== 'camera_status') {
            return;
          }
          setData((previous) => normalizeLiveUpdate(message, previous));
        } catch (error) {
          const details = error instanceof Error ? error.message : 'Unknown JSON parse error';
          setSocketState('ERROR');
          setSocketError(`Некорректное сообщение WebSocket: ${details}`);
          console.error('Live WebSocket message parse failed', error, event.data);
        }
      };

      socket.onerror = (event) => {
        setSocketState('ERROR');
        setSocketError(`Ошибка WebSocket ${url}`);
        console.error('Live WebSocket error', event);
      };

      socket.onclose = (event) => {
        if (disposed) return;
        setSocketState('DISCONNECTED');
        setSocketError(`WebSocket закрыт: code=${event.code}, reason=${event.reason || 'no reason'}`);
        markCameraOffline();
        scheduleReconnect();
      };
    };

    connect();

    return () => {
      disposed = true;
      clearReconnectTimer();
      socket?.close(1000, 'React component unmounted');
    };
  }, []);

  const trackedDetections = useMemo(() => buildTrackedDetections(data.detections, data.telemetry.distance), [data.detections, data.telemetry.distance]);

  const selectedDetection = trackedDetections.find((item) => item.uid === selectedDetectionId);

  const linkLabel = useMemo(() => {
    if (socketState === 'CONNECTED') return 'BACKEND LINK CONNECTED';
    if (socketState === 'CONNECTING') return 'CONNECTING TO BACKEND';
    if (socketState === 'RECONNECTING') return 'RECONNECTING TO BACKEND';
    if (socketState === 'ERROR') return 'BACKEND LINK ERROR';
    return 'BACKEND LINK DISCONNECTED';
  }, [socketState]);

  return (
    <main className="gcs-app">
      <header className="top-command-bar">
        <div className="brand-block">
          <div className="brand-mark"><Shield size={22} /></div>
          <div>
            <h1>UZ DRONE AI</h1>
            <p>DJI MATRICE 30T GROUND CONTROL STATION</p>
          </div>
        </div>
        <div className="system-strip" aria-label="System state">
          <span className={data.video.online ? 'pill online' : 'pill danger'}>{data.camera_status}</span>
          <span className={socketState === 'CONNECTED' ? 'pill online' : 'pill warning'} title={socketError}>{socketState === 'CONNECTED' ? <Wifi size={14} /> : <WifiOff size={14} />} {linkLabel}</span>
          <span className="pill"><Radio size={14} /> {data.video.resolution || 'NO VIDEO'}</span>
          <span className="pill" title={data.ai?.model_status}>AI {data.ai?.model_status ?? 'unknown'}</span>
        </div>
      </header>

      <div className="dashboard-grid">
        <VideoPanel video={data.video} telemetry={data.telemetry} detections={trackedDetections} selectedDetectionId={selectedDetectionId} onSelectDetection={setSelectedDetectionId} aiStatus={data.ai?.model_status} />
        <AiDetectionPanel detections={trackedDetections} selectedDetectionId={selectedDetectionId} onSelectDetection={setSelectedDetectionId} />
        <TelemetryPanel telemetry={data.telemetry} />
        <DroneMap telemetry={data.telemetry} route={data.route} detections={trackedDetections} selectedDetectionId={selectedDetectionId} onSelectDetection={setSelectedDetectionId} />
      </div>
    </main>
  );
}
