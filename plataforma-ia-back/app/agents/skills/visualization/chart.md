# Skill — Gráficos (Chart)

Úsalo cuando el usuario pide "gráfico", "barras", "línea", "torta/pie", "área",
"radar", "funnel", "waterfall" o un tipo específico de chart.

## Cómo elegir el subtipo

- **bar** — comparar categorías discretas (producción por división, ventas por mes).
- **line / area** — tendencia temporal continua (cobre día a día).
- **stacked_bar / stacked_area** — descomposición de un total en el tiempo.
- **pie / donut** — proporción sobre un total, ≤6 categorías. Usa donut si hay un
  KPI central que mostrar.
- **radar** — comparar un mismo sujeto en múltiples dimensiones (KPIs de seguridad
  por mina, scorecards).
- **treemap** — jerarquía con valores numéricos (costo por división → por área).
- **funnel** — pipeline con decaimiento (prospecto → contrato).
- **waterfall** — cómo un valor inicial llega a uno final (EBITDA bridge).

## Paleta Plataforma IA (usa estos colores en orden)

- `#0072B1` (azul) — serie principal, valores reales.
- `#F4A261` (naranja) — serie secundaria, planificado/presupuesto.
- `#00B4D8` (turquesa) — tercera serie / YoY.
- `#2EC4B6` (verde-oscuro) — positivo / cumplimiento.
- `#E76F51` (rojo) — negativo / desvío.
- `#A8DADC` (amarillo claro) — relleno de fondo, referencia.

## Checklist antes de emitir

1. `x_key` y cada `y_keys[].key` deben existir en cada fila de `data`.
2. `data` tiene ≥2 puntos (si solo hay 1, usa un KPI).
3. `title` en español, conciso (≤50 chars), sin emojis.
4. Si hay filtro temporal, usa `filters` con `type: radio` y `default` válido.
5. `selectable: true` si el click debe enviar un mensaje al chat; setea
   `on_click_message`.

## Ejemplo realista Plataforma IA

```json
{
  "id": "produccion_cobre_2026",
  "type": "bar",
  "title": "Producción de cobre fino por división (2026 YTD)",
  "x_key": "division",
  "y_keys": [
    {"key": "real", "label": "Real", "color": "#0072B1", "unit": "kt"},
    {"key": "plan", "label": "Plan", "color": "#F4A261", "unit": "kt"}
  ],
  "data": [
    {"division": "Chuquicamata", "real": 320, "plan": 340},
    {"division": "El Teniente", "real": 410, "plan": 400},
    {"division": "Radomiro Tomic", "real": 260, "plan": 270}
  ]
}
```
