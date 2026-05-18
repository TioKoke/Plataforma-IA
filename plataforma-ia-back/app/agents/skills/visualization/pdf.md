# Skill — PDF corporativo Plataforma IA

Úsalo cuando el usuario pide un **entregable descargable**: "informe PDF",
"reporte ejecutivo", "memo", "acta de reunión", "minuta", "cotización",
"orden de trabajo", "carta", "oficio", "datasheet". El backend tiene branding
Plataforma IA (portada naranja/azul, encabezados, pies repetidos, numeración).

## Cuándo NO usar PDF

- Si el usuario quiere un tablero interactivo → `generate_dashboard_data`.
- Si quiere sólo los datos tabulados para manipular → `generate_excel_report`.
- Si quiere un gráfico único → `generate_chart_data` (el PDF no reemplaza un chart en la UI).
- Si la respuesta son 2-3 párrafos informativos → texto plano, no PDF.

## Elección de tool

| Caso | Tool |
|---|---|
| 95% de los casos (informe, memo, acta, cotización) | `generate_pdf_report(spec)` |
| Layout muy custom que no encaja en el schema | `export_html_to_pdf(html, filename, title)` |

Prefiere siempre `generate_pdf_report` — el schema cubre portada, KPIs, secciones,
tablas y bullets. Reserva `export_html_to_pdf` para casos genuinamente raros
(p.ej. un certificado con sellos, una factura con layout fiscal específico).

## Schema del `spec` (PDFReportSpec)

```
filename    string   obligatorio, termina en ".pdf"
title       string   obligatorio, ≤200 chars
subtitle    string?  ≤300 chars
author      string?  ≤120 chars
division    string?  ≤80 chars (Norte, RT, Andina, Salvador, Ventanas, El Teniente, …)
date        string?  libre (ej. "2026-Q1" o "20 abril 2026")
sections[]  ≥1, ≤40
  heading     string?
  body        string?  texto del párrafo
  bullets     string[]?
  kpis        PDFKpi[]?    (≤8)
      label (obl), value (obl), trend ("up"|"down"|"flat")?, caption?
  table       PDFTable?
      headers string[]  (1-12)
      rows    string[][] (≤200)
      caption string?
  page_break  bool (default false) — fuerza salto de página ANTES de la sección
```

## Paleta Plataforma IA

- **Portada**: naranja `#F58020` + azul marino `#002D5A`.
- **Tablas**: encabezado azul `#0072B1` sobre blanco.
- **KPIs por semántica**:
  - Cumplimiento / positivo → `#2EC4B6` (verde-oscuro)
  - Alerta / por debajo de meta → `#F4A261` (naranja)
  - Riesgo / negativo → `#E76F51` (rojo)
  - Neutral / informativo → `#0072B1` (azul)

No especificás colores en el `spec` — el CSS los aplica automáticamente.
Tu trabajo es elegir el `trend` correcto ("up" vs "down" vs "flat"): una flecha
"up" sobre un KPI de costo se ve como algo malo (porque es malo que suba), pero
sobre producción se ve como bueno — no uses `trend` si el sentido es ambiguo.

## Plantillas típicas

### Informe ejecutivo
Portada + 1ª sección "Resumen" (body + 3-6 KPIs) + 2-3 secciones analíticas
con tablas + sección final "Conclusiones" con bullets.

### Memo corporativo
1 sección: heading + body de 1-2 párrafos + bullets de acción. Sin KPIs, sin tabla.

### Acta de reunión
- Sección 1: "Asistentes" (bullets con nombres/cargos)
- Sección 2+: "Tema N" (heading + body con la discusión)
- Sección final: "Acuerdos" (bullets con `[Responsable] — acción — fecha`)

### Cotización / Orden de trabajo
Sección única con tabla de ítems (columnas típicas: ítem, descripción, cantidad,
unit, subtotal) + KPIs de totales (subtotal, IVA, total).

## Reglas duras

1. **`filename` obligatorio** y termina en `.pdf` — regex `^[\w\-. ]+\.pdf$`.
2. **Mínimo 1 sección**. Si no hay nada que decir, no generés PDF.
3. **Máximo 200 filas por tabla**. Si hay más, entregá también un Excel con
   `generate_excel_report` y en el PDF deja los totales + nota "Ver Excel anexo".
4. **Máximo 12 columnas por tabla**. Si hay más, pivoteá o dividilo en dos tablas
   en secciones distintas.
5. **No meter HTML en `body`**. El builder escapa HTML por seguridad (Jinja2
   autoescape) — el tag literal aparecerá como texto. Si necesitás formato rico,
   usá `export_html_to_pdf`.
6. **Actúa inmediatamente**. No pidas confirmación tipo "¿querés que lo genere?".
   Llamá la tool, entregá el chip de descarga, y en el mensaje usá 1-2 frases.

## Ejemplo realista Plataforma IA

Usuario: *"genera un informe PDF Q1 con los 3 KPIs de producción y una tabla por división"*

Llamada a `generate_pdf_report`:

```json
{
  "spec": {
    "filename": "informe-produccion-q1-2026.pdf",
    "title": "Informe ejecutivo — Producción Q1 2026",
    "subtitle": "Cobre fino por división",
    "author": "Plataforma IA Plataforma IA",
    "date": "Abril 2026",
    "sections": [
      {
        "heading": "Resumen",
        "body": "La producción de cobre fino del Q1 2026 superó el plan en 2,3 %, impulsada por el repunte de El Teniente y Chuquicamata tras el mantenimiento mayor de Q4 2025.",
        "kpis": [
          {"label": "Cu fino total", "value": "990 kt", "trend": "up", "caption": "+2,3 % vs plan"},
          {"label": "Costo C1 promedio", "value": "1,72 USD/lb", "trend": "down", "caption": "-0,08 vs Q4"},
          {"label": "LTIFR", "value": "1,8", "trend": "down", "caption": "Meta 2026: 2,0"}
        ]
      },
      {
        "heading": "Detalle por división",
        "table": {
          "headers": ["División", "Real (kt)", "Plan (kt)", "Desvío"],
          "rows": [
            ["Chuquicamata", "320", "340", "-5,9 %"],
            ["El Teniente",  "410", "400", "+2,5 %"],
            ["Radomiro Tomic", "260", "270", "-3,7 %"]
          ],
          "caption": "Producción Cu fino YTD (cierre marzo 2026)"
        }
      },
      {
        "heading": "Conclusiones",
        "bullets": [
          "RT sigue por debajo por escasez de mineral — reevaluar plan de alimentación.",
          "Costo C1 mejora pero aún por encima de la meta anual (1,65 USD/lb).",
          "Seguridad: mantener foco en zonas de tronadura (El Teniente)."
        ]
      }
    ]
  }
}
```

Tras la tool, tu respuesta al usuario: *"Listo el informe Q1 con producción por división y KPIs ejecutivos."* (1 frase, el chip de descarga se muestra solo — no pegues JSON ni resumas la tabla).
