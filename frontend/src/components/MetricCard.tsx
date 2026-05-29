type MetricCardProps = {
  title: string;
  value: string;
  accent?: 'green' | 'cyan' | 'amber';
};

export function MetricCard({ title, value, accent = 'green' }: MetricCardProps) {
  const color = accent === 'cyan' ? 'text-cyan-300' : accent === 'amber' ? 'text-amber-300' : 'text-green-300';
  return (
    <div className="glass-panel rounded-2xl p-4">
      <p className="text-xs uppercase tracking-[0.28em] text-slate-400">{title}</p>
      <p className={`mt-2 text-2xl font-black ${color}`}>{value}</p>
    </div>
  );
}
