import { motion } from 'framer-motion';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { resolveIcon } from '../kpi/KPIIconResolver';
import type { RankingItem } from './types';

// Oro / plata / bronce para top 3; el resto en gris-oscuro Plataforma IA.
const MEDAL_COLORS = ['#F4AA00', '#94A3B8', '#B45309'] as const;

export function RankingWidget({ items }: { items: RankingItem[] }) {
  const maxValue = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="space-y-1.5 p-1">
      {items.map((item, idx) => {
        const Icon = item.icon ? resolveIcon(item.icon) : null;
        const barPct = (item.value / maxValue) * 100;
        const isTop3 = idx < 3;
        const accent = item.color ?? '#0098AA';

        return (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05, duration: 0.3 }}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-slate-50 transition-colors"
          >
            {/* Position medal */}
            <div className="flex-shrink-0 w-9 flex items-center justify-center">
              {isTop3 ? (
                <span
                  className="flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-bold ring-2 ring-white shadow-sm"
                  style={{ backgroundColor: MEDAL_COLORS[idx] }}
                >
                  {idx + 1}
                </span>
              ) : (
                <span className="text-sm font-bold text-slate-400 tabular-nums">
                  {idx + 1}
                </span>
              )}
            </div>

            {/* Icon (optional) */}
            {Icon && (
              <div
                className="flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0"
                style={{ backgroundColor: accent + '1a' }}
              >
                <Icon size={14} style={{ color: accent }} strokeWidth={2.2} />
              </div>
            )}

            {/* Label + bar */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-slate-700 truncate">
                  {item.label}
                </span>
                <span className="text-sm font-bold text-slate-800 ml-2 whitespace-nowrap tabular-nums">
                  {item.value.toLocaleString('es-CL')}
                  {item.unit ? <span className="text-xs font-medium text-slate-500 ml-1">{item.unit}</span> : null}
                </span>
              </div>

              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: accent }}
                  initial={{ width: 0 }}
                  animate={{ width: `${barPct}%` }}
                  transition={{ delay: idx * 0.05 + 0.1, duration: 0.55, ease: 'easeOut' }}
                />
              </div>
            </div>

            {/* Change indicator */}
            {item.change !== undefined && (
              <div className="flex-shrink-0 flex items-center gap-0.5 min-w-[2.5rem] justify-end">
                {item.change > 0 ? (
                  <>
                    <ArrowUp size={13} className="text-emerald-600" strokeWidth={2.5} />
                    <span className="text-xs font-semibold text-emerald-600 tabular-nums">
                      {Math.abs(item.change)}
                    </span>
                  </>
                ) : item.change < 0 ? (
                  <>
                    <ArrowDown size={13} className="text-red-600" strokeWidth={2.5} />
                    <span className="text-xs font-semibold text-red-600 tabular-nums">
                      {Math.abs(item.change)}
                    </span>
                  </>
                ) : (
                  <>
                    <Minus size={13} className="text-slate-400" strokeWidth={2.5} />
                    <span className="text-xs font-medium text-slate-400">0</span>
                  </>
                )}
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
