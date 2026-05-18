# Skill — Excel corporativo Plataforma IA

Úsalo cuando el usuario pide un **archivo Excel descargable** con datos
tabulares: "genera un excel", "exporta a xlsx", "dame los datos en planilla",
"reporte ejecutivo", "dashboard ejecutivo en Excel", "ranking top N",
"estado de resultados", "comparativo por división". El backend tiene branding
Plataforma IA (portada naranja/azul, bandas zebra visibles, autofit, headers
congelados, charts embebidos, KPI tiles).

## Regla dura — `generate_excel_report` es el default

**SIEMPRE** llamá `generate_excel_report(spec)` para output tabular
descargable. **PROHIBIDO** `save_to_excel` cuando el usuario pide reporte,
diseño, dashboard, ranking, comparativa, formato, portada, gráficos, KPIs o
cualquier archivo presentable.

`save_to_excel` **solo** sirve para un dump ultra-simple de 1 hoja sin
formato cuando el usuario lo pide explícitamente ("solo los datos crudos",
"no necesito diseño"). En el 95 % de los pedidos reales, **NO** es la
elección correcta.

## Cuándo NO usar Excel

- Si el usuario quiere un **documento presentable** (memo, acta, cotización)
  → `generate_pdf_report`.
- Si quiere un **tablero interactivo** en la UI → `generate_dashboard_data`.
- Si quiere un **gráfico único** embebido en la respuesta → `generate_chart_data`.
- Si son 3-5 filas que pueden mostrarse como tabla markdown en el chat →
  no generés archivo.

## Enrutamiento por `report_type`

Pasá el `report_type` correcto y el preset/estilo se infiere solo:

| Pide el usuario | report_type | Activa |
|---|---|---|
| "dashboard ejecutivo", "reporte ejecutivo", "indicadores Q1", "panorama mensual" | `kpi_dashboard` | Portada + Resumen con KPI tiles + preset executive |
| "reporte financiero", "estado de resultados", "balance" | `financial_report` | Preset financial, totales sum, currency CLP |
| "ranking", "top 10", "clasificación", "los más usados" | `ranking` | data_bar en métrica, sort desc |
| "comparar X vs Y", "comparación divisiones", "antes vs después" | `comparison` | 3_color_scale, preset corporate_navy |
| "evolución mensual", "tendencia anual", "serie temporal" | `timeseries` | Chart line auto, sparklines |
| "exporta este dataset", "dame los datos en Excel" sin contexto adicional | `data_table` o `auto` | Tabla limpia con autofit |
| Si dudas | `auto` | Heurística decide según shape |

## Schema del `spec` (ExcelReportSpec)

```
filename       string   obligatorio, termina en ".xlsx"
report_type    enum     kpi_dashboard | financial_report | ranking | comparison | timeseries | data_table | auto
author         string?  aparece en la portada
division       string?  Norte, RT, Andina, Salvador, Ventanas, El Teniente, …
cover_sheet    bool     default false — true para dashboards/reportes ejecutivos
style_preset   enum     modern_orange (default) | corporate_navy | financial | minimal_gray | executive
summary_sheet  object?  { name?, kpis[], notes? }
  kpis         ≤8       { label, value, delta?, format?, color? }
                        color: green | red | blue | neutral | orange
                        format: text | number | integer | date | currency | percent
sheets[]       ≥1
  name         string   ≤31 chars
  title        string?  título visible
  subtitle     string?
  columns[]    ≥1       { header, key (snake_case), type, width? }
                        type: text | number | integer | date | currency | percent
  rows[]       object[] claves = columns[].key
  table        bool     default true (auto-filtro)
  freeze_header bool    default true
  totals       "auto" | null | {key: "sum"|"average"|"count"|"max"|"min"|"std_dev"}
  conditional_formats "auto" | null | {key: "data_bar"|"3_color_scale"|"top_5"|"bottom_5"}
  chart        object?  { type, title?, x_column, y_columns[] }
                        type: bar | column | line | pie | doughnut | area | scatter
  sparklines   object?  {col_target: [col_source1, col_source2, ...]}
```

## Patrones típicos

### Dashboard ejecutivo (el caso más frecuente)
- `report_type: "kpi_dashboard"`
- `cover_sheet: true`
- `summary_sheet.kpis`: 3-6 KPIs con `value`, `delta`, `color`
- `sheets[0]`: detalle tabular con `chart` embebido

### Exportar catálogo de agentes / personas / activos
- `report_type: "data_table"` (o `auto`)
- Una hoja "Detalle" con `columns` tipadas
- `totals="auto"` para que sume/cuente solo
- Si el usuario pide "con el total" → `summary_sheet.kpis` con `label: "Total agentes"`

### Ranking / Top N
- `report_type: "ranking"`
- Ordenar rows desc por la métrica antes de pasarlas
- `conditional_formats: {metric_key: "data_bar"}`
- `chart: {type: "bar", x_column: "nombre", y_columns: ["metrica"]}`

### Comparativa
- `report_type: "comparison"`
- 2+ columnas numéricas para comparar
- `conditional_formats: "auto"` → 3_color_scale

## Paleta y formato automáticos

No definís colores ni anchos — el builder aplica `style_preset` + autofit.
Tu trabajo es:

1. Usar tipos correctos en `columns[].type`: `currency` para CLP/USD,
   `percent` para tasas, `date` para fechas, `integer` para conteos.
2. Nombres de `key` en snake_case corto. El `header` es el visible.
3. `summary_sheet.kpis[].color` semántico: `green` = positivo/meta cumplida,
   `red` = riesgo, `blue` = neutral/informativo, `orange` = alerta, `neutral`
   = sin juicio.

## Reglas duras

1. **`filename` obligatorio** y termina en `.xlsx`.
2. **Mínimo 1 hoja en `sheets[]`**.
3. **Para pedidos de "diseño" o "mejora" sobre un Excel previo**: genera un
   **nuevo** archivo con `generate_excel_report` (con `cover_sheet=true` y
   `report_type="kpi_dashboard"` si corresponde). **NO uses** `append_to_excel`
   — eso agrega filas al dump simple; no agrega diseño.
4. **Si el usuario pide "con el total" o "cuántos hay"**: añadí `summary_sheet`
   con 1-3 KPIs que resuman (total, promedio, % activos, etc.).
5. **Actúa inmediatamente**. No pidas confirmación tipo "¿querés que lo genere?".
   Llamá la tool, entregá el chip de descarga, y en el mensaje usá 1-2 frases.

## Ejemplo realista Plataforma IA

Usuario: *"Genera un excel con los datos de los agentes con diseño y el total"*

Llamada a `generate_excel_report`:

```json
{
  "spec": {
    "filename": "agentes-ia-plataforma-ia.xlsx",
    "report_type": "kpi_dashboard",
    "cover_sheet": true,
    "author": "Plataforma IA Plataforma IA",
    "style_preset": "executive",
    "summary_sheet": {
      "name": "Resumen",
      "kpis": [
        {"label": "Total agentes", "value": 24, "format": "integer", "color": "blue"},
        {"label": "Agentes activos", "value": 18, "format": "integer", "color": "green"},
        {"label": "En desarrollo", "value": 6, "format": "integer", "color": "orange"}
      ],
      "notes": "Catálogo de agentes IA desplegados en las divisiones Plataforma IA."
    },
    "sheets": [
      {
        "name": "Agentes",
        "title": "Catálogo de agentes IA",
        "columns": [
          {"header": "Nombre", "key": "nombre", "type": "text"},
          {"header": "Categoría", "key": "categoria", "type": "text"},
          {"header": "División", "key": "division", "type": "text"},
          {"header": "Estado", "key": "estado", "type": "text"},
          {"header": "Modelo", "key": "modelo", "type": "text"},
          {"header": "Caso de uso", "key": "caso_uso", "type": "text"}
        ],
        "rows": [
          {"nombre": "…", "categoria": "…", "division": "…", "estado": "Activo", "modelo": "…", "caso_uso": "…"}
        ],
        "chart": {
          "type": "column",
          "title": "Agentes por división",
          "x_column": "division",
          "y_columns": ["nombre"]
        }
      }
    ]
  }
}
```

Tras la tool, tu respuesta al usuario: *"Listo, generé el Excel ejecutivo con el catálogo completo, total de agentes y desglose por división."* (1 frase, el chip de descarga se muestra solo — no pegues JSON ni repitas la tabla en el chat).
