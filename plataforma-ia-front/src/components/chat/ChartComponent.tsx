import { useState, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import { ExpandableChartWrapper } from './ChartActions';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface YKeySpec {
  key: string;
  label: string;
  color: string;
  unit?: string;   // e.g., "%", "USD", "t"
  axis?: 'left' | 'right';  // for dual Y-axis support
}

export interface FilterOption {
  id: string;
  label: string;
}

export interface FilterSpec {
  id: string;
  label: string;
  type: 'radio' | 'dropdown';
  key_to_filter: string;
  options: FilterOption[];
  default: string;
}

export interface ChartSpec {
  type: 'bar' | 'line' | 'pie' | 'area' | 'donut' | 'stacked_area' | 'stacked_bar' | 'waterfall';
  id: string;
  title: string;
  description?: string;
  x_key: string;
  y_keys: YKeySpec[];
  data: Record<string, unknown>[];
  filters?: FilterSpec[];
  on_click_message?: string;
  selectable?: boolean;
}

// ─── Palette ──────────────────────────────────────────────────────────────────

const BRAND_COLORS = ['#0072B1', '#F4A261', '#00B4D8', '#2EC4B6', '#E76F51', '#A8DADC', '#264653', '#E9C46A'];

// ─── Validation & Normalization ──────────────────────────────────────────────

export function validateChartSpec(raw: unknown): ChartSpec | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  // Accept both "type" and "chart_type" (AI sometimes uses the wrong key)
  const VALID_TYPES = new Set(['bar', 'line', 'pie', 'area', 'donut', 'stacked_area', 'stacked_bar', 'waterfall']);
  const TYPE_ALIASES: Record<string, string> = {
    scatter: 'line', bubble: 'line', histogram: 'bar', heatmap: 'bar',
  };
  let chartType = (obj.type ?? obj.chart_type) as string;
  if (!VALID_TYPES.has(chartType)) {
    chartType = TYPE_ALIASES[chartType] ?? chartType;
    if (!VALID_TYPES.has(chartType)) return null;
  }

  // x_key and data are strictly required
  if (typeof obj.x_key !== 'string' || !obj.x_key) return null;
  if (!Array.isArray(obj.data) || obj.data.length === 0) return null;

  // Auto-generate missing id / title
  const id = (typeof obj.id === 'string' && obj.id) ? obj.id : `chart_auto_${Date.now()}`;
  const title = typeof obj.title === 'string' ? obj.title : '';

  // Defensive: if title suggests donut but type is pie, override
  if (chartType === 'pie' && /dona|donut|rosquilla/i.test(title)) {
    chartType = 'donut';
  }

  // Normalize y_keys: accept string[], {key,label,color}[], or auto-detect
  let yKeys: YKeySpec[] = [];
  if (Array.isArray(obj.y_keys) && obj.y_keys.length > 0) {
    yKeys = obj.y_keys.map((yk: unknown, i: number) => {
      if (typeof yk === 'string') {
        return { key: yk, label: yk, color: BRAND_COLORS[i % BRAND_COLORS.length] };
      }
      if (yk && typeof yk === 'object') {
        const o = yk as Record<string, unknown>;
        return {
          key: String(o.key ?? ''),
          label: String(o.label ?? o.key ?? ''),
          color: (typeof o.color === 'string' && o.color) ? o.color : BRAND_COLORS[i % BRAND_COLORS.length],
          unit: typeof o.unit === 'string' ? o.unit : undefined,
          axis: (o.axis === 'left' || o.axis === 'right') ? o.axis : undefined,
        };
      }
      return { key: `col_${i}`, label: `col_${i}`, color: BRAND_COLORS[i % BRAND_COLORS.length] };
    });
  }

  // Auto-detect numeric columns if y_keys is empty or missing
  if (yKeys.length === 0) {
    const firstRow = (obj.data as Record<string, unknown>[])[0];
    if (firstRow) {
      let ci = 0;
      for (const [col, val] of Object.entries(firstRow)) {
        if (col === obj.x_key) continue;
        if (typeof val === 'number') {
          yKeys.push({ key: col, label: col, color: BRAND_COLORS[ci % BRAND_COLORS.length] });
          ci++;
          if (ci >= 4) break;
        }
      }
    }
  }

  if (yKeys.length === 0) return null;

  return {
    type: chartType as ChartSpec['type'],
    id,
    title,
    description: typeof obj.description === 'string' ? obj.description : undefined,
    x_key: obj.x_key as string,
    y_keys: yKeys,
    data: obj.data as Record<string, unknown>[],
    filters: Array.isArray(obj.filters) ? obj.filters as FilterSpec[] : undefined,
    on_click_message: typeof obj.on_click_message === 'string' ? obj.on_click_message : undefined,
    selectable: typeof obj.selectable === 'boolean' ? obj.selectable : true,
  };
}

// ─── Filter Panel ─────────────────────────────────────────────────────────────

interface FilterPanelProps {
  filters: FilterSpec[];
  values: Record<string, string>;
  onChange: (filterId: string, value: string) => void;
  disabled: boolean;
}

function FilterPanel({ filters, values, onChange, disabled }: FilterPanelProps) {
  return (
    <div className="flex flex-wrap gap-4 mb-4">
      {filters.map((filter) => {
        const selected = values[filter.id] ?? filter.default;
        const useDropdown = filter.type === 'dropdown' || filter.options.length > 5;

        return (
          <div key={filter.id} className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              {filter.label}
            </span>
            {useDropdown ? (
              <select
                value={selected}
                onChange={(e) => onChange(filter.id, e.target.value)}
                disabled={disabled}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-plataforma-azul disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {filter.options.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex flex-wrap gap-2">
                {filter.options.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => onChange(filter.id, opt.id)}
                    disabled={disabled}
                    className={[
                      'px-3 py-1 rounded-full text-xs font-medium border transition-all duration-150',
                      selected === opt.id
                        ? 'bg-plataforma-azul text-white border-plataforma-azul'
                        : 'border-slate-300 text-slate-600 hover:border-plataforma-azul hover:text-plataforma-azul',
                      disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                    ].join(' ')}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T|\s|$)/;

function isISODateString(value: unknown): boolean {
  return typeof value === 'string' && ISO_DATE_RE.test(value);
}

/** Compute the span in days between first and last data point to pick granularity */
function computeDateSpanDays(data: Record<string, unknown>[], xKey: string): number {
  if (data.length < 2) return 0;
  const first = data[data.length - 1]?.[xKey];
  const last = data[0]?.[xKey];
  if (!isISODateString(first) || !isISODateString(last)) return 0;
  const d1 = new Date(first as string).getTime();
  const d2 = new Date(last as string).getTime();
  return Math.abs(d2 - d1) / (1000 * 60 * 60 * 24);
}

function formatDateTick(value: unknown, spanDays: number): string {
  if (!isISODateString(value)) return String(value);
  const d = new Date(value as string);
  if (isNaN(d.getTime())) return String(value);

  // Pick granularity based on date range
  if (spanDays <= 60) {
    // Short range: show day + month
    return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
  }
  if (spanDays <= 730) {
    // Medium range (up to ~2 years): month + year short
    return d.toLocaleDateString('es-CL', { month: 'short', year: '2-digit' });
  }
  // Long range: month + full year
  return d.toLocaleDateString('es-CL', { month: 'short', year: 'numeric' });
}

function formatDateTooltip(value: unknown): string {
  if (value == null) return '';
  if (!isISODateString(value)) return String(value);
  const d = new Date(value as string);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: { name: string; value: unknown; color: string; dataKey?: string; payload?: Record<string, unknown> }[];
  label?: string;
  unitMap?: Record<string, string>;
  isPie?: boolean;
}

function CustomTooltip({ active, payload, label, unitMap, isPie: forcePie }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  // For pie/donut charts, label is undefined (no XAxis) — extract name from payload data
  const isPiePayload = forcePie || label == null;
  const displayLabel = isPiePayload
    ? (payload[0]?.payload?.name ?? payload[0]?.name ?? '')
    : formatDateTooltip(label);

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {displayLabel && displayLabel !== 'undefined' && (
        <p className="font-medium text-slate-700 mb-1">{String(displayLabel)}</p>
      )}
      {payload.map((entry, i) => {
        // For pie/donut, don't repeat the name as series label
        const seriesLabel = isPiePayload ? null : entry.name;
        const unit = unitMap?.[entry.dataKey ?? entry.name] ?? '';
        return (
          <p key={i} style={{ color: entry.color }} className="text-xs">
            {seriesLabel && <>{seriesLabel}: </>}
            <span className="font-semibold">
              {typeof entry.value === 'number' ? entry.value.toLocaleString('es-CL') : String(entry.value)}
              {unit && ` ${unit}`}
            </span>
          </p>
        );
      })}
    </div>
  );
}

// ─── Chart Component ──────────────────────────────────────────────────────────

interface ChartComponentProps {
  spec: ChartSpec;
  onInteract: (message: string) => void;
  /** Altura del ResponsiveContainer en px o porcentaje (`100%`) para llenar el contenedor padre. */
  chartHeight?: number | `${number}%`;
}

function ChartComponent({ spec, onInteract, chartHeight }: ChartComponentProps) {
  const [filterValues, setFilterValues] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {};
    spec.filters?.forEach((f) => { defaults[f.id] = f.default; });
    return defaults;
  });

  const filteredData = useMemo(() => {
    if (!spec.filters?.length) return spec.data;
    return spec.data.filter((row) =>
      spec.filters!.every((filter) => {
        const selected = filterValues[filter.id] ?? filter.default;
        if (selected === 'all') return true;
        return String(row[filter.key_to_filter]) === selected;
      })
    );
  }, [spec.data, spec.filters, filterValues]);

  const handleFilterChange = useCallback((filterId: string, value: string) => {
    setFilterValues((prev) => ({ ...prev, [filterId]: value }));
  }, []);

  // Coerce y_key values to numbers — Recharts cannot stack/compare string values
  const numericData = useMemo(() => {
    const yKeyNames = new Set(spec.y_keys.map(yk => yk.key));
    return filteredData.map(row => {
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
  }, [filteredData, spec.y_keys]);

  // Build unit map for tooltip formatting
  const unitMap = useMemo(() => {
    const map: Record<string, string> = {};
    spec.y_keys.forEach(yk => { if (yk.unit) map[yk.key] = yk.unit; });
    // For pie/donut with percentage-like values (0-100), auto-add "%" if no unit specified
    if ((spec.type === 'pie' || spec.type === 'donut') && !spec.y_keys[0]?.unit) {
      const vals = numericData.map(r => Number(r[spec.y_keys[0]?.key] ?? 0));
      const allPercentLike = vals.length > 0 && vals.every(v => v >= 0 && v <= 100);
      const sumClose100 = Math.abs(vals.reduce((a, b) => a + b, 0) - 100) < 5;
      if (allPercentLike && sumClose100) {
        map[spec.y_keys[0]?.key] = '%';
        map['value'] = '%'; // pie charts use "value" as dataKey
      }
    }
    return map;
  }, [spec.y_keys, spec.type, numericData]);

  const handleClick = useCallback(
    (xValue: unknown, yKey: string, yValue: unknown) => {
      if (!spec.selectable) return;
      const template =
        spec.on_click_message ||
        `Analiza en detalle: ${spec.x_key}={x_value}, valor={y_value}`;
      const message = template
        .replace('{x_value}', String(xValue))
        .replace('{y_value}', String(yValue))
        .replace('{x_key}', spec.x_key)
        .replace('{y_key}', yKey);
      onInteract(message);
    },
    [spec, onInteract]
  );

  // Detect if x_key values are dates to enable formatting
  const xIsDate = numericData.length > 0 && isISODateString(numericData[0][spec.x_key]);
  const spanDays = xIsDate ? computeDateSpanDays(numericData, spec.x_key) : 0;
  const needsRotation = numericData.length > 6;

  // Dual Y-axis detection
  const { hasDualAxis, yKeyAxisMap } = useMemo(() => {
    // Check explicit axis assignments
    const hasExplicitRight = spec.y_keys.some(yk => yk.axis === 'right');
    if (hasExplicitRight) {
      const map: Record<string, 'left' | 'right'> = {};
      spec.y_keys.forEach(yk => { map[yk.key] = yk.axis ?? 'left'; });
      return { hasDualAxis: true, yKeyAxisMap: map };
    }
    // Auto-detect: if we have 2+ series and scale differs >100x
    if (spec.y_keys.length >= 2 && numericData.length > 0) {
      const avgs = spec.y_keys.map(yk => {
        const vals = numericData.map(r => Number(r[yk.key])).filter(v => !isNaN(v) && v !== 0);
        return { key: yk.key, avg: vals.length > 0 ? vals.reduce((a, b) => a + Math.abs(b), 0) / vals.length : 0 };
      }).filter(a => a.avg > 0);
      if (avgs.length >= 2) {
        const maxAvg = Math.max(...avgs.map(a => a.avg));
        const minAvg = Math.min(...avgs.map(a => a.avg));
        if (maxAvg / minAvg > 100) {
          const map: Record<string, 'left' | 'right'> = {};
          avgs.sort((a, b) => b.avg - a.avg);
          avgs.forEach((item, i) => { map[item.key] = i === 0 ? 'left' : 'right'; });
          return { hasDualAxis: true, yKeyAxisMap: map };
        }
      }
    }
    return { hasDualAxis: false, yKeyAxisMap: {} as Record<string, 'left' | 'right'> };
  }, [spec.y_keys, numericData]);

  const commonProps = {
    data: numericData,
    margin: { top: 5, right: hasDualAxis ? 50 : 20, left: 10, bottom: needsRotation ? 60 : 5 },
  };

  const renderChart = () => {
    if (spec.type === 'pie' || spec.type === 'donut') {
      const data = numericData.map((row) => ({
        name: String(row[spec.x_key]),
        value: Number(row[spec.y_keys[0]?.key] ?? 0),
        color: undefined as string | undefined,
      }));
      // Always use full palette — use first y_key color as lead, then rest of palette
      const lead = spec.y_keys[0]?.color || BRAND_COLORS[0];
      const COLORS = [lead, ...BRAND_COLORS.filter(c => c !== lead)];
      const isDonut = spec.type === 'donut';

      return (
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={110}
            innerRadius={isDonut ? 55 : 0}
            cursor={spec.selectable ? 'pointer' : 'default'}
            onClick={(entry: { name: string; value: number }) => {
              handleClick(entry.name, spec.y_keys[0]?.key ?? '', entry.value);
            }}
          >
            {data.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip unitMap={unitMap} isPie />} />
          <Legend layout="vertical" align="right" verticalAlign="middle"
            wrapperStyle={{ fontSize: 11, lineHeight: '18px', paddingLeft: 10, maxWidth: '40%' }} />
        </PieChart>
      );
    }

    const axes = (
      <>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey={spec.x_key}
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickLine={false}
          tickMargin={8}
          tickFormatter={xIsDate ? (v: unknown) => formatDateTick(v, spanDays) : undefined}
          angle={needsRotation ? -45 : 0}
          textAnchor={needsRotation ? 'end' : 'middle'}
          height={needsRotation ? 90 : undefined}
          minTickGap={needsRotation ? 16 : 8}
        />
        <YAxis
          yAxisId={hasDualAxis ? 'left' : undefined}
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => v.toLocaleString('es-CL')}
        />
        {hasDualAxis && (
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => v.toLocaleString('es-CL')}
          />
        )}
        <Tooltip content={<CustomTooltip unitMap={unitMap} />} />
        <Legend wrapperStyle={{ fontSize: 12, lineHeight: '20px', display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }} />
      </>
    );

    if (spec.type === 'line') {
      return (
        <LineChart {...commonProps}>
          {axes}
          {spec.y_keys.map((yk) => (
            <Line
              key={yk.key}
              type="monotone"
              dataKey={yk.key}
              name={yk.label}
              stroke={yk.color}
              strokeWidth={2}
              yAxisId={hasDualAxis ? (yKeyAxisMap[yk.key] ?? 'left') : undefined}
              dot={{ r: spec.selectable ? 5 : 3, cursor: spec.selectable ? 'pointer' : 'default' }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              activeDot={spec.selectable ? {
                r: 7,
                cursor: 'pointer',
                onClick: (_event: unknown, props: any) => {
                  const row: Record<string, unknown> = props?.payload ?? {};
                  handleClick(row[spec.x_key], yk.key, row[yk.key]);
                },
              } : { r: 4 }}
            />
          ))}
        </LineChart>
      );
    }

    if (spec.type === 'area' || spec.type === 'stacked_area') {
      const isStacked = spec.type === 'stacked_area';
      // Stacked: opacidad uniforme para que las series superpuestas se distingan
      // sin "ensuciarse" entre sí (alpha medio + stroke definido).
      // Single-area: fill leve para no tapar grilla, con stroke marcado.
      const fillAlpha = isStacked ? '70' : '26';
      return (
        <AreaChart {...commonProps}>
          {/* Gradiente sutil de tope a base — solo en single-area, donde el
              énfasis está en el volumen acumulado de UNA serie. */}
          {!isStacked && (
            <defs>
              {spec.y_keys.map((yk) => (
                <linearGradient key={`grad-${yk.key}`} id={`area-grad-${spec.id}-${yk.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={yk.color} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={yk.color} stopOpacity={0.05} />
                </linearGradient>
              ))}
            </defs>
          )}
          {axes}
          {spec.y_keys.map((yk) => (
            <Area
              key={yk.key}
              type="monotone"
              dataKey={yk.key}
              name={yk.label}
              stroke={yk.color}
              fill={isStacked ? yk.color + fillAlpha : `url(#area-grad-${spec.id}-${yk.key})`}
              strokeWidth={2.2}
              stackId={isStacked ? 'stacked' : undefined}
              yAxisId={hasDualAxis ? (yKeyAxisMap[yk.key] ?? 'left') : undefined}
              cursor={spec.selectable ? 'pointer' : 'default'}
              dot={isStacked ? false : { r: 3, strokeWidth: 1.5, fill: '#fff', stroke: yk.color }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              activeDot={spec.selectable ? {
                r: 6,
                cursor: 'pointer',
                strokeWidth: 2,
                onClick: (_event: unknown, props: any) => {
                  const row: Record<string, unknown> = props?.payload ?? {};
                  handleClick(row[spec.x_key], yk.key, row[yk.key]);
                },
              } : { r: 4, strokeWidth: 2 }}
            />
          ))}
        </AreaChart>
      );
    }

    // ── Radar ──────────────────────────────────────────────────────
    // ── Waterfall ─────────────────────────────────────────────────
    if (spec.type === 'waterfall') {
      const yKey = spec.y_keys[0]?.key ?? '';
      let cumulative = 0;
      const waterfallData = numericData.map((row, i) => {
        const val = Number(row[yKey] ?? 0);
        const start = i === 0 ? 0 : cumulative;
        cumulative = i === 0 ? val : cumulative + val;
        return {
          ...row,
          _wf_start: i === 0 ? 0 : start,
          _wf_end: cumulative,
          _wf_value: val,
          _wf_fill: i === numericData.length - 1 ? '#0072B1' : val >= 0 ? '#2EC4B6' : '#E76F51',
        };
      });
      return (
        <BarChart data={waterfallData} margin={{ top: 5, right: 20, left: 10, bottom: needsRotation ? 60 : 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey={spec.x_key} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false}
            angle={needsRotation ? -45 : 0} textAnchor={needsRotation ? 'end' : 'middle'}
            height={needsRotation ? 70 : undefined} />
          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false}
            tickFormatter={(v: number) => v.toLocaleString('es-CL')} />
          <Tooltip content={<CustomTooltip unitMap={unitMap} />} />
          {/* Invisible base bar */}
          <Bar dataKey="_wf_start" stackId="waterfall" fill="transparent" />
          {/* Visible delta bar */}
          <Bar dataKey="_wf_value" stackId="waterfall" radius={[3, 3, 0, 0]}
            name={spec.y_keys[0]?.label ?? yKey}>
            {waterfallData.map((entry, i) => (
              <Cell key={i} fill={entry._wf_fill} />
            ))}
          </Bar>
        </BarChart>
      );
    }

    // Default: bar (including stacked_bar)
    const isStackedBar = spec.type === 'stacked_bar';
    return (
      <BarChart {...commonProps}>
        {axes}
        {spec.y_keys.map((yk) => (
          <Bar
            key={yk.key}
            dataKey={yk.key}
            name={yk.label}
            fill={yk.color}
            radius={isStackedBar ? undefined : [4, 4, 0, 0]}
            stackId={isStackedBar ? 'stacked' : undefined}
            yAxisId={hasDualAxis ? (yKeyAxisMap[yk.key] ?? 'left') : undefined}
            cursor={spec.selectable ? 'pointer' : 'default'}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onClick={(entry: any) => {
              handleClick(entry[spec.x_key], yk.key, entry[yk.key]);
            }}
          />
        ))}
      </BarChart>
    );
  };

  // Cuando el caller pide ocupar 100% del contenedor (modal expand), root del
  // componente pasa a `flex flex-col h-full` y el ResponsiveContainer va en
  // `flex-1` para tomar el espacio sobrante. Sin esto, Recharts recibe -1×-1
  // (cadena de heights rota: el div root sin altura colapsa el 100%).
  const fillParent = chartHeight === '100%';
  return (
    <div
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
      className={fillParent ? 'h-full flex flex-col' : ''}
    >
      <div className={fillParent ? 'mb-3 shrink-0' : 'mb-3'}>
        <h3 className="text-sm font-semibold text-slate-800">{spec.title}</h3>
        {spec.description && (
          <p className="text-xs text-slate-500 mt-0.5" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>{spec.description}</p>
        )}
      </div>

      {!!spec.filters?.length && (
        <div className={fillParent ? 'shrink-0' : ''}>
          <FilterPanel
            filters={spec.filters}
            values={filterValues}
            onChange={handleFilterChange}
            disabled={false}
          />
        </div>
      )}

      <div className={fillParent ? 'flex-1 min-h-0' : ''}>
        <ResponsiveContainer width="100%" height={fillParent ? '100%' : (chartHeight ?? 300)}>
          {renderChart()}
        </ResponsiveContainer>
      </div>

      {spec.selectable && (
        <p className={fillParent ? 'shrink-0 text-xs text-slate-400 mt-2 text-center' : 'text-xs text-slate-400 mt-2 text-center'}>
          {spec.type === 'pie' || spec.type === 'donut'
            ? 'Haz clic en un segmento del gráfico para analizarlo en detalle'
            : (spec.type === 'bar' || spec.type === 'stacked_bar')
            ? 'Haz clic en una barra del gráfico para analizarla en detalle'
            : 'Haz clic en un punto del gráfico para analizarlo en detalle'}
        </p>
      )}
    </div>
  );
}

// ─── ChartBlock (exported wrapper) ────────────────────────────────────────────

interface ChartBlockProps {
  spec: ChartSpec;
  onInteract: (message: string) => void;
}

export function ChartBlock({ spec, onInteract }: ChartBlockProps) {
  return (
    <ExpandableChartWrapper
      title={spec.title || 'Gráfico'}
      description={spec.description}
      filename={`chart_${spec.id}`}
      className="my-4"
      expandedContent={
        <div className="h-full">
          <ChartComponent spec={spec} onInteract={onInteract} chartHeight="100%" />
        </div>
      }
    >
      <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
        <ChartComponent spec={spec} onInteract={onInteract} />
      </div>
    </ExpandableChartWrapper>
  );
}
