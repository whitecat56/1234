/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_WS_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'leaflet/dist/leaflet.css';
