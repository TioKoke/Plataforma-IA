import { useState, type ElementType } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import { TrendingUp, TrendingDown, Users, Bot, Clock, Award, Download, Calendar, MessageSquare, Layers, FileText } from 'lucide-react';
import SpotlightCard from '../components/reactbits/SpotlightCard';
import { motion } from 'framer-motion';
import { useStats } from '../hooks/useStats';

function calcTrend(current: number, prev: number): { pct: number; up: boolean } {
  if (!prev) return { pct: 0, up: true };
  const pct = ((current - prev) / prev) * 100;
  return { pct: Math.abs(pct), up: pct >= 0 };
}

const DATE_RANGE_DAYS: Record<string, number> = {
  '7d': 7, '30d': 30, '90d': 90, '1y': 365,
};

interface ExecKpiCardProps {
  icon: ElementType;
  title: string;
  value: string | number;
  unit?: string;
  trend?: { pct: number; up: boolean };
  borderColor: string;
  iconColor: string;
  sublabel?: string;
  loading?: boolean;
}

const ExecKpiCard = ({ icon: Icon, title, value, unit, trend, borderColor, iconColor, sublabel, loading }: ExecKpiCardProps) => (
  <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm p-6 border-l-4 ${borderColor}`}>
    <div className="flex items-center justify-between mb-3">
      <div className={`p-2 rounded-xl bg-gray-50 ${iconColor}`}>
        <Icon size={22} />
      </div>
      {trend && trend.pct > 0 && (
        <div className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold ${trend.up ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
          {trend.up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          <span>{trend.pct.toFixed(1)}%</span>
        </div>
      )}
    </div>
    <p className="text-gray-500 text-xs font-medium uppercase tracking-wide mb-1">{title}</p>
    <p className="font-heading font-black text-4xl text-plataforma-gris-oscuro">
      {loading ? '…' : value}
      {unit && <span className="text-lg font-medium text-gray-400 ml-1">{unit}</span>}
    </p>
    {trend && trend.pct > 0 && (
      <p className={`text-xs mt-1 ${trend.up ? 'text-green-600' : 'text-red-500'}`}>
        {trend.up ? '▲' : '▼'} {trend.pct.toFixed(1)}% vs mes anterior
      </p>
    )}
    {sublabel && <p className="text-xs text-gray-400 mt-1">{sublabel}</p>}
  </div>
);

const DashboardPage = () => {
  const [viewMode, setViewMode] = useState<'operacional' | 'gerencial'>('operacional');
  const [selectedDivision, setSelectedDivision] = useState('Todas');
  const [dateRange, setDateRange] = useState('30d');

  const days = DATE_RANGE_DAYS[dateRange] ?? 30;
  const { stats: apiStats, loading } = useStats(days);

  // Derived stats for Gerencial view
  const lastMonth = apiStats?.monthly_activity.at(-1);
  const prevMonth = apiStats?.monthly_activity.at(-2);
  const trendUsers = calcTrend(lastMonth?.unique_users ?? 0, prevMonth?.unique_users ?? 0);
  const trendConvs = calcTrend(lastMonth?.conversations ?? 0, prevMonth?.conversations ?? 0);
  const trendHours = calcTrend(lastMonth?.conversations ?? 0, prevMonth?.conversations ?? 0);
  const convRatio = apiStats
    ? (apiStats.kpis.total_conversations / Math.max(apiStats.kpis.unique_users, 1)).toFixed(1)
    : '—';
  const avgTokensPerCall = apiStats?.model_usage.period.calls
    ? Math.round(apiStats.model_usage.period.total_tokens / apiStats.model_usage.period.calls).toLocaleString()
    : '—';

  const divisions = ['Todas', 'Chuquicamata', 'Andina', 'El Teniente', 'Gabriela Mistral', 'Ministro Hales'];
  const dateRanges = [
    { value: '7d', label: 'Últimos 7 días' },
    { value: '30d', label: 'Últimos 30 días' },
    { value: '90d', label: 'Últimos 90 días' },
    { value: '1y', label: 'Último año' }
  ];

  const formatTrend = (t: { pct: number; up: boolean }): string | null =>
    t.pct > 0 ? `${t.up ? '+' : '-'}${t.pct.toFixed(1)}%` : null;

  const engagementScore = apiStats?.engagement_score ?? null;

  const kpis = [
    {
      icon: Users,
      label: 'Usuarios Activos',
      value: loading ? '…' : (apiStats?.kpis.unique_users ?? 0).toLocaleString(),
      change: formatTrend(trendUsers),
      trend: trendUsers.up ? 'up' : 'down',
      color: 'naranja',
    },
    {
      icon: Bot,
      label: 'Agentes en Uso',
      value: loading ? '…' : (apiStats?.kpis.total_agents ?? 0).toString(),
      change: null,
      trend: 'up',
      color: 'turquesa',
    },
    {
      icon: Clock,
      label: 'Horas Ahorradas',
      value: loading ? '…' : (apiStats?.kpis.hours_saved ?? 0).toLocaleString(),
      change: formatTrend(trendHours),
      trend: trendHours.up ? 'up' : 'down',
      color: 'azul',
    },
    {
      icon: Award,
      label: 'Engagement Score',
      value: engagementScore != null ? `${engagementScore}%` : 'Sin dato',
      change: null,
      trend: 'up',
      color: 'verde-oscuro',
    },
  ];

  // Chart data
  const monthlyActivityData = (apiStats?.monthly_activity ?? []).map((m) => ({
    mes: m.mes,
    usuarios: m.unique_users,
    conversaciones: m.conversations,
  }));

  const monthlyUsersData = monthlyActivityData;

  const DIVISION_COLORS = ['#E55302', '#0098AA', '#F4AA00', '#0072B1', '#106470', '#C4C1A0'];
  const divisionAdoptionData = (apiStats?.division_breakdown ?? [])
    .filter((d) => selectedDivision === 'Todas' || d.nombre === selectedDivision)
    .map((d, i) => ({
      nombre: d.nombre,
      value: d.value,
      color: DIVISION_COLORS[i % DIVISION_COLORS.length],
    }));

  const topDivisionsData = (apiStats?.division_breakdown ?? [])
    .slice(0, 5)
    .map((d) => ({ division: d.nombre, usos: d.value }));

  const userGrowthData = (apiStats?.monthly_activity ?? []).map((m) => ({
    mes: m.mes,
    nuevos: m.new_users,
    recurrentes: m.returning_users,
  }));

  const getBorderColor = (color: string) => {
    const colors: Record<string, string> = {
      naranja: 'border-plataforma-naranja',
      turquesa: 'border-plataforma-turquesa',
      azul: 'border-plataforma-azul',
      'verde-oscuro': 'border-plataforma-verde-oscuro'
    };
    return colors[color] || colors.naranja;
  };

  return (
    <>
      {/* Header */}
      <section className="border-b border-border-soft">
        <div className="ck-container pt-10 pb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <span className="ck-pill mb-3">
              <Layers className="size-3" />
              <span className="ck-mono text-[11px] tracking-wider text-ink-2">
                {viewMode === 'gerencial' ? 'EJECUTIVO' : 'OPERACIONAL'}
              </span>
            </span>
            <h1 className="ck-display text-[40px] leading-tight">
              Dashboard
            </h1>
            <p className="text-base text-ink-muted mt-2 max-w-[640px]">
              {viewMode === 'gerencial'
                ? 'Resumen ejecutivo de adopción e impacto de IA en la plataforma.'
                : 'Monitoreo en tiempo real de adopción y uso de IA en la plataforma.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-ink-muted">Vista:</span>
            <div className="flex gap-0.5 bg-bg-inset p-1 rounded-full border border-border-soft">
              {(['operacional', 'gerencial'] as const).map((mode) => {
                const active = viewMode === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-all capitalize ${
                      active
                        ? 'bg-bg-elev text-ink shadow-[0_1px_2px_oklch(0.18_0.02_255/0.06),0_0_0_1px_var(--border-soft)]'
                        : 'text-ink-muted hover:text-ink-2'
                    }`}
                  >
                    {mode}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <div className="bg-bg">
        <div className="ck-container py-8">
          {/* Filters */}
          <div className="ck-card p-4 mb-8 flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-ink-muted" />
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-3 py-2 bg-bg-elev border border-border-soft rounded-md text-sm text-ink focus:outline-none focus:border-[var(--primary-ck)]"
              >
                {dateRanges.map((range) => (
                  <option key={range.value} value={range.value}>{range.label}</option>
                ))}
              </select>
            </div>

            <select
              value={selectedDivision}
              onChange={(e) => setSelectedDivision(e.target.value)}
              className="px-3 py-2 bg-bg-elev border border-border-soft rounded-md text-sm text-ink focus:outline-none focus:border-[var(--primary-ck)]"
            >
              {divisions.map((div) => (
                <option key={div} value={div}>{div === 'Todas' ? 'Todas las divisiones' : div}</option>
              ))}
            </select>

            <button className="ck-btn ck-btn-primary ml-auto">
              <Download size={14} />
              Exportar Reporte
            </button>
          </div>

          {/* ═══════════ VISTA GERENCIAL ═══════════ */}
          {viewMode === 'gerencial' && (
            <>
              {/* KPIs ejecutivos — fila 1 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                <ExecKpiCard
                  icon={Users}
                  title="Usuarios Activos"
                  value={(apiStats?.kpis.unique_users ?? 0).toLocaleString()}
                  trend={trendUsers}
                  borderColor="border-plataforma-naranja"
                  iconColor="text-plataforma-naranja"
                  sublabel={`${(apiStats?.kpis.unique_users_total ?? 0).toLocaleString()} usuarios acumulados`}
                  loading={loading}
                />
                <ExecKpiCard
                  icon={Clock}
                  title="Horas Ahorradas"
                  value={(apiStats?.kpis.hours_saved ?? 0).toLocaleString()}
                  unit="h"
                  trend={trendHours}
                  borderColor="border-plataforma-turquesa"
                  iconColor="text-plataforma-turquesa"
                  sublabel={`Total acumulado: ${(apiStats?.kpis.hours_saved_total ?? 0).toLocaleString()} h`}
                  loading={loading}
                />
                <ExecKpiCard
                  icon={MessageSquare}
                  title="Conv. por Usuario"
                  value={convRatio}
                  unit="x"
                  trend={trendConvs}
                  borderColor="border-plataforma-azul"
                  iconColor="text-plataforma-azul"
                  sublabel={`${(apiStats?.kpis.total_conversations ?? 0).toLocaleString()} conversaciones totales`}
                  loading={loading}
                />
              </div>

              {/* KPIs ejecutivos — fila 2 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <ExecKpiCard
                  icon={Bot}
                  title="Agentes Disponibles"
                  value={(apiStats?.kpis.total_agents ?? 0).toString()}
                  borderColor="border-plataforma-verde-oscuro"
                  iconColor="text-plataforma-verde-oscuro"
                  sublabel="Catálogo activo de agentes IA"
                  loading={loading}
                />
                <ExecKpiCard
                  icon={FileText}
                  title="Requerimientos Backlog"
                  value={(apiStats?.kpis.total_backlogs ?? 0).toString()}
                  borderColor="border-yellow-500"
                  iconColor="text-yellow-600"
                  sublabel="Requerimientos registrados"
                  loading={loading}
                />
                <ExecKpiCard
                  icon={Layers}
                  title="Tokens / Llamada (prom.)"
                  value={avgTokensPerCall}
                  borderColor="border-purple-500"
                  iconColor="text-purple-600"
                  sublabel={`${(apiStats?.model_usage.period.calls ?? 0).toLocaleString()} llamadas al modelo`}
                  loading={loading}
                />
              </div>

              {/* Gráficos ejecutivos */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Actividad mensual — 2 series reales */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                  <h3 className="font-heading font-medium text-plataforma-gris-oscuro text-lg mb-1">
                    Actividad Mensual
                  </h3>
                  <p className="text-xs text-gray-400 mb-5">Conversaciones y usuarios únicos por mes</p>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={monthlyActivityData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="mes" stroke="#6b7280" style={{ fontSize: '12px' }} />
                      <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                      <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px' }} />
                      <Legend wrapperStyle={{ fontSize: '13px' }} />
                      <Line type="monotone" dataKey="conversaciones" stroke="#E55302" strokeWidth={2.5} dot={{ fill: '#E55302', r: 4 }} activeDot={{ r: 6 }} name="Conversaciones" />
                      <Line type="monotone" dataKey="usuarios" stroke="#0098AA" strokeWidth={2.5} dot={{ fill: '#0098AA', r: 4 }} activeDot={{ r: 6 }} name="Usuarios únicos" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Usuarios nuevos vs recurrentes */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                  <h3 className="font-heading font-medium text-plataforma-gris-oscuro text-lg mb-1">
                    Nuevos vs Recurrentes
                  </h3>
                  <p className="text-xs text-gray-400 mb-5">Retención y crecimiento de base de usuarios</p>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={userGrowthData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="mes" stroke="#6b7280" style={{ fontSize: '12px' }} />
                      <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                      <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px' }} />
                      <Legend wrapperStyle={{ fontSize: '13px' }} />
                      <Area type="monotone" dataKey="recurrentes" stackId="1" stroke="#E55302" fill="#E55302" fillOpacity={0.55} name="Recurrentes" />
                      <Area type="monotone" dataKey="nuevos" stackId="1" stroke="#0098AA" fill="#0098AA" fillOpacity={0.55} name="Nuevos" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Uso del Modelo IA — resumen ejecutivo */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-8">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="font-heading font-medium text-plataforma-gris-oscuro text-lg">Uso del Modelo IA</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Consumo diario de tokens en el período seleccionado</p>
                  </div>
                  <div className="flex gap-6 text-right">
                    {[
                      { label: 'Tokens totales', value: (apiStats?.model_usage.period.total_tokens ?? 0).toLocaleString(), color: 'text-plataforma-naranja' },
                      { label: 'Llamadas', value: (apiStats?.model_usage.period.calls ?? 0).toLocaleString(), color: 'text-plataforma-verde-oscuro' },
                    ].map((s, i) => (
                      <div key={i}>
                        <p className={`font-heading font-bold text-xl ${s.color}`}>{loading ? '…' : s.value}</p>
                        <p className="text-xs text-gray-400">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
                {(apiStats?.model_usage.daily_series ?? []).some(d => d.total_tokens > 0) ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={apiStats?.model_usage.daily_series ?? []} barSize={14}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="dia" stroke="#6b7280" style={{ fontSize: '11px' }} interval={Math.floor((apiStats?.model_usage.daily_series.length ?? 1) / 10)} />
                      <YAxis stroke="#6b7280" style={{ fontSize: '11px' }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '12px' }}
                        formatter={(value: number, name: string) => [value.toLocaleString(), name]}
                        labelFormatter={(label) => `Día ${label}`}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Bar dataKey="prompt_tokens" stackId="a" fill="#0072B1" name="Prompt" />
                      <Bar dataKey="completion_tokens" stackId="a" fill="#E55302" name="Completion" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-32 flex items-center justify-center text-gray-400 text-sm">
                    Sin datos de uso en el período seleccionado
                  </div>
                )}
              </div>
            </>
          )}
          {/* ═══════════ FIN VISTA GERENCIAL ═══════════ */}

          {/* ═══════════ VISTA OPERACIONAL ═══════════ */}
          {viewMode === 'operacional' && (
            <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {kpis.map((kpi, index) => {
              const Icon = kpi.icon;
              const spotlightColor = {
                naranja: 'rgba(229, 83, 2, 0.15)',
                turquesa: 'rgba(0, 152, 170, 0.15)',
                azul: 'rgba(0, 114, 177, 0.15)',
                'verde-oscuro': 'rgba(16, 100, 112, 0.15)'
              }[kpi.color] || 'rgba(229, 83, 2, 0.15)';
              
              const iconColors: Record<string, string> = {
                naranja: 'text-plataforma-naranja',
                turquesa: 'text-plataforma-turquesa',
                azul: 'text-plataforma-azul',
                'verde-oscuro': 'text-plataforma-verde-oscuro'
              };

              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.06, ease: 'easeOut' }}
                  whileHover={{ y: -4 }}
                >
                <SpotlightCard
                  spotlightColor={spotlightColor}
                  className={`bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-xl transition-all duration-300 p-6 border-l-4 ${getBorderColor(kpi.color)} group`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-2.5 rounded-xl bg-gray-50 group-hover:scale-110 transition-transform duration-300 ${iconColors[kpi.color] || 'text-gray-400'} shadow-sm`}>
                      <Icon size={24} />
                    </div>
                    {kpi.change && (
                      <div className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold ${kpi.trend === 'up' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                        {kpi.trend === 'up' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        <span>{kpi.change}</span>
                      </div>
                    )}
                  </div>
                  <h3 className="font-heading font-black text-4xl mb-1 text-plataforma-gris-oscuro">
                    {kpi.value}
                  </h3>
                  <p className="text-gray-500 font-medium text-sm">{kpi.label}</p>
                </SpotlightCard>
                </motion.div>
              );
            })}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h3 className="font-heading font-medium text-plataforma-gris-oscuro text-lg mb-6">
                Usuarios Activos Mensuales
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyUsersData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="mes" stroke="#6b7280" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }} />
                  <Line type="monotone" dataKey="usuarios" stroke="#E55302" strokeWidth={2} dot={{ fill: '#E55302', r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h3 className="font-heading font-medium text-plataforma-gris-oscuro text-lg mb-1">
                Top 5 Divisiones que más usan IA
              </h3>
              <p className="text-xs text-gray-400 mb-5">Conversaciones por división en el período</p>
              {topDivisionsData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topDivisionsData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" stroke="#6b7280" style={{ fontSize: '12px' }} />
                    <YAxis dataKey="division" type="category" width={150} stroke="#6b7280" style={{ fontSize: '11px' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }} />
                    <Bar dataKey="usos" fill="#0098AA" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">
                  Sin datos en el período seleccionado
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h3 className="font-heading font-medium text-plataforma-gris-oscuro text-lg mb-6">
                Adopción por División
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={divisionAdoptionData}
                    cx="50%" cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.payload?.nombre || ''} ${((entry.percent || 0) * 100).toFixed(0)}%`}
                    outerRadius={100} fill="#8884d8" dataKey="value"
                  >
                    {divisionAdoptionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h3 className="font-heading font-medium text-plataforma-gris-oscuro text-lg mb-6">
                Usuarios Nuevos vs Recurrentes
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={userGrowthData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="mes" stroke="#6b7280" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }} />
                  <Legend wrapperStyle={{ fontSize: '14px' }} />
                  <Area type="monotone" dataKey="recurrentes" stackId="1" stroke="#E55302" fill="#E55302" fillOpacity={0.6} name="Recurrentes" />
                  <Area type="monotone" dataKey="nuevos" stackId="1" stroke="#0098AA" fill="#0098AA" fillOpacity={0.6} name="Nuevos" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Model Usage Section */}
          <div className="mb-8">
            <h2 className="font-heading font-semibold text-plataforma-gris-oscuro text-xl mb-4">
              Uso del Modelo IA
            </h2>

            {/* Usage KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Tokens Totales (período)', value: loading ? '…' : (apiStats?.model_usage.period.total_tokens ?? 0).toLocaleString(), border: 'border-plataforma-naranja' },
                { label: 'Tokens Prompt', value: loading ? '…' : (apiStats?.model_usage.period.prompt_tokens ?? 0).toLocaleString(), border: 'border-plataforma-azul' },
                { label: 'Tokens Completion', value: loading ? '…' : (apiStats?.model_usage.period.completion_tokens ?? 0).toLocaleString(), border: 'border-plataforma-turquesa' },
                { label: 'Llamadas al Modelo', value: loading ? '…' : (apiStats?.model_usage.period.calls ?? 0).toLocaleString(), border: 'border-plataforma-verde-oscuro' },
              ].map((card, i) => (
                <div key={i} className={`bg-white rounded-2xl border border-gray-200 shadow-sm p-5 border-l-4 ${card.border}`}>
                  <p className="text-xs text-gray-500 mb-1">{card.label}</p>
                  <p className="font-heading font-bold text-2xl text-plataforma-gris-oscuro">{card.value}</p>
                </div>
              ))}
            </div>

            {/* Daily tokens chart */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h3 className="font-heading font-medium text-plataforma-gris-oscuro text-lg mb-6">
                Tokens Consumidos por Día
              </h3>
              {(apiStats?.model_usage.daily_series ?? []).some(d => d.total_tokens > 0) ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={apiStats?.model_usage.daily_series ?? []} barSize={16}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="dia" stroke="#6b7280" style={{ fontSize: '11px' }} interval={Math.floor((apiStats?.model_usage.daily_series.length ?? 1) / 10)} />
                    <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px' }}
                      formatter={(value: number, name: string) => [value.toLocaleString(), name]}
                      labelFormatter={(label) => `Día ${label}`}
                    />
                    <Legend wrapperStyle={{ fontSize: '13px' }} />
                    <Bar dataKey="prompt_tokens" stackId="a" fill="#0072B1" name="Prompt" />
                    <Bar dataKey="completion_tokens" stackId="a" fill="#E55302" name="Completion" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
                  Sin datos de uso en el período seleccionado
                </div>
              )}
            </div>
          </div>

          {/* Bottom metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 border-l-4 border-plataforma-naranja">
              <h4 className="text-sm text-gray-600 mb-2">Horas Ahorradas Total</h4>
              <p className="font-heading font-bold text-4xl text-plataforma-amarillo mb-4">
                {loading ? '…' : (apiStats?.kpis.hours_saved_total ?? 0).toLocaleString()}
              </p>
              <div className="h-14 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-200">
                <div className="text-center">
                  <p className="text-xs text-gray-500">Equivalente a</p>
                  <p className="font-heading font-semibold text-plataforma-gris-oscuro">
                    {loading ? '…' : `${Math.round((apiStats?.kpis.hours_saved_total ?? 0) / 24)} días`}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 border-l-4 border-plataforma-turquesa">
              <h4 className="text-sm text-gray-600 mb-2">Engagement Score</h4>
              <p className="font-heading font-bold text-4xl text-plataforma-amarillo mb-4">
                {engagementScore != null ? `${engagementScore}%` : '—'}
              </p>
              <div className="h-14 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-200">
                <div className="text-center">
                  <p className="text-xs text-gray-500">
                    {engagementScore != null ? 'Satisfacción' : 'Sin dato configurado'}
                  </p>
                  {engagementScore != null && (
                    <p className="font-heading font-semibold text-plataforma-gris-oscuro">
                      {engagementScore >= 80 ? 'Excelente' : engagementScore >= 60 ? 'Bueno' : 'A mejorar'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 border-l-4 border-plataforma-verde-oscuro">
              <h4 className="text-sm text-gray-600 mb-2">ROI Estimado</h4>
              <p className="font-heading font-bold text-4xl text-plataforma-amarillo mb-4">
                {apiStats?.roi_estimated_usd != null
                  ? `$${(apiStats.roi_estimated_usd / 1_000_000).toFixed(1)}M`
                  : '—'}
              </p>
              <div className="h-14 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-200">
                <div className="text-center">
                  <p className="text-xs text-gray-500">
                    {apiStats?.roi_estimated_usd != null ? 'Retorno anual' : 'Sin dato configurado'}
                  </p>
                  {apiStats?.roi_estimated_usd != null && (
                    <p className="font-heading font-semibold text-plataforma-gris-oscuro">USD</p>
                  )}
                </div>
              </div>
            </div>
          </div>
            </>
          )}
          {/* ═══════════ FIN VISTA OPERACIONAL ═══════════ */}

        </div>
      </div>
    </>
  );
};

export default DashboardPage;
