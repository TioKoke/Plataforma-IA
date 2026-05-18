// ─── Widget Component Types ──────────────────────────────────────────────────

export type WidgetType =
  | 'comparison'
  | 'checklist'
  | 'ranking'
  | 'swot'
  | 'risk_matrix';

// ─── Comparison ──────────────────────────────────────────────────────────────

export interface ComparisonOption {
  title: string;
  description?: string;
  icon?: string;
  color?: string;
  features: { label: string; value: string | boolean }[];
  badge?: string;
}

// ─── Checklist ───────────────────────────────────────────────────────────────

export interface ChecklistItem {
  label: string;
  checked: boolean;
  description?: string;
  priority?: 'high' | 'medium' | 'low';
}

// ─── Ranking ─────────────────────────────────────────────────────────────────

export interface RankingItem {
  label: string;
  value: number;
  unit?: string;
  icon?: string;
  color?: string;
  change?: number;
}

// ─── SWOT ────────────────────────────────────────────────────────────────────

export interface SwotData {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

// ─── Risk Matrix ─────────────────────────────────────────────────────────────

export interface RiskItem {
  label: string;
  likelihood: 1 | 2 | 3 | 4 | 5;
  impact: 1 | 2 | 3 | 4 | 5;
  description?: string;
  color?: string;
}

// ─── Unified Spec ────────────────────────────────────────────────────────────

export interface WidgetSpec {
  id: string;
  type: WidgetType;
  title: string;
  description?: string;

  // Type-specific data (only one populated based on type)
  options?: ComparisonOption[];
  items?: ChecklistItem[] | RankingItem[];
  swot?: SwotData;
  risks?: RiskItem[];
}
