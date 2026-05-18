// ─── KPI Card Types ──────────────────────────────────────────────────────────

export interface KPITrend {
  direction: 'up' | 'down' | 'flat';
  value: string;
  label?: string;
}

export interface KPIComparison {
  value: string | number;
  label: string;
}

export interface KPITarget {
  value: number;
  label: string;
}

export type KPIFormat = 'number' | 'currency' | 'percentage' | 'compact';

export interface KPICardSpec {
  id: string;
  label: string;
  value: string | number;
  format?: KPIFormat;
  unit?: string;
  icon?: string;
  color?: string;
  trend?: KPITrend;
  comparison?: KPIComparison;
  sparkline?: number[];
  target?: KPITarget;
}

export interface StandaloneKPISpec {
  id: string;
  title: string;
  description?: string;
  columns?: number;
  cards: KPICardSpec[];
}
