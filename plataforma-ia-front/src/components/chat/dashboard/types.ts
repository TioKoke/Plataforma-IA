import type { YKeySpec } from '../ChartComponent';

// ─── Filter Types ────────────────────────────────────────────────────────────

export interface FilterOption {
  id: string;
  label: string;
}

export interface DashboardFilterSpec {
  id: string;
  label: string;
  type: 'radio' | 'dropdown' | 'multi_select';
  key_to_filter: string;
  options: FilterOption[];
  default: string | string[];
  /** Panel IDs this filter applies to. undefined = all panels */
  applies_to?: string[];
}

// ─── KPI Types ───────────────────────────────────────────────────────────────

export interface KPISpec {
  value: string | number;
  label: string;
  trend?: { direction: 'up' | 'down' | 'flat'; value: string };
  format?: 'number' | 'currency' | 'percentage';
}

// ─── Table Types ─────────────────────────────────────────────────────────────

export interface TableColumnSpec {
  key: string;
  label: string;
}

// ─── Panel Types ─────────────────────────────────────────────────────────────

export type PanelType = 'bar' | 'line' | 'pie' | 'area' | 'donut' | 'stacked_area' | 'stacked_bar' | 'waterfall' | 'kpi' | 'table';

export interface PanelSpec {
  id: string;
  type: PanelType;
  title: string;
  description?: string;
  /** Grid columns this panel spans (default 1) */
  span?: number;
  /** Data rows (for chart and table panels) */
  data?: Record<string, unknown>[];
  // Chart-specific
  x_key?: string;
  y_keys?: YKeySpec[];
  // KPI-specific
  kpi?: KPISpec;
  // Table-specific
  table_columns?: TableColumnSpec[];
  // Interaction
  on_click_filter?: { target_panels: string[]; filter_key: string };
  exclude_filters?: string[];
  selectable?: boolean;
  on_click_message?: string;
}

// ─── Dashboard Types ─────────────────────────────────────────────────────────

export interface DashboardSpec {
  id: string;
  title: string;
  description?: string;
  layout: { columns: number };
  filters?: DashboardFilterSpec[];
  panels: PanelSpec[];
  auto_refresh?: boolean;
}

// ─── State Types ─────────────────────────────────────────────────────────────

export interface CrossFilterState {
  sourcePanelId: string;
  filterKey: string;
  filterValue: unknown;
}

export interface DashboardState {
  filterValues: Record<string, string | string[]>;
  crossFilter: CrossFilterState | null;
}
