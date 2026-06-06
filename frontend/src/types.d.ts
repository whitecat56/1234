declare namespace JSX {
  interface IntrinsicElements {
    [elementName: string]: any;
  }
}

declare module 'react' {
  export const StrictMode: any;
  export function useEffect(effect: () => void | (() => void), deps?: unknown[]): void;
  export function useMemo<T>(factory: () => T, deps?: unknown[]): T;
  export function useCallback<T extends (...args: any[]) => any>(callback: T, deps?: unknown[]): T;
  export function useRef<T>(initial: T): { current: T };
  export function memo<T>(component: T): T;
  export function useState<T>(initial: T): [T, (value: T | ((current: T) => T)) => void];
  export type WheelEvent<T = Element> = any;
  const React: any;
  export default React;
}

declare module 'react-dom/client' {
  export const createRoot: any;
}

declare module 'react/jsx-runtime' {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}

declare module 'framer-motion' {
  export const motion: any;
  export const AnimatePresence: any;
}

declare module 'lucide-react' {
  export const Activity: any;
  export const WifiOff: any;
  export const Wifi: any;
  export const Target: any;
  export const StopCircle: any;
  export const Shield: any;
  export const Satellite: any;
  export const Ruler: any;
  export const Radio: any;
  export const MapPin: any;
  export const Download: any;
  export const Compass: any;
  export const Clock: any;
  export const Camera: any;
  export const Battery: any;
  export const BarChart3: any;
  export const Bot: any;
  export const Crosshair: any;
  export const FileText: any;
  export const Gauge: any;
  export const Home: any;
  export const Map: any;
  export const Maximize2: any;
  export const Radar: any;
  export const Route: any;
  export const Search: any;
  export const Settings: any;
  export const Square: any;
  export const Video: any;
}

declare module 'recharts' {
  export const Area: any;
  export const AreaChart: any;
  export const CartesianGrid: any;
  export const ResponsiveContainer: any;
  export const Tooltip: any;
  export const XAxis: any;
  export const YAxis: any;
}

declare module 'react-leaflet' {
  export const CircleMarker: any;
  export const MapContainer: any;
  export const Polyline: any;
  export const Popup: any;
  export const TileLayer: any;
  export const useMap: any;
  export const useMapEvents: any;
}

declare module '*.css';
