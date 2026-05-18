import { motion } from 'framer-motion';
import { Shield, AlertTriangle, TrendingUp, Flame } from 'lucide-react';
import type { SwotData } from './types';

interface Quadrant {
  key: keyof SwotData;
  title: string;
  subtitle: string;
  icon: typeof Shield;
  accent: string;        // Plataforma IA token color
  softBg: string;        // tint para fondo del cuadrante
  iconBg: string;        // tint para fondo del ícono
}

const QUADRANTS: Quadrant[] = [
  {
    key: 'strengths',
    title: 'Fortalezas',
    subtitle: 'Internas · positivas',
    icon: Shield,
    accent: '#106470',
    softBg: '#ecfdf5',
    iconBg: 'rgba(16, 100, 112, 0.12)',
  },
  {
    key: 'weaknesses',
    title: 'Debilidades',
    subtitle: 'Internas · negativas',
    icon: AlertTriangle,
    accent: '#C13832',
    softBg: '#fef2f2',
    iconBg: 'rgba(193, 56, 50, 0.12)',
  },
  {
    key: 'opportunities',
    title: 'Oportunidades',
    subtitle: 'Externas · positivas',
    icon: TrendingUp,
    accent: '#0072B1',
    softBg: '#eff6ff',
    iconBg: 'rgba(0, 114, 177, 0.12)',
  },
  {
    key: 'threats',
    title: 'Amenazas',
    subtitle: 'Externas · negativas',
    icon: Flame,
    accent: '#E55302',
    softBg: '#fff7ed',
    iconBg: 'rgba(229, 83, 2, 0.12)',
  },
];

export function SwotWidget({ swot }: { swot: SwotData }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-1">
      {QUADRANTS.map((q, idx) => {
        const Icon = q.icon;
        const items = swot[q.key];

        return (
          <motion.div
            key={q.key}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.08, duration: 0.35, ease: 'easeOut' }}
            className="rounded-xl border shadow-sm overflow-hidden flex flex-col"
            style={{
              backgroundColor: q.softBg,
              borderColor: q.accent + '33',
              borderLeftWidth: 4,
              borderLeftColor: q.accent,
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 pt-3 pb-2">
              <div
                className="flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0"
                style={{ backgroundColor: q.iconBg }}
              >
                <Icon size={18} style={{ color: q.accent }} strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold leading-tight" style={{ color: q.accent }}>
                  {q.title}
                </h4>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mt-0.5 font-medium">
                  {q.subtitle}
                </p>
              </div>
              <span
                className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: q.accent, color: '#fff' }}
              >
                {items.length}
              </span>
            </div>

            {/* Items */}
            <ul className="px-4 pb-3 pt-1 space-y-1.5 flex-1">
              {items.length === 0 ? (
                <li className="text-xs text-slate-400 italic">Sin elementos</li>
              ) : (
                items.map((text, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12.5px] leading-relaxed">
                    <span
                      className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: q.accent }}
                    />
                    <span className="text-slate-700">{text}</span>
                  </li>
                ))
              )}
            </ul>
          </motion.div>
        );
      })}
    </div>
  );
}
