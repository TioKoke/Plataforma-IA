# Skill — Infografía (flujo / diagrama)

Úsalo cuando el usuario pide "flujo", "diagrama", "mapa mental", "proceso",
"pasos", "organigrama", "timeline", "relación entre" o estructura lógica sin
datos cuantitativos.

## Subtipos

- **flowchart** — proceso con decisiones (A → B → ¿? → C/D). Dirección `LR` o `TB`.
- **mindmap** — 1 tema central, ramas hijas, ramas nietas. Dirección `LR`.
- **orgchart** — jerarquía de roles/áreas. Dirección `TB`.
- **timeline** — hitos secuenciales con fechas. Dirección `LR`.
- **conceptmap** — conceptos relacionados, no jerárquicos. Dirección libre.

## Nodos (`nodes`)

- `id` debe ser único y estable (usa snake_case).
- `category` pinta el color del nodo:
  - `start` — verde (inicio proceso)
  - `process` — azul (paso normal)
  - `decision` — amarillo (pregunta sí/no)
  - `end` — gris (fin)
  - `info` — turquesa (contexto)
  - `warning` — naranja/rojo (alerta)
- `icon` opcional — nombre de ícono Lucide (ej. `"GitBranch"`, `"Shield"`).

## Edges (`edges`)

- `source` y `target` deben apuntar a IDs de `nodes` existentes.
- `label` en decisiones: "Sí" / "No" / "OK" / "Error".
- `style: "dashed"` para flujos alternativos/excepcionales.

## Límites recomendados

- Flowchart: 5–15 nodos. Más que eso, parte en 2 infografías.
- Mindmap: 1 root + 4–8 hijos + 2–4 nietos por hijo.
- Timeline: 4–8 hitos.

## Ejemplo — Flowchart proceso de contratación

```json
{
  "id": "flujo_contratacion",
  "type": "flowchart",
  "title": "Proceso de contratación de contratistas",
  "direction": "LR",
  "nodes": [
    {"id": "inicio", "label": "Requerimiento", "category": "start"},
    {"id": "eval", "label": "Evaluación técnica", "category": "process"},
    {"id": "decision", "label": "¿Cumple?", "category": "decision"},
    {"id": "contrato", "label": "Firma contrato", "category": "process"},
    {"id": "fin", "label": "Incorporación", "category": "end"}
  ],
  "edges": [
    {"id": "e1", "source": "inicio", "target": "eval"},
    {"id": "e2", "source": "eval", "target": "decision"},
    {"id": "e3", "source": "decision", "target": "contrato", "label": "Sí"},
    {"id": "e4", "source": "decision", "target": "inicio", "label": "No", "style": "dashed"},
    {"id": "e5", "source": "contrato", "target": "fin"}
  ]
}
```
