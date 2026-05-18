import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { KPISpec } from './dashboard/types';

interface KPICardProps {
  kpi: KPISpec;
  title: string;
}

function formatValue(value: string | number, format?: KPISpec['format']): string {
  if (typeof value === 'string') return value;
  switch (format) {
    case 'currency':
      return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
    case 'percentage':
      return `${(value * 100).toFixed(1)}%`;
    default:
      return value.toLocaleString('es-CL');
  }
}

export function KPICard({ kpi, title }: KPICardProps) {
  const trendColor = kpi.trend?.direction === 'up'
    ? 'text-emerald-600'
    : kpi.trend?.direction === 'down'
      ? 'text-red-500'
      : 'text-slate-400';

  const TrendIcon = kpi.trend?.direction === 'up'
    ? TrendingUp
    : kpi.trend?.direction === 'down'
      ? TrendingDown
      : Minus;

  return (
    <div className="flex flex-col justify-center h-full px-4 py-3">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{title}</p>
      <p className="text-2xl font-bold text-slate-800 leading-tight">
        {formatValue(kpi.value, kpi.format)}
      </p>
      {kpi.trend && (
        <div className={`flex items-center gap-1 mt-1.5 ${trendColor}`}>
          <TrendIcon size={14} />
          <span className="text-xs font-medium">{kpi.trend.value}</span>
        </div>
      )}
      {kpi.label && kpi.label !== title && (
        <p className="text-xs text-slate-400 mt-1">{kpi.label}</p>
      )}
    </div>
  );
}
