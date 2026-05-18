"""Heurísticas de inferencia: cuando el agente no especifica, decidimos por él.

- ``infer_report_type``: clasifica el shape de los datos en uno de los report_type.
- ``infer_totals``: marca columnas numéricas para SUM por defecto.
- ``infer_conditional_formats``: pinta data_bar / 3_color_scale donde aporta.
- ``infer_chart``: recomienda chart bar/line/pie según ejes disponibles.
- ``infer_kpis_from_rows``: extrae 3-6 KPIs agregados para hoja Resumen.
"""
from __future__ import annotations

from statistics import mean, pstdev
from typing import Any

from app.agents.excel.schema import ChartSpec, ColumnSpec, KPISpec

NUMERIC_TYPES = {"number", "integer", "currency", "percent"}
DATE_TYPES = {"date"}


def _is_numeric(col: ColumnSpec) -> bool:
    return col.type in NUMERIC_TYPES


def _is_date(col: ColumnSpec) -> bool:
    return col.type in DATE_TYPES


def _is_categorical(col: ColumnSpec) -> bool:
    return col.type == "text"


def infer_report_type(rows: list[dict[str, Any]], columns: list[ColumnSpec]) -> str:
    """Clasifica el shape: timeseries / ranking / comparison / data_table."""
    if not rows or not columns:
        return "data_table"

    cats = [c for c in columns if _is_categorical(c)]
    nums = [c for c in columns if _is_numeric(c)]
    dates = [c for c in columns if _is_date(c)]
    n = len(rows)

    if dates and nums:
        return "timeseries"
    if len(cats) >= 1 and len(nums) >= 1 and n <= 30 and len(columns) <= 4:
        return "ranking"
    if len(cats) >= 2 and len(nums) >= 1:
        return "comparison"
    return "data_table"


def infer_totals(columns: list[ColumnSpec]) -> dict[str, str]:
    """Suma todas las numéricas por default."""
    return {c.key: "sum" for c in columns if _is_numeric(c)}


def _values_for(rows: list[dict[str, Any]], key: str) -> list[float]:
    out: list[float] = []
    for r in rows:
        v = r.get(key)
        if v is None or isinstance(v, bool):
            continue
        try:
            out.append(float(v))
        except (TypeError, ValueError):
            continue
    return out


def infer_conditional_formats(
    rows: list[dict[str, Any]], columns: list[ColumnSpec]
) -> dict[str, str]:
    """data_bar a la métrica de mayor coeficiente de variación; 3_color_scale a otra."""
    nums = [c for c in columns if _is_numeric(c)]
    if not nums or not rows:
        return {}

    cv: list[tuple[ColumnSpec, float]] = []
    for col in nums:
        vals = _values_for(rows, col.key)
        if len(vals) < 2:
            continue
        avg = mean(vals)
        if avg == 0:
            continue
        cv.append((col, pstdev(vals) / abs(avg)))

    if not cv:
        return {}

    cv.sort(key=lambda x: x[1], reverse=True)
    out: dict[str, str] = {cv[0][0].key: "data_bar"}
    if len(cv) >= 2:
        out[cv[1][0].key] = "3_color_scale"
    return out


def infer_chart(
    rows: list[dict[str, Any]],
    columns: list[ColumnSpec],
    report_type: str,
) -> ChartSpec | None:
    """Sugerir chart según report_type + shape."""
    if not rows or len(rows) < 2:
        return None

    cats = [c for c in columns if _is_categorical(c)]
    nums = [c for c in columns if _is_numeric(c)]
    dates = [c for c in columns if _is_date(c)]

    if report_type == "timeseries" and dates and nums:
        x = dates[0].key
        ys = [n.key for n in nums[:3]]
        return ChartSpec(type="line", title="Evolución temporal", x_column=x, y_columns=ys)

    if report_type == "ranking" and cats and nums:
        return ChartSpec(
            type="bar",
            title=f"Ranking por {nums[0].header}",
            x_column=cats[0].key,
            y_columns=[nums[0].key],
        )

    if report_type == "comparison" and len(cats) >= 1 and nums:
        return ChartSpec(
            type="column",
            title=f"Comparación de {nums[0].header}",
            x_column=cats[0].key,
            y_columns=[n.key for n in nums[:3]],
        )

    if report_type == "kpi_dashboard" and cats and nums and len(rows) <= 12:
        return ChartSpec(
            type="column",
            title=nums[0].header,
            x_column=cats[0].key,
            y_columns=[nums[0].key],
        )

    return None


def infer_sparklines(
    rows: list[dict[str, Any]], columns: list[ColumnSpec]
) -> dict[str, list[str]] | None:
    """Para timeseries: sparkline por fila usando todas las métricas.

    Devuelve nombres por *header* (que es como polars referencia las columnas
    en el DataFrame que arma el builder).
    """
    nums = [c for c in columns if _is_numeric(c)]
    if len(nums) < 3:
        return None
    return {"Tendencia": [c.header for c in nums]}


def infer_kpis_from_rows(
    rows: list[dict[str, Any]], columns: list[ColumnSpec], max_kpis: int = 4
) -> list[KPISpec]:
    """Crea KPIs agregados (SUM/AVG) sobre las numéricas más relevantes."""
    nums = [c for c in columns if _is_numeric(c)]
    if not nums or not rows:
        return []

    kpis: list[KPISpec] = []
    for col in nums[:max_kpis]:
        vals = _values_for(rows, col.key)
        if not vals:
            continue
        if col.type == "percent":
            agg = mean(vals)
            label = f"{col.header} promedio"
        else:
            agg = sum(vals)
            label = f"{col.header} total"
        kpis.append(KPISpec(label=label, value=agg, format=col.type, color="blue"))
    return kpis
