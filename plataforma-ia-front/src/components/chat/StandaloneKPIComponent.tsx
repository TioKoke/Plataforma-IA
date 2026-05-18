import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { StandaloneKPISpec, KPICardSpec } from './kpi/types';
import { resolveIcon } from './kpi/KPIIconResolver';
import { KPISparkline } from './kpi/KPISparkline';
import { KPIProgressBar } from './kpi/KPIProgressBar';
import CountUp from '../reactbits/CountUp';

// ─── Color mapping ───────────────────────────────────────────────────────────

const BRAND_COLOR_MAP: Record<string, string> = {
  naranja: '#E55302',
  amarillo: '#F4AA00',
  turquesa: '#0098AA',
  rojo: '#C13832',
  'rojo-oscuro': '#7A2531',
  'gris-oscuro': '#36424A',
  beige: '#C4C1A0',
  'verde-oscuro': '#106470',
  azul: '#0072B1',
};

function resolveColor(color?: string): string {
  if (!color) return '#0072B1';
  return BRAND_COLOR_MAP[color] ?? (color.startsWith('#') ? color : '#0072B1');
}

/** Lighten a hex color toward white (0 = original, 1 = white). */
function lighten(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lr = Math.round(r + (255 - r) * amount);
  const lg = Math.round(g + (255 - g) * amount);
  const lb = Math.round(b + (255 - b) * amount);
  return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`;
}

// ─── Value formatting ────────────────────────────────────────────────────────

function formatValue(value: string | number, format?: KPICardSpec['format']): string {
  if (typeof value === 'string') return value;
  switch (format) {
    case 'currency':
      return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
    case 'percentage':
      return `${(value * 100).toFixed(1)}%`;
    case 'compact': {
      if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
      if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
      return value.toLocaleString('es-CL');
    }
    default:
      return value.toLocaleString('es-CL');
  }
}

// ─── Animation variants ──────────────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

// ─── Single KPI Card ─────────────────────────────────────────────────────────

function KPICardItem({ card }: { card: KPICardSpec }) {
  const color = resolveColor(card.color);
  const Icon = resolveIcon(card.icon);

  const TrendIcon = card.trend?.direction === 'up'
    ? TrendingUp
    : card.trend?.direction === 'down'
      ? TrendingDown
      : Minus;

  const trendColor = card.trend?.direction === 'up'
    ? 'text-emerald-600'
    : card.trend?.direction === 'down'
      ? 'text-red-500'
      : 'text-slate-400';

  const isNumeric = typeof card.value === 'number';
  const gradientFrom = lighten(color, 0.94);
  const gradientTo = '#ffffff';

  return (
    <motion.div
      variants={cardVariants}
      className="relative overflow-hidden rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow duration-200 group"
      style={{ background: `linear-gradient(135deg, ${gradientFrom} 0%, ${gradientTo} 100%)` }}
    >
      {/* Accent bar */}
      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-xl" style={{ backgroundColor: color }} />

      <div className="px-4 pt-4 pb-3">
        {/* Header: icon + label */}
        <div className="flex items-center gap-2 mb-2">
          <div
            className="flex items-center justify-center w-8 h-8 rounded-lg"
            style={{ backgroundColor: lighten(color, 0.85) }}
          >
            <Icon size={16} style={{ color }} />
          </div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide leading-tight flex-1 min-w-0 truncate">
            {card.label}
          </p>
        </div>

        {/* Value + sparkline row */}
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              {isNumeric ? (
                <span className="text-2xl font-bold text-slate-800 leading-none">
                  <CountUp to={card.value as number} separator="." className="text-2xl font-bold text-slate-800" />
                </span>
              ) : (
                <span className="text-2xl font-bold text-slate-800 leading-none">{card.value}</span>
              )}
              {card.unit && (
                <span className="text-xs font-medium text-slate-400">{card.unit}</span>
              )}
            </div>
          </div>

          {card.sparkline && card.sparkline.length >= 2 && (
            <KPISparkline data={card.sparkline} color={color} />
          )}
        </div>

        {/* Trend */}
        {card.trend && (
          <div className={`flex items-center gap-1 mt-2 ${trendColor}`}>
            <TrendIcon size={13} />
            <span className="text-xs font-semibold">{card.trend.value}</span>
            {card.trend.label && (
              <span className="text-[10px] text-slate-400 ml-0.5">{card.trend.label}</span>
            )}
          </div>
        )}

        {/* Comparison */}
        {card.comparison && (
          <p className="text-[10px] text-slate-400 mt-1">
            vs {card.comparison.label}: <span className="font-medium text-slate-500">{formatValue(card.comparison.value, card.format)}</span>
          </p>
        )}

        {/* Progress bar */}
        {card.target && typeof card.value === 'number' && (
          <KPIProgressBar
            value={card.value}
            target={card.target.value}
            label={card.target.label}
            color={color}
          />
        )}
      </div>
    </motion.div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

function StandaloneKPIComponent({ spec }: { spec: StandaloneKPISpec }) {
  const cols = spec.columns ?? 3;

  const gridClass = useMemo(() => {
    switch (cols) {
      case 1: return 'grid-cols-1';
      case 2: return 'grid-cols-1 sm:grid-cols-2';
      case 3: return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
      case 4: return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';
      default: return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
    }
  }, [cols]);

  return (
    <div className="my-4 max-w-full">
      {/* Header */}
      {(spec.title || spec.description) && (
        <div className="mb-3">
          {spec.title && (
            <h3 className="text-base font-bold text-slate-800">{spec.title}</h3>
          )}
          {spec.description && (
            <p className="text-xs text-slate-500 mt-0.5">{spec.description}</p>
          )}
        </div>
      )}

      {/* Cards grid */}
      <motion.div
        className={`grid ${gridClass} gap-3`}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {spec.cards.map((card) => (
          <KPICardItem key={card.id} card={card} />
        ))}
      </motion.div>
    </div>
  );
}

// ─── Block wrapper (matches ChartBlock / DashboardBlock pattern) ─────────────

interface StandaloneKPIBlockProps {
  spec: StandaloneKPISpec;
  onInteract?: (message: string) => void;
}

export function StandaloneKPIBlock({ spec, onInteract: _onInteract }: StandaloneKPIBlockProps) {
  return <StandaloneKPIComponent spec={spec} />;
}
