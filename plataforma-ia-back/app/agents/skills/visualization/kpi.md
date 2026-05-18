# Skill — KPI standalone

Úsalo cuando el usuario pide "KPI", "indicador", "métrica clave", "resumen de
cifras", "número de X". Ideal para 1–4 cifras con formato y tendencia.

## Cuándo NO usar KPI standalone

- Si hay 5+ métricas → usa `dashboard` con panels `type: kpi`.
- Si necesitas un gráfico/tabla además de las cifras → `dashboard`.
- Si la métrica principal es una tendencia temporal → usa `chart` de línea.

## Campos clave

- `format`: `"number" | "currency" | "percentage" | "compact"` — deja que el
  frontend formatee. No pre-formatees `value` como string si puedes usar `format`.
- `trend.direction`: `"up" | "down" | "flat"`. "up" no siempre es bueno (p.ej.
  costo subiendo) — usa `color` para desambiguar (rojo si subir es malo).
- `sparkline`: arreglo de 6–12 números para el mini-chart. Opcional pero muy útil
  visualmente.
- `target`: mostrar cumplimiento vs meta (`{value: 100, label: "Meta anual"}`).

## Paleta de color por naturaleza del KPI

- Cumplimiento o positivo → `#2EC4B6` (verde-oscuro)
- Alerta o por debajo de meta → `#F4A261` (naranja)
- Riesgo o negativo → `#E76F51` (rojo)
- Neutral / informativo → `#0072B1` (azul)

## Columnas recomendadas

- 1–2 cards: `columns: 2` (queda holgado)
- 3 cards: `columns: 3`
- 4 cards: `columns: 4`

## Ejemplo

```json
{
  "id": "kpi_seguridad_q1",
  "title": "Indicadores de Seguridad — Q1 2026",
  "columns": 3,
  "cards": [
    {
      "id": "ltifr",
      "label": "LTIFR",
      "value": 1.8,
      "format": "number",
      "trend": {"direction": "down", "value": "-0.4 vs Q4", "label": "Mejor"},
      "target": {"value": 2.0, "label": "Meta 2026"},
      "color": "#2EC4B6",
      "sparkline": [2.4, 2.3, 2.1, 2.0, 1.9, 1.8]
    },
    {
      "id": "dias_sin_accidentes",
      "label": "Días sin accidentes graves",
      "value": 87,
      "format": "number",
      "unit": "días",
      "color": "#0072B1"
    }
  ]
}
```
