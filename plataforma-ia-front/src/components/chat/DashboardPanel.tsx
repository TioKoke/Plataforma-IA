import { useCallback, useMemo } from 'react';
import { AlertCircle } from 'lucide-react';
import type { PanelSpec } from './dashboard/types';
import type { ChartSpec } from './ChartComponent';
import { KPICard } from './KPICard';
import { DataTable } from './DataTable';
import { ExpandableChartWrapper } from './ChartActions';

interface DashboardPanelProps {
  panel: PanelSpec;
  isHighlighted: boolean;
  onInteract: (message: string) => void;
  onCrossFilter?: (panelId: string, filterKey: string, filterValue: unknown) => void;
}

export function DashboardPanel({ panel, isHighlighted, onInteract, onCrossFilter }: DashboardPanelProps) {
  const handleChartInteract = useCallback((message: string) => {
    // If panel has cross-filter config, trigger it
    if (panel.on_click_filter) {
      // Extract value from the click message (parse x_value)
      const match = message.match(/=([^,}]+)/);
      if (match) {
        onCrossFilter?.(panel.id, panel.on_click_filter.filter_key, match[1].trim());
      }
    }
    onInteract(message);
  }, [panel, onInteract, onCrossFilter]);

  const chartTypes = ['bar', 'line', 'pie', 'area', 'donut', 'stacked_area', 'stacked_bar', 'waterfall'];

  const renderContent = () => {
    if (panel.type === 'kpi' && panel.kpi) {
      return <KPICard kpi={panel.kpi} title={panel.title} />;
    }

    if (panel.type === 'table') {
      if (!panel.table_columns || panel.table_columns.length === 0) {
        return <EmptyPanelState reason="Tabla sin columnas definidas." />;
      }
      if (!panel.data || panel.data.length === 0) {
        return <EmptyPanelState reason="Tabla sin filas — el modelo no trajo datos para este panel." />;
      }
      return (
        <ExpandableChartWrapper
          title={panel.title}
          description={panel.description}
          filename={`panel_${panel.id}`}
          expandedContent={
            <div className="h-full overflow-auto">
              <DataTable data={panel.data} columns={panel.table_columns} />
            </div>
          }
        >
          <DataTable data={panel.data} columns={panel.table_columns} />
        </ExpandableChartWrapper>
      );
    }

    if (chartTypes.includes(panel.type)) {
      if (!panel.data || panel.data.length === 0) {
        return <EmptyPanelState reason="Gráfico sin datos — el modelo no trajo filas para este panel." />;
      }
      if (!panel.x_key || !panel.y_keys || panel.y_keys.length === 0) {
        return <EmptyPanelState reason="Gráfico sin eje definido (x_key o y_keys ausente)." />;
      }
      const chartSpec: ChartSpec = {
        type: panel.type as ChartSpec['type'],
        id: panel.id,
        title: '',  // Title rendered by panel wrapper
        x_key: panel.x_key,
        y_keys: panel.y_keys,
        data: panel.data,
        selectable: panel.selectable,
        on_click_message: panel.on_click_message,
      };

      return (
        <ExpandableChartWrapper
          title={panel.title}
          description={panel.description}
          filename={`panel_${panel.id}`}
          expandedContent={
            <div className="h-full">
              <InlineChart spec={chartSpec} onInteract={handleChartInteract} />
            </div>
          }
        >
          <div className="h-[250px]">
            <InlineChart spec={chartSpec} onInteract={handleChartInteract} />
          </div>
        </ExpandableChartWrapper>
      );
    }

    return <EmptyPanelState reason="Panel sin datos" />;
  };

  return (
    <div
      className={[
        'bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col transition-all duration-200',
        isHighlighted ? 'border-plataforma-azul ring-2 ring-plataforma-azul/20' : 'border-slate-200',
      ].join(' ')}
      style={{ gridColumn: panel.span && panel.span > 1 ? `span ${panel.span}` : undefined }}
    >
      {/* Panel header (skip for KPI since it has its own label) */}
      {panel.type !== 'kpi' && (
        <div className="px-4 pt-3 pb-1">
          <h4 className="text-sm font-semibold text-slate-800">{panel.title}</h4>
          {panel.description && (
            <p className="text-xs text-slate-500 mt-0.5">{panel.description}</p>
          )}
        </div>
      )}
      <div className="flex-1 min-h-0">
        {renderContent()}
      </div>
    </div>
  );
}

// ─── Empty Panel State ───────────────────────────────────────────────────────

function EmptyPanelState({ reason }: { reason: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-6 text-center bg-slate-50 border border-dashed border-slate-200 rounded-md m-3 min-h-[140px]">
      <AlertCircle size={18} className="text-slate-400" />
      <p className="text-xs text-slate-500 max-w-[280px] leading-relaxed">{reason}</p>
    </div>
  );
}

// ─── Inline Chart (uses Recharts directly, no ChartBlock wrapper) ────────────

import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';

const BRAND_COLORS = ['#0072B1', '#F4A261', '#00B4D8', '#2EC4B2', '#E76F51', '#A8DADC', '#264653', '#E9C46A'];
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T|\s|$)/;

function isISODate(v: unknown): boolean { return typeof v === 'string' && ISO_DATE_RE.test(v); }

function fmtDate(v: unknown): string {
  if (!isISODate(v)) return String(v);
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('es-CL', { month: 'short', year: '2-digit' });
}

function InlineCustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: unknown; color: string; payload?: Record<string, unknown> }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const isPie = label == null;
  const displayLabel = isPie
    ? (payload[0]?.payload?.name ?? payload[0]?.name ?? '')
    : (isISODate(label) ? fmtDate(label) : String(label ?? ''));
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-2 text-xs" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {displayLabel && displayLabel !== 'undefined' && <p className="font-medium text-slate-700 mb-0.5">{String(displayLabel)}</p>}
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }}>
          {!isPie && <>{entry.name}: </>}
          <span className="font-semibold">{typeof entry.value === 'number' ? entry.value.toLocaleString('es-CL') : String(entry.value)}</span>
        </p>
      ))}
    </div>
  );
}

function InlineChart({ spec, onInteract }: { spec: ChartSpec; onInteract: (msg: string) => void }) {
  // Coerce y_key values to numbers for stacking and comparisons
  const numericData = useMemo(() => {
    const yKeyNames = new Set(spec.y_keys.map(yk => yk.key));
    return spec.data.map(row => {
      const newRow = { ...row };
      for (const key of yKeyNames) {
        const val = newRow[key];
        if (val != null && typeof val !== 'number') {
          const parsed = Number(val);
          if (!isNaN(parsed)) newRow[key] = parsed;
        }
      }
      return newRow;
    });
  }, [spec.data, spec.y_keys]);

  const xIsDate = numericData.length > 0 && isISODate(numericData[0][spec.x_key]);
  const many = numericData.length > 6;
  const margin = { top: 5, right: 15, left: 5, bottom: many ? 50 : 5 };

  const handleClick = (xVal: unknown, _yKey: string, yVal: unknown) => {
    if (!spec.selectable) return;
    const tmpl = spec.on_click_message || `Analiza: ${spec.x_key}={x_value}, valor={y_value}`;
    onInteract(tmpl.replace('{x_value}', String(xVal)).replace('{y_value}', String(yVal)));
  };

  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
      <XAxis
        dataKey={spec.x_key}
        tick={{ fontSize: 10, fill: '#64748b' }}
        tickLine={false}
        tickMargin={8}
        tickFormatter={xIsDate ? fmtDate : undefined}
        angle={many ? -45 : 0}
        textAnchor={many ? 'end' : 'middle'}
        height={many ? 80 : undefined}
        minTickGap={many ? 14 : 6}
      />
      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false}
        tickFormatter={(v: number) => v.toLocaleString('es-CL')} />
      <Tooltip content={<InlineCustomTooltip />} />
      <Legend wrapperStyle={{ fontSize: 11, lineHeight: '18px', display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }} />
    </>
  );

  if (spec.type === 'pie' || spec.type === 'donut') {
    const pieData = numericData.map(r => ({ name: String(r[spec.x_key]), value: Number(r[spec.y_keys[0]?.key] ?? 0) }));
    const isDonut = spec.type === 'donut';
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
            innerRadius={isDonut ? 40 : 0}
            onClick={(e: { name: string; value: number }) => handleClick(e.name, spec.y_keys[0]?.key ?? '', e.value)}>
            {pieData.map((_, i) => <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />)}
          </Pie>
          <Tooltip content={<InlineCustomTooltip />} />
          <Legend layout="vertical" align="right" verticalAlign="middle"
            wrapperStyle={{ fontSize: 10, lineHeight: '16px', paddingLeft: 8, maxWidth: '40%' }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (spec.type === 'line') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={numericData} margin={margin}>
          {axes}
          {spec.y_keys.map(yk => (
            <Line key={yk.key} type="monotone" dataKey={yk.key} name={yk.label}
              stroke={yk.color} strokeWidth={2} dot={{ r: 3 }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              activeDot={{ r: 5, cursor: 'pointer', onClick: (_: unknown, p: any) => handleClick(p?.payload?.[spec.x_key], yk.key, p?.payload?.[yk.key]) }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (spec.type === 'area' || spec.type === 'stacked_area') {
    const isStacked = spec.type === 'stacked_area';
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={numericData} margin={margin}>
          {axes}
          {spec.y_keys.map(yk => (
            <Area key={yk.key} type="monotone" dataKey={yk.key} name={yk.label}
              stroke={yk.color} fill={yk.color + (isStacked ? '99' : '33')} strokeWidth={2}
              stackId={isStacked ? 'stacked' : undefined} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // Default: bar (including stacked_bar)
  const isStackedBar = spec.type === 'stacked_bar';
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={numericData} margin={margin}>
        {axes}
        {spec.y_keys.map(yk => (
          <Bar key={yk.key} dataKey={yk.key} name={yk.label} fill={yk.color}
            radius={isStackedBar ? undefined : [3, 3, 0, 0]}
            stackId={isStackedBar ? 'stacked' : undefined}
            cursor={spec.selectable ? 'pointer' : 'default'}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onClick={(e: any) => handleClick(e[spec.x_key], yk.key, e[yk.key])} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
