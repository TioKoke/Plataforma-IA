import type { DashboardSpec, PanelSpec, DashboardFilterSpec, KPISpec, TableColumnSpec } from './types';
import type { YKeySpec } from '../ChartComponent';

const BRAND_COLORS = ['#0072B1', '#F4A261', '#00B4D8', '#2EC4B6', '#E76F51', '#A8DADC', '#264653', '#E9C46A'];
const VALID_PANEL_TYPES = new Set(['bar', 'line', 'pie', 'area', 'donut', 'stacked_area', 'stacked_bar', 'waterfall', 'kpi', 'table']);

function normalizeYKeys(raw: unknown, xKey: string, data: Record<string, unknown>[]): YKeySpec[] {
  const yKeys: YKeySpec[] = [];

  if (Array.isArray(raw) && raw.length > 0) {
    for (let i = 0; i < raw.length; i++) {
      const yk = raw[i];
      if (typeof yk === 'string') {
        yKeys.push({ key: yk, label: yk, color: BRAND_COLORS[i % BRAND_COLORS.length] });
      } else if (yk && typeof yk === 'object') {
        const o = yk as Record<string, unknown>;
        yKeys.push({
          key: String(o.key ?? ''),
          label: String(o.label ?? o.key ?? ''),
          color: (typeof o.color === 'string' && o.color) ? o.color : BRAND_COLORS[i % BRAND_COLORS.length],
        });
      }
    }
  }

  // Auto-detect numeric columns if empty
  if (yKeys.length === 0 && data.length > 0) {
    const firstRow = data[0];
    let ci = 0;
    for (const [col, val] of Object.entries(firstRow)) {
      if (col === xKey) continue;
      if (typeof val === 'number') {
        yKeys.push({ key: col, label: col, color: BRAND_COLORS[ci % BRAND_COLORS.length] });
        ci++;
        if (ci >= 4) break;
      }
    }
  }

  return yKeys;
}

function normalizePanel(raw: Record<string, unknown>, index: number): PanelSpec | null {
  const panelType = String(raw.type ?? raw.chart_type ?? 'bar');
  if (!VALID_PANEL_TYPES.has(panelType)) return null;

  const id = (typeof raw.id === 'string' && raw.id) ? raw.id : `panel_${index}`;
  const title = typeof raw.title === 'string' ? raw.title : '';
  const description = typeof raw.description === 'string' ? raw.description : undefined;
  const span = typeof raw.span === 'number' ? raw.span : 1;

  const result: PanelSpec = { id, type: panelType as PanelSpec['type'], title, description, span };

  // KPI panel
  if (panelType === 'kpi') {
    if (raw.kpi && typeof raw.kpi === 'object') {
      const k = raw.kpi as Record<string, unknown>;
      result.kpi = {
        value: (typeof k.value === 'number' || typeof k.value === 'string') ? k.value : 0,
        label: typeof k.label === 'string' ? k.label : title,
        trend: k.trend && typeof k.trend === 'object' ? k.trend as KPISpec['trend'] : undefined,
        format: (['number', 'currency', 'percentage'].includes(k.format as string) ? k.format : 'number') as KPISpec['format'],
      };
    } else {
      // Try to build KPI from top-level fields
      result.kpi = {
        value: (raw.kpi_value as string | number) ?? 0,
        label: (raw.kpi_label as string) ?? title,
        format: 'number',
      };
    }
    return result;
  }

  // Table panel
  if (panelType === 'table') {
    result.data = Array.isArray(raw.data) ? raw.data as Record<string, unknown>[] : [];
    if (Array.isArray(raw.table_columns)) {
      result.table_columns = (raw.table_columns as Record<string, unknown>[]).map((tc) => ({
        key: String(tc.key ?? ''),
        label: String(tc.label ?? tc.key ?? ''),
      })) as TableColumnSpec[];
    } else if (result.data.length > 0) {
      // Auto-detect columns from first row
      result.table_columns = Object.keys(result.data[0]).map(k => ({ key: k, label: k }));
    }
    return result;
  }

  // Chart panels (bar, line, pie, area)
  result.data = Array.isArray(raw.data) ? raw.data as Record<string, unknown>[] : [];
  if (result.data.length === 0) return null;

  result.x_key = typeof raw.x_key === 'string' ? raw.x_key : undefined;
  if (!result.x_key && result.data.length > 0) {
    // Use first non-numeric column as x_key
    for (const [col, val] of Object.entries(result.data[0])) {
      if (typeof val !== 'number') { result.x_key = col; break; }
    }
  }
  if (!result.x_key) return null;

  result.y_keys = normalizeYKeys(raw.y_keys, result.x_key, result.data);
  if (result.y_keys.length === 0) return null;

  result.selectable = typeof raw.selectable === 'boolean' ? raw.selectable : true;
  result.on_click_message = typeof raw.on_click_message === 'string' ? raw.on_click_message : undefined;

  if (raw.on_click_filter && typeof raw.on_click_filter === 'object') {
    const ocf = raw.on_click_filter as Record<string, unknown>;
    if (Array.isArray(ocf.target_panels) && typeof ocf.filter_key === 'string') {
      result.on_click_filter = {
        target_panels: ocf.target_panels as string[],
        filter_key: ocf.filter_key,
      };
    }
  }

  if (Array.isArray(raw.exclude_filters)) {
    result.exclude_filters = raw.exclude_filters as string[];
  }

  return result;
}

function normalizeFilter(raw: Record<string, unknown>): DashboardFilterSpec | null {
  if (typeof raw.id !== 'string' || !raw.id) return null;
  if (typeof raw.key_to_filter !== 'string' || !raw.key_to_filter) return null;
  if (!Array.isArray(raw.options) || raw.options.length === 0) return null;

  return {
    id: raw.id,
    label: typeof raw.label === 'string' ? raw.label : raw.id,
    type: (['radio', 'dropdown', 'multi_select'].includes(raw.type as string) ? raw.type : 'dropdown') as DashboardFilterSpec['type'],
    key_to_filter: raw.key_to_filter,
    options: (raw.options as Record<string, unknown>[]).map(o => ({
      id: String(o.id ?? o.value ?? ''),
      label: String(o.label ?? o.id ?? o.value ?? ''),
    })),
    default: (raw.default as string | string[]) ?? 'all',
    applies_to: Array.isArray(raw.applies_to) ? raw.applies_to as string[] : undefined,
  };
}

export function validateDashboardSpec(raw: unknown): DashboardSpec | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  // Panels are required
  if (!Array.isArray(obj.panels) || obj.panels.length === 0) return null;

  const id = (typeof obj.id === 'string' && obj.id) ? obj.id : `dash_${Date.now()}`;
  const title = typeof obj.title === 'string' ? obj.title : '';
  const description = typeof obj.description === 'string' ? obj.description : undefined;

  // Layout
  let columns = 2;
  if (obj.layout && typeof obj.layout === 'object') {
    const layout = obj.layout as Record<string, unknown>;
    if (typeof layout.columns === 'number' && layout.columns >= 1 && layout.columns <= 4) {
      columns = layout.columns;
    }
  } else if (typeof obj.layout_columns === 'number') {
    columns = Math.min(4, Math.max(1, obj.layout_columns as number));
  }

  // Normalize panels
  const panels: PanelSpec[] = [];
  for (let i = 0; i < (obj.panels as unknown[]).length; i++) {
    const rawPanel = (obj.panels as unknown[])[i];
    if (rawPanel && typeof rawPanel === 'object') {
      const panel = normalizePanel(rawPanel as Record<string, unknown>, i);
      if (panel) panels.push(panel);
    }
  }
  if (panels.length === 0) return null;

  // Normalize filters
  const filters: DashboardFilterSpec[] = [];
  if (Array.isArray(obj.filters)) {
    for (const rawFilter of obj.filters as unknown[]) {
      if (rawFilter && typeof rawFilter === 'object') {
        const filter = normalizeFilter(rawFilter as Record<string, unknown>);
        if (filter) filters.push(filter);
      }
    }
  }

  return {
    id,
    title,
    description,
    layout: { columns },
    filters: filters.length > 0 ? filters : undefined,
    panels,
    auto_refresh: typeof obj.auto_refresh === 'boolean' ? obj.auto_refresh : false,
  };
}
