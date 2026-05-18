import { motion } from 'framer-motion';

interface KPIProgressBarProps {
  value: number;
  target: number;
  label: string;
  color: string;
}

export function KPIProgressBar({ value, target, label, color }: KPIProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / target) * 100));

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
        <span>{label}</span>
        <span>{pct.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
