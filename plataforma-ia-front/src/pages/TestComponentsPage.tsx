import { MarkdownMessage } from '../components/MarkdownMessage';

// ─── Mock KPI data ───────────────────────────────────────────────────────────

const KPI_MOCK = JSON.stringify({
  id: "kpis_produccion_q1",
  title: "Indicadores de Producción Q1 2026",
  description: "Resumen de métricas clave de operaciones mineras",
  columns: 3,
  cards: [
    {
      id: "kpi_cu",
      label: "Producción Cu",
      value: 245680,
      format: "number",
      unit: "toneladas",
      icon: "Factory",
      color: "turquesa",
      trend: { direction: "up", value: "+5.2%", label: "vs Q4 2025" },
      comparison: { value: 233500, label: "Q4 2025" },
      sparkline: [220000, 225000, 231000, 228000, 240000, 238000, 245680],
    },
    {
      id: "kpi_costo",
      label: "Costo Operacional",
      value: 1.85,
      format: "currency",
      unit: "USD/lb",
      icon: "DollarSign",
      color: "naranja",
      trend: { direction: "down", value: "-3.1%", label: "vs Q4 2025" },
      sparkline: [2.1, 2.05, 1.98, 1.92, 1.88, 1.85],
    },
    {
      id: "kpi_disponibilidad",
      label: "Disponibilidad Planta",
      value: 0.942,
      format: "percentage",
      icon: "Target",
      color: "verde-oscuro",
      trend: { direction: "up", value: "+1.8%", label: "vs Q4 2025" },
      target: { value: 0.95, label: "Meta Q1" },
    },
    {
      id: "kpi_seguridad",
      label: "Índice de Seguridad",
      value: 0.98,
      format: "percentage",
      icon: "Shield",
      color: "azul",
      trend: { direction: "flat", value: "0.0%", label: "sin cambio" },
    },
    {
      id: "kpi_horas",
      label: "Horas Ahorradas IA",
      value: 12450,
      format: "compact",
      unit: "horas",
      icon: "Zap",
      color: "amarillo",
      trend: { direction: "up", value: "+22%", label: "vs Q4 2025" },
      sparkline: [8200, 9100, 9800, 10500, 11200, 12450],
    },
    {
      id: "kpi_usuarios",
      label: "Usuarios Activos",
      value: 1834,
      format: "number",
      icon: "Users",
      color: "rojo",
      trend: { direction: "up", value: "+15%", label: "vs Q4 2025" },
      target: { value: 2000, label: "Meta Q1" },
    },
  ],
});

// ─── Mock Flowchart ──────────────────────────────────────────────────────────

const FLOWCHART_MOCK = JSON.stringify({
  id: "flujo_aprobacion",
  type: "flowchart",
  title: "Proceso de Aprobación de Contratos",
  description: "Flujo de revisión y aprobación para contratos mayores a USD 100K",
  direction: "TB",
  nodes: [
    { id: "n1", label: "Solicitud de Contrato", description: "Gerencia operativa inicia", icon: "FileText", category: "start" },
    { id: "n2", label: "Revisión Legal", description: "Equipo jurídico revisa términos", icon: "Shield", category: "process" },
    { id: "n3", label: "¿Monto > USD 500K?", category: "decision" },
    { id: "n4", label: "Aprobación Gerente", description: "Gerente de área aprueba", icon: "UserCheck", category: "process" },
    { id: "n5", label: "Aprobación VP", description: "Vicepresidente revisa y firma", icon: "Award", category: "process" },
    { id: "n6", label: "Contrato Firmado", icon: "CheckCircle", category: "end" },
    { id: "n7", label: "Devolver a Revisión", icon: "AlertTriangle", category: "warning" },
  ],
  edges: [
    { source: "n1", target: "n2", label: "Enviar" },
    { source: "n2", target: "n3" },
    { source: "n3", target: "n4", label: "No (< 500K)" },
    { source: "n3", target: "n5", label: "Sí (≥ 500K)" },
    { source: "n4", target: "n6", label: "Aprobado" },
    { source: "n5", target: "n6", label: "Aprobado" },
    { source: "n4", target: "n7", label: "Rechazado", style: "dashed" },
    { source: "n5", target: "n7", label: "Rechazado", style: "dashed" },
    { source: "n7", target: "n2", label: "Corregir", style: "dotted" },
  ],
});

// ─── Mock Timeline ───────────────────────────────────────────────────────────

const TIMELINE_MOCK = JSON.stringify({
  id: "timeline_proyecto",
  type: "timeline",
  title: "Roadmap Plataforma IA 2026",
  direction: "LR",
  nodes: [
    { id: "t1", label: "Kick-off", description: "Enero 2026", icon: "Flame", category: "start", color: "turquesa" },
    { id: "t2", label: "MVP Agentes", description: "Marzo 2026", icon: "Cpu", category: "process", color: "azul" },
    { id: "t3", label: "Piloto División", description: "Mayo 2026", icon: "Users", category: "process", color: "naranja" },
    { id: "t4", label: "Integración SAP", description: "Julio 2026", icon: "Database", category: "process", color: "verde-oscuro" },
    { id: "t5", label: "Rollout Completo", description: "Octubre 2026", icon: "Globe", category: "end", color: "rojo" },
  ],
  edges: [
    { source: "t1", target: "t2" },
    { source: "t2", target: "t3" },
    { source: "t3", target: "t4" },
    { source: "t4", target: "t5" },
  ],
});

// ─── Mock Waterfall ───────────────────────────────────────────────────────────

const WATERFALL_MOCK = JSON.stringify({
  type: "waterfall", id: "waterfall_financiero", title: "Desglose Financiero Q1 2026",
  description: "Ingresos → costos → resultado neto (MUSD)",
  x_key: "concepto", y_keys: [{ key: "monto", label: "Monto (MUSD)", color: "#0072B1" }],
  data: [
    { concepto: "Ingresos Cobre", monto: 1200 },
    { concepto: "Ingresos Subproductos", monto: 180 },
    { concepto: "Costos Operación", monto: -650 },
    { concepto: "Costos Energía", monto: -200 },
    { concepto: "Costos RRHH", monto: -120 },
    { concepto: "Depreciación", monto: -85 },
    { concepto: "Impuestos", monto: -95 },
    { concepto: "Resultado Neto", monto: 230 },
  ],
});

// ─── Mock Dashboard ──────────────────────────────────────────────────────────

const DASHBOARD_MOCK = JSON.stringify({
  id: "dash_ops_q1",
  title: "Dashboard Operacional — Q1 2026",
  description: "Vista integral de operaciones mineras con KPIs, gráficos y análisis",
  layout: { columns: 3 },
  panels: [
    { id: "k1", type: "kpi", title: "Producción Cu", span: 1, kpi: { value: 245680, label: "toneladas", trend: { direction: "up", value: "+5.2%" }, format: "number" }},
    { id: "k2", type: "kpi", title: "Costo USD/lb", span: 1, kpi: { value: 1.85, label: "USD/lb", trend: { direction: "down", value: "-3.1%" }, format: "currency" }},
    { id: "k3", type: "kpi", title: "Disponibilidad", span: 1, kpi: { value: 0.942, label: "planta", trend: { direction: "up", value: "+1.8%" }, format: "percentage" }},
    { id: "p_bar", type: "bar", title: "Producción por Metal", span: 2,
      x_key: "metal",
      y_keys: [{ key: "produccion", label: "Toneladas", color: "#0072B1" }],
      data: [
        { metal: "Cobre", produccion: 245680 },
        { metal: "Molibdeno", produccion: 12400 },
        { metal: "Oro", produccion: 850 },
        { metal: "Plata", produccion: 3200 },
      ]
    },
    { id: "p_table", type: "table", title: "Últimos Eventos", span: 1,
      data: [
        { evento: "Mantención SAG #3", fecha: "2026-03-12", estado: "Completado" },
        { evento: "Inspección eléctrica", fecha: "2026-03-14", estado: "En curso" },
        { evento: "Calibración sensores", fecha: "2026-03-15", estado: "Pendiente" },
      ],
      table_columns: [
        { key: "evento", label: "Evento" },
        { key: "fecha", label: "Fecha" },
        { key: "estado", label: "Estado" },
      ]
    },
  ],
});

// ─── Mock Widgets ─────────────────────────────────────────────────────────────

const COMPARISON_MOCK = JSON.stringify({
  id: "comp_planes", type: "comparison", title: "Opciones de Implementación IA",
  options: [
    { title: "Plan Básico", icon: "Package", color: "azul", features: [
      { label: "Agentes IA", value: "5" }, { label: "Usuarios", value: "50" },
      { label: "Soporte 24/7", value: false }, { label: "API acceso", value: true },
    ]},
    { title: "Plan Profesional", icon: "Zap", color: "turquesa", badge: "Recomendado", features: [
      { label: "Agentes IA", value: "15" }, { label: "Usuarios", value: "200" },
      { label: "Soporte 24/7", value: true }, { label: "API acceso", value: true },
    ]},
    { title: "Plan Enterprise", icon: "Building2", color: "naranja", features: [
      { label: "Agentes IA", value: "Ilimitados" }, { label: "Usuarios", value: "Ilimitados" },
      { label: "Soporte 24/7", value: true }, { label: "API acceso", value: true },
    ]},
  ],
});

const SWOT_MOCK = JSON.stringify({
  id: "swot_ia", type: "swot", title: "Análisis SWOT — IA en Operaciones Mineras",
  swot: {
    strengths: ["Gran volumen de datos operacionales", "Equipo técnico capacitado", "Infraestructura cloud Azure"],
    weaknesses: ["Resistencia al cambio en terreno", "Datos no estandarizados entre divisiones", "Dependencia de proveedores externos"],
    opportunities: ["Reducción 15% costos operacionales", "Mantenimiento predictivo SAG/molinos", "Automatización reportes regulatorios"],
    threats: ["Regulación de IA en minería", "Competencia por talento tech", "Ciberseguridad en sistemas OT"],
  },
});

const CHECKLIST_MOCK = JSON.stringify({
  id: "check_audit", type: "checklist", title: "Auditoría de Seguridad — Planta Concentradora",
  items: [
    { label: "Inspección visual de equipos principales", checked: true, priority: "high" },
    { label: "Verificación de protocolos de emergencia", checked: true, priority: "high" },
    { label: "Revisión de permisos de trabajo en altura", checked: false, priority: "high", description: "Pendiente aprobación supervisor" },
    { label: "Calibración de sensores de gas", checked: true, priority: "medium" },
    { label: "Actualización de señalética", checked: false, priority: "low" },
    { label: "Registro de capacitaciones del mes", checked: false, priority: "medium", description: "Faltan 3 registros" },
  ],
});

const RANKING_MOCK = JSON.stringify({
  id: "rank_agentes", type: "ranking", title: "Top Agentes por Adopción — Q1 2026",
  items: [
    { label: "Agente Minero", value: 1834, unit: "usuarios", icon: "HardHat", color: "turquesa", change: 22 },
    { label: "Agente Legal", value: 1245, unit: "usuarios", icon: "Shield", color: "azul", change: 15 },
    { label: "Agente RRHH", value: 987, unit: "usuarios", icon: "Users", color: "naranja", change: -3 },
    { label: "Agente Finanzas", value: 756, unit: "usuarios", icon: "DollarSign", color: "verde-oscuro", change: 8 },
    { label: "Agente Mantenimiento", value: 543, unit: "usuarios", icon: "Wrench", change: 31 },
  ],
});

const RISK_MATRIX_MOCK = JSON.stringify({
  id: "risk_ops", type: "risk_matrix", title: "Matriz de Riesgo — Operaciones Q1",
  risks: [
    { label: "Falla SAG", likelihood: 2, impact: 5, description: "Parada no programada" },
    { label: "Derrame químico", likelihood: 1, impact: 5, description: "Impacto ambiental" },
    { label: "Caída red eléctrica", likelihood: 3, impact: 4, description: "Afecta producción" },
    { label: "Error en reporte", likelihood: 4, impact: 2, description: "Impacto regulatorio menor" },
    { label: "Rotación personal", likelihood: 4, impact: 3, description: "Pérdida de conocimiento" },
    { label: "Retraso proveedor", likelihood: 3, impact: 3, description: "Afecta cronograma" },
  ],
});

// ─── Page ────────────────────────────────────────────────────────────────────

export default function TestComponentsPage() {
  const kpiMessage = `Aquí están los indicadores clave de producción:\n\n\`\`\`kpi-component\n${KPI_MOCK}\n\`\`\``;
  const flowchartMessage = `Este es el flujo de aprobación de contratos:\n\n\`\`\`infographic-component\n${FLOWCHART_MOCK}\n\`\`\``;
  const timelineMessage = `Roadmap del proyecto:\n\n\`\`\`infographic-component\n${TIMELINE_MOCK}\n\`\`\``;
  const waterfallMessage = `Desglose financiero:\n\n\`\`\`chart-component\n${WATERFALL_MOCK}\n\`\`\``;
  const dashboardMessage = `\`\`\`dashboard-component\n${DASHBOARD_MOCK}\n\`\`\``;
  const comparisonMessage = `\`\`\`widget-component\n${COMPARISON_MOCK}\n\`\`\``;
  const swotMessage = `\`\`\`widget-component\n${SWOT_MOCK}\n\`\`\``;
  const checklistMessage = `\`\`\`widget-component\n${CHECKLIST_MOCK}\n\`\`\``;
  const rankingMessage = `\`\`\`widget-component\n${RANKING_MOCK}\n\`\`\``;
  const riskMessage = `\`\`\`widget-component\n${RISK_MATRIX_MOCK}\n\`\`\``;

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto space-y-10">
        <h1 className="text-2xl font-bold text-slate-800">Test: Componentes</h1>

        <section>
          <h2 className="text-lg font-semibold text-slate-700 mb-2 border-b pb-1">1. KPI Cards Standalone</h2>
          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <MarkdownMessage content={kpiMessage} messageId="test-kpi" />
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-700 mb-2 border-b pb-1">2. Flowchart (Diagrama de Flujo)</h2>
          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <MarkdownMessage content={flowchartMessage} messageId="test-flowchart" />
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-700 mb-2 border-b pb-1">3. Timeline (Línea de Tiempo)</h2>
          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <MarkdownMessage content={timelineMessage} messageId="test-timeline" />
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-700 mb-2 border-b pb-1">4. Waterfall (Cascada)</h2>
          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <MarkdownMessage content={waterfallMessage} messageId="test-waterfall" />
          </div>
        </section>

        <h1 className="text-2xl font-bold text-slate-800 pt-6">Dashboard</h1>

        <section>
          <h2 className="text-lg font-semibold text-slate-700 mb-2 border-b pb-1">5. Dashboard (KPI + Bar + Table)</h2>
          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <MarkdownMessage content={dashboardMessage} messageId="test-dashboard" />
          </div>
        </section>

        <h1 className="text-2xl font-bold text-slate-800 pt-6">Widgets Interactivos</h1>

        <section>
          <h2 className="text-lg font-semibold text-slate-700 mb-2 border-b pb-1">6. Comparison (Comparación)</h2>
          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <MarkdownMessage content={comparisonMessage} messageId="test-comparison" />
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-700 mb-2 border-b pb-1">7. SWOT (Análisis FODA)</h2>
          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <MarkdownMessage content={swotMessage} messageId="test-swot" />
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-700 mb-2 border-b pb-1">8. Ranking</h2>
          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <MarkdownMessage content={rankingMessage} messageId="test-ranking" />
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-700 mb-2 border-b pb-1">9. Checklist</h2>
          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <MarkdownMessage content={checklistMessage} messageId="test-checklist" />
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-700 mb-2 border-b pb-1">10. Risk Matrix (Matriz de Riesgo)</h2>
          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <MarkdownMessage content={riskMessage} messageId="test-risk" />
          </div>
        </section>
      </div>
    </div>
  );
}
