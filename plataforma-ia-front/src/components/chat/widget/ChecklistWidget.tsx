import { motion } from 'framer-motion';
import { CheckCircle2, Circle } from 'lucide-react';
import type { ChecklistItem } from './types';

const PRIORITY_META: Record<string, { color: string; label: string }> = {
  high: { color: '#C13832', label: 'Alta' },
  medium: { color: '#F4AA00', label: 'Media' },
  low: { color: '#106470', label: 'Baja' },
};

export function ChecklistWidget({ items }: { items: ChecklistItem[] }) {
  const completed = items.filter((i) => i.checked).length;
  const total = items.length;
  const pct = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Progress header */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
              Progreso
            </span>
            <span className="text-xs font-semibold text-slate-700">
              {completed}/{total}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: pct === 100 ? '#106470' : '#0072B1' }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>
        <span className="text-base font-bold text-slate-700 tabular-nums">
          {Math.round(pct)}%
        </span>
      </div>

      <ul className="divide-y divide-slate-100">
        {items.map((item, i) => {
          const priority = item.priority ? PRIORITY_META[item.priority] : null;
          return (
            <motion.li
              key={i}
              className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50/60 transition-colors"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04, duration: 0.25 }}
            >
              <div className="mt-0.5 shrink-0">
                {item.checked ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" strokeWidth={2.2} />
                ) : (
                  <Circle className="w-5 h-5 text-slate-300" strokeWidth={2} />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <span
                  className={`text-sm leading-snug ${
                    item.checked ? 'line-through text-slate-400' : 'text-slate-800'
                  }`}
                >
                  {item.label}
                </span>
                {item.description && (
                  <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{item.description}</p>
                )}
              </div>

              {priority && (
                <span
                  className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: priority.color + '1a',
                    color: priority.color,
                  }}
                  title={`Prioridad: ${priority.label}`}
                >
                  {priority.label}
                </span>
              )}
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
