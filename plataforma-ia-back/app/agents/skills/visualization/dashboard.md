# Skill — Dashboard

Úsalo cuando el usuario pide "dashboard", "tablero", "panel completo", "resumen
ejecutivo" o múltiples métricas en una sola vista.

## Decisión dashboard vs gráfico vs KPI

- **Dashboard** si hay **≥3 paneles** de distinta naturaleza (KPI + chart + tabla).
- **StandaloneKPI** si son 1–4 cifras sin comparativas temporales.
- **Chart solo** si es una sola visualización.

## Criterio de composición — data-driven

Cuando el usuario pide un dashboard con un dataset (Excel, tabla, o datos
embebidos en la conversación), **NO emitas un dashboard mono-tipo** (ej. 8
bar charts). Analiza las columnas y asigna cada relación a un tipo de panel
distinto, maximizando la variedad entre los tipos soportados:

**Charts disponibles:** `bar`, `line`, `pie`, `donut`, `area`, `stacked_area`,
`stacked_bar`, `radar`, `treemap`, `funnel`, `waterfall`, `table`. Más `kpi`.

### Mapa columna/relación → panel

| Qué hay en la data | Panel recomendado |
|---|---|
| Métrica agregada sin dimensión (total, promedio, ratio) | `kpi` con trend si hay periodo anterior |
| Categoría vs métrica (≤8 categorías) | `bar` (vertical) |
| Categoría vs métrica (>8 categorías, jerárquica o con tamaños muy distintos) | `treemap` |
| Proporciones que suman 100% (≤5 categorías) | `donut` o `pie` |
| Serie temporal (fecha/mes/semana vs métrica) | `line` o `area` |
| Serie temporal con ≥2 series que se acumulan | `stacked_area` |
| Comparación de 2–3 entidades en ≥4 atributos normalizados | `radar` |
| Etapas secuenciales con caída (pipeline, conversión, embudo) | `funnel` |
| Delta o descomposición (de X llegamos a Y por estos movimientos) | `waterfall` |
| Datos tabulares con 4+ columnas que el usuario querrá ver crudos | `table` |

### Receta recomendada (4–8 paneles)

1. **3 KPIs** con las métricas más importantes (total, variación vs periodo
   anterior, ratio clave). Cada uno `span: 1`.
2. **1 chart temporal** (`line` o `stacked_area`) con `span: 2` si hay fecha.
3. **1 chart categórico** (`bar` o `treemap`) con la dimensión principal.
4. **1 chart de composición** (`donut`, `pie` o `stacked_bar`) con proporciones.
5. **1 chart "exótico"** cuando la data lo permita (`radar` para benchmark,
   `funnel` para pipeline, `waterfall` para deltas).
6. **1 tabla** con el detalle crudo (top N filas).

**Regla dura:** el dashboard debe contener **≥4 tipos distintos** de panel.
Si terminas con puros `bar`, vuelve al mapa de arriba y reasigna.

### Si la data es pobre (pocas columnas)

Mejor emite un chart standalone o un `kpi-component` — no fuerces un
dashboard con paneles artificiales.

## Estructura recomendada

1. **Fila 1 (KPIs)** — 3–4 cards con `type: "kpi"`, `span: 1` cada una.
2. **Fila 2 (chart principal)** — `span: 2` o `3`, típicamente `bar` o `line`.
3. **Fila 3 (detalle)** — `table` o chart secundario.

## Layout

- `layout.columns` entre 3 y 4. Con 4 dejas espacio a KPIs de `span:1`.
- `panels[i].span` debe sumar ≤ `columns` por fila (el frontend hace el wrap).

## Filtros a nivel dashboard

Usa `filters` cuando múltiples paneles comparten la misma dimensión (ej. División,
Mes). Setea `applies_to` con los IDs de los panels que deben filtrarse.
Sin `applies_to` el filtro aplica a todos.

## Panels de tipo tabla

- `table_columns`: al menos 2 columnas.
- `data`: filas con claves idénticas a `table_columns[].key`.

## Pre-chequeos obligatorios (evita paneles vacíos)

Antes de pasar `panels` a `generate_dashboard_data`:

1. Si los datos vienen de `read_from_excel` / `read_from_csv`, copia las **claves literales** del primer row del resultado como `x_key`, como `y_keys[].key`, y como `table_columns[].key`. **No las traduzcas**: si la columna se llama `"Fecha"` con mayúscula usa `"Fecha"`, no `"fecha"`. Las claves son case-sensitive — si no coinciden, el panel llega vacío y el tool te rechaza con `error: "empty_panels"`.
2. `y_keys[].key` debe existir en cada row y contener valores numéricos. `inspect_excel` ya te dio `column_types` — úsalo para elegir columnas numéricas.
3. Si un row tiene `{"__truncated__": "..."}` descártalo — es un marker de compactación, no data real.
4. Si `read_from_excel` devolvió `data: []`, **NO emitas el dashboard**. Pide al usuario que confirme la hoja o los filtros (`inspect_excel` te muestra `recommended_sheet`).
5. Si el tool responde `error: "empty_panels"`, mira el mensaje — te lista las claves reales de `data[0]`. Corrige `x_key` / `table_columns[].key` y re-llama.

## Ejemplo mínimo

```json
{
  "id": "dashboard_produccion",
  "title": "Producción Cobre — Abril 2026",
  "layout": {"columns": 4},
  "filters": [
    {
      "id": "division",
      "label": "División",
      "type": "dropdown",
      "key_to_filter": "division",
      "options": [
        {"id": "all", "label": "Todas"},
        {"id": "chuqui", "label": "Chuquicamata"}
      ],
      "default": "all"
    }
  ],
  "panels": [
    {
      "id": "kpi_total",
      "type": "kpi",
      "title": "Cobre fino total",
      "span": 1,
      "kpi": {"value": 1280, "label": "kt YTD", "format": "number",
              "trend": {"direction": "up", "value": "+3.2%"}}
    },
    {
      "id": "chart_trend",
      "type": "line",
      "title": "Producción mensual",
      "span": 3,
      "x_key": "mes",
      "y_keys": [{"key": "real", "label": "Real", "color": "#0072B1"}],
      "data": [{"mes": "Ene", "real": 295}, {"mes": "Feb", "real": 310}]
    }
  ]
}
```

## Few-shot: Excel con múltiples hojas

**Input del usuario:** "Dashboard operacional Q1 con esta data (debe tener ≥4
tipos de panel distintos, no puros bars)" + Excel con hojas `ventas`,
`distribucion`, `embudo`, `desempeno`.

**Acción correcta:**

1. `inspect_excel` para listar hojas y columnas.
2. `read_from_excel` de cada hoja relevante (ventas, distribucion, embudo,
   desempeno) para traer los datos al contexto.
3. **UNA sola** llamada a `generate_dashboard_data` con `panels` que mezclan
   tipos distintos, por ejemplo:
   - `kpi` × 3 (total Q1, variación vs Q4, región top)
   - `line` para ventas mensuales Q1 (hoja `ventas`)
   - `pie` o `donut` para distribución de mercado (hoja `distribucion`)
   - `funnel` para el embudo de conversión (hoja `embudo`)
   - `bar` para desempeño regional (hoja `desempeno`)
   - `table` con el detalle crudo

Total: ≥6 paneles, ≥5 tipos distintos, **una sola tool call**.

**Acción incorrecta (lo que NO debes hacer):**

- Llamar `generate_chart_data` cuatro veces (una por hoja) y devolver 4
  secciones con headers `"1. Ventas"`, `"2. Distribución"`, etc. Eso renderiza
  charts sueltos en vez del componente dashboard integrado.
- Mezclar llamadas: primero un `generate_dashboard_data` con 2 paneles y
  después `generate_chart_data` para "completar". Todo va en el mismo
  dashboard spec.
