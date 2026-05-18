# Skill — Widgets especializados

Úsalo cuando el usuario pide: **FODA/SWOT, Kanban, Gauge/medidor, Matriz de
riesgo, Checklist, Ranking/Top N, Comparación lado-a-lado, Accordion/FAQ,
Stepper/pasos**.

## Tabla: pista del usuario → `widget_type`

| Pista en el mensaje | widget_type |
|---|---|
| "FODA", "SWOT", "fortalezas y debilidades" | `swot` |
| "kanban", "tablero de tareas", "backlog visual" | `kanban` |
| "gauge", "medidor", "velocímetro", "indicador circular" | `gauge` |
| "matriz de riesgo", "riesgos", "probabilidad e impacto" | `risk_matrix` |
| "checklist", "lista de chequeo", "pendientes" | `checklist` |
| "ranking", "top N", "mejores/peores" | `ranking` |
| "comparar X vs Y", "opciones" | `comparison` |
| "FAQ", "acordeón", "secciones colapsables" | `accordion` |
| "pasos", "stepper", "wizard", "flujo secuencial" | `stepper` |

## Reglas por tipo

### swot
- 4 listas: `strengths`, `weaknesses`, `opportunities`, `threats`.
- Cada una 3–5 items, frases cortas (≤80 chars).

### kanban
- 2–4 columnas (típico: "Por hacer", "En curso", "Listo").
- Cada card: `title` obligatorio, `priority` opcional para color automático.

### gauge
- 1–3 gauges por widget.
- `min`/`max` obligatorios si no son 0–100.
- `target` para línea de meta.

### risk_matrix
- Cada riesgo con `likelihood: 1–5` e `impact: 1–5`. El frontend calcula la
  severidad (likelihood × impact) y pinta celdas.
- `color` opcional para override (p.ej. `#E76F51` en riesgo crítico).

### ranking
- Items ordenados del más alto al más bajo.
- `change` en % o valor absoluto (`+5`, `-12`).

### comparison
- 2–3 `options` (más de 3 se ve apretado).
- Todas las options deben tener el MISMO set de `features` (mismo label, distinto
  `value`).

### accordion
- 3–8 items. `defaultOpen: true` solo para el primero si corresponde.

### checklist
- Prioridades: `high` (rojo), `medium` (naranja), `low` (gris).

### stepper
- `status` por paso: `completed`, `active`, `pending`, `error`.
- Exactamente 1 paso en `active` (a menos que todo esté `completed`).

## Ejemplo — FODA Negocio Cobre

```json
{
  "widget_id": "foda_cobre_2026",
  "widget_type": "swot",
  "title": "FODA — Negocio Cobre 2026",
  "data": {
    "swot": {
      "strengths": ["Reservas minerales de largo plazo", "Operaciones integradas"],
      "weaknesses": ["Declinación de leyes de mineral", "Altos costos energéticos"],
      "opportunities": ["Demanda por electromovilidad", "Nuevos mercados asiáticos"],
      "threats": ["Volatilidad del precio", "Regulación ambiental"]
    }
  }
}
```

## Ejemplo — Risk Matrix

```json
{
  "widget_id": "riesgos_operacionales_q2",
  "widget_type": "risk_matrix",
  "title": "Riesgos operacionales — Q2 2026",
  "data": {
    "risks": [
      {"label": "Falla molino SAG", "likelihood": 3, "impact": 5,
       "description": "Parada no programada >48h"},
      {"label": "Paro sindical", "likelihood": 2, "impact": 4},
      {"label": "Corte eléctrico SING", "likelihood": 2, "impact": 5}
    ]
  }
}
```
