import { Radio, Shield, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { emptyLiveUpdate, liveWebSocketUrl, type LiveMessage, type LiveUpdate } from './api/live';
import './App.css';
import { AiDetectionPanel } from './components/AiDetectionPanel';
import { DroneMap } from './components/DroneMap';
import { TelemetryPanel } from './components/TelemetryPanel';
import { VideoPanel } from './components/VideoPanel';

type SocketState = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR';

const normalizeLiveUpdate = (message: LiveMessage, previous: LiveUpdate): LiveUpdate => {
  if (message.type === 'live_update') {
    return {
      ...message,
      detections: Array.isArray(message.detections) ? message.detections : [],
      route: Array.isArray(message.route) ? message.route : [],
    };
  }

  return {
    ...previous,
    camera_status: message.camera_status,
    video: message.video,
  };
};

export default function App() {
  const [data, setData] = useState<LiveUpdate>(emptyLiveUpdate());
  const [socketState, setSocketState] = useState<SocketState>('CONNECTING');

  useEffect(() => {
    const socket = new WebSocket(liveWebSocketUrl());

    socket.onopen = () => setSocketState('CONNECTED');

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as LiveMessage;
        if (message.type !== 'live_update' && message.type !== 'camera_frame' && message.type !== 'camera_status') {
          return;
        }
        setData((previous) => normalizeLiveUpdate(message, previous));
      } catch {
        setSocketState('ERROR');
      }
    };

    socket.onerror = () => setSocketState('ERROR');

    socket.onclose = () => {
      setSocketState('DISCONNECTED');
      setData((previous) => ({
        ...previous,
        camera_status: 'CAMERA_OFFLINE',
        video: { ...previous.video, online: false, status: 'CAMERA_OFFLINE', frame: null, fps: 0, resolution: 'offline' },
      }));
    };

    return () => socket.close();
  }, []);

  const linkLabel = useMemo(() => {
    if (socketState === 'CONNECTED') return 'BACKEND LINK CONNECTED';
    if (socketState === 'CONNECTING') return 'CONNECTING TO BACKEND';
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
          <span className={socketState === 'CONNECTED' ? 'pill online' : 'pill warning'}>{socketState === 'CONNECTED' ? <Wifi size={14} /> : <WifiOff size={14} />} {linkLabel}</span>
          <span className="pill"><Radio size={14} /> {data.video.resolution || 'NO VIDEO'}</span>
        </div>
      </header>

      <div className="dashboard-grid">
        <VideoPanel video={data.video} telemetry={data.telemetry} />
        <AiDetectionPanel detections={data.detections} />
        <TelemetryPanel telemetry={data.telemetry} />
        <DroneMap telemetry={data.telemetry} route={data.route} />
      </div>
    </main>
  );
}
