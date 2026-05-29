import { AnimatePresence, motion } from 'framer-motion';
import { Activity, BarChart3, Bot, Crosshair, FileText, Gauge, Home, Map, Maximize2, Radar, Route, Search, Settings, Square, Video } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { demoUpdate, type Detection, type LiveUpdate } from './api/live';
import { DroneMap } from './components/DroneMap';
import { MetricCard } from './components/MetricCard';

const sections = [
  { id: 'Главная', icon: Home },
  { id: 'Видео', icon: Video },
  { id: 'Карта', icon: Map },
  { id: 'Поиск', icon: Search },
  { id: 'Миссии', icon: Route },
  { id: 'Телеметрия', icon: Gauge },
  { id: 'Аналитика', icon: BarChart3 },
  { id: 'Настройки', icon: Settings },
  { id: 'Логи', icon: FileText },
];

const logs = [
  'Система AI-детекции активирована',
  'Маршрут Север-1 загружен в память миссии',
  'Обнаружена цель с вероятностью 91%',
  'Канал телеметрии стабилен, потери пакетов 0.2%',
];

function LiveFeed({ data }: { data: LiveUpdate }) {
  return (
    <div className="glass-panel scanline relative h-full overflow-hidden rounded-[2rem] border-cyan-400/30">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.14),transparent_42%),linear-gradient(135deg,rgba(6,182,212,0.08),rgba(0,0,0,0.58))]" />
      <div className="absolute left-6 top-6 z-10 flex items-center gap-3">
        <span className="h-3 w-3 animate-pulse rounded-full bg-red-500 shadow-[0_0_18px_#ef4444]" />
        <span className="text-sm font-bold uppercase tracking-[0.4em] text-green-300">LIVE DRONE FEED</span>
      </div>
      <button className="absolute right-6 top-6 z-10 rounded-xl border border-cyan-300/30 bg-cyan-300/10 p-3 text-cyan-200 transition hover:bg-cyan-300/20">
        <Maximize2 size={18} />
      </button>
      <div className="absolute inset-10 top-20 rounded-[1.5rem] border border-green-400/15 bg-black/35">
        {data.detections.slice(0, 4).map((item, index) => (
          <motion.div
            key={`${item.label}-${index}`}
            className="absolute rounded-xl border-2 border-green-400/80 bg-green-400/10 shadow-[0_0_32px_rgba(34,197,94,0.35)]"
            style={{ left: `${9 + index * 18}%`, top: `${18 + index * 10}%`, width: `${13 + index * 2}%`, height: `${14 + index}%` }}
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <span className="absolute -top-7 left-0 rounded bg-green-400 px-2 py-1 text-xs font-black text-black">{item.label} {(item.confidence * 100).toFixed(0)}%</span>
          </motion.div>
        ))}
        <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/40">
          <Crosshair className="m-auto mt-8 text-cyan-200" />
        </div>
      </div>
      <div className="absolute bottom-6 left-6 right-6 z-10 grid grid-cols-3 gap-3">
        <MetricCard title="FPS" value={`${data.video.fps}`} />
        <MetricCard title="Задержка" value={`${data.video.latency_ms} мс`} accent="cyan" />
        <MetricCard title="Разрешение" value={data.video.resolution} accent="amber" />
      </div>
    </div>
  );
}

function AIModule({ detections }: { detections: Detection[] }) {
  return (
    <aside className="glass-panel flex h-full flex-col rounded-[2rem] p-5">
      <div className="flex items-center gap-3 border-b border-green-400/15 pb-4">
        <Bot className="text-green-300" />
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">AI МОДУЛЬ</p>
          <h2 className="text-xl font-black text-white">Цели и события</h2>
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {detections.map((item, index) => (
          <motion.div key={`${item.label}-${index}`} className="rounded-2xl border border-cyan-300/15 bg-slate-950/55 p-4" whileHover={{ scale: 1.02 }}>
            <div className="flex items-center justify-between">
              <span className="font-bold text-cyan-100">{item.label}</span>
              <span className="text-green-300">{Math.round(item.confidence * 100)}%</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-gradient-to-r from-green-400 to-cyan-300" style={{ width: `${item.confidence * 100}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-400">Время обнаружения: {new Date(item.created_at).toLocaleTimeString('ru-RU')}</p>
          </motion.div>
        ))}
      </div>
      <div className="mt-5 flex-1 rounded-2xl border border-green-400/15 bg-black/25 p-4">
        <p className="mb-3 text-xs uppercase tracking-[0.3em] text-green-300">Журнал событий</p>
        <div className="space-y-3 text-sm text-slate-300">
          {logs.map((log) => <p key={log}>▸ {log}</p>)}
        </div>
      </div>
    </aside>
  );
}

export default function App() {
  const [active, setActive] = useState('Главная');
  const [tick, setTick] = useState(1);
  const data = useMemo(() => demoUpdate(tick), [tick]);
  const chartData = useMemo(() => Array.from({ length: 24 }, (_, index) => demoUpdate(tick + index).telemetry), [tick]);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 1200);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="h-screen p-5 text-slate-100">
      <div className="grid h-full grid-cols-[260px_1fr_360px] gap-5">
        <nav className="glass-panel rounded-[2rem] p-5">
          <div className="mb-8 flex items-center gap-3">
            <div className="rounded-2xl bg-green-400/15 p-3 text-green-300 shadow-[0_0_24px_rgba(34,197,94,0.32)]"><Radar /></div>
            <div>
              <h1 className="neon-text text-2xl font-black tracking-tight">UZ DRONE AI</h1>
              <p className="text-xs uppercase tracking-[0.32em] text-slate-400">тактическая платформа</p>
            </div>
          </div>
          <div className="space-y-2">
            {sections.map(({ id, icon: Icon }) => (
              <button key={id} onClick={() => setActive(id)} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left font-semibold transition ${active === id ? 'bg-green-400 text-black shadow-[0_0_26px_rgba(34,197,94,0.38)]' : 'text-slate-300 hover:bg-white/8 hover:text-white'}`}>
                <Icon size={18} /> {id}
              </button>
            ))}
          </div>
          <div className="mt-8 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4">
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-200">Статус канала</p>
            <p className="mt-2 text-2xl font-black text-green-300">БОЕВАЯ ГОТОВНОСТЬ</p>
          </div>
        </nav>

        <section className="flex min-w-0 flex-col gap-5">
          <header className="glass-panel flex items-center justify-between rounded-[2rem] p-5">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-green-300">{active}</p>
              <h2 className="text-3xl font-black">Командный центр FPV-дрона</h2>
            </div>
            <div className="flex gap-3">
              <button className="rounded-2xl bg-green-400 px-5 py-3 font-black text-black transition hover:bg-green-300">Запуск миссии</button>
              <button className="rounded-2xl border border-red-400/40 bg-red-500/10 px-5 py-3 font-black text-red-200 transition hover:bg-red-500/20"><Square className="inline" size={16} /> Стоп</button>
            </div>
          </header>

          <div className="grid flex-1 grid-rows-[1.35fr_0.9fr] gap-5 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div key={active} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }} className="min-h-0">
                {active === 'Карта' ? <div className="glass-panel h-full rounded-[2rem] p-3"><DroneMap telemetry={data.telemetry} route={data.route} /></div> : <LiveFeed data={data} />}
              </motion.div>
            </AnimatePresence>

            <div className="grid grid-cols-[1fr_1fr] gap-5 overflow-hidden">
              <div className="glass-panel rounded-[2rem] p-5">
                <p className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-200">Телеметрия</p>
                <div className="grid grid-cols-3 gap-3">
                  <MetricCard title="Скорость" value={`${data.telemetry.speed} км/ч`} />
                  <MetricCard title="Высота" value={`${data.telemetry.altitude} м`} accent="cyan" />
                  <MetricCard title="Батарея" value={`${data.telemetry.battery}%`} accent="amber" />
                  <MetricCard title="GPS" value={`${data.telemetry.lat.toFixed(4)}, ${data.telemetry.lng.toFixed(4)}`} />
                  <MetricCard title="Сигнал" value={`${data.telemetry.signal}%`} accent="cyan" />
                  <MetricCard title="Курс" value={`${data.telemetry.heading}°`} />
                </div>
              </div>
              <div className="glass-panel rounded-[2rem] p-5">
                <p className="mb-4 text-xs uppercase tracking-[0.3em] text-green-300">Аналитика полёта</p>
                <ResponsiveContainer width="100%" height="86%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="speed" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/><stop offset="95%" stopColor="#22c55e" stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                    <XAxis dataKey="heading" hide />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ background: '#050505', border: '1px solid rgba(34,197,94,0.35)', borderRadius: 16 }} />
                    <Area type="monotone" dataKey="speed" stroke="#22c55e" fillOpacity={1} fill="url(#speed)" />
                    <Area type="monotone" dataKey="altitude" stroke="#06b6d4" fill="transparent" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>

        <AIModule detections={data.detections} />
      </div>
    </main>
  );
}
