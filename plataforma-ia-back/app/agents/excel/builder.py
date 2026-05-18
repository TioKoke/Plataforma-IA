"""Constructor de reportes Excel corporativos.

Engine principal: ``polars.DataFrame.write_excel`` (devuelve la tabla con
banded rows nativo, autofilter, autofit y formatos condicionales). xlsxwriter
manual sólo para portada, hoja Resumen, títulos y charts.
"""
from __future__ import annotations

import logging
from datetime import date, datetime
from io import BytesIO
from typing import Any, Optional

import polars as pl
import xlsxwriter

from app.agents.excel.auto_style import (
    infer_chart,
    infer_conditional_formats,
    infer_kpis_from_rows,
    infer_report_type,
    infer_sparklines,
    infer_totals,
)
from app.agents.excel.charts import insert_chart
from app.agents.excel.cover import build_cover_sheet, build_summary_sheet
from app.agents.excel.presets import get_preset_defaults
from app.agents.excel.sanitize import sanitize_cell
from app.agents.excel.schema import (
    ColumnSpec,
    ExcelReportSpec,
    SheetSpec,
    SummarySheetSpec,
)
from app.agents.excel.theme import build_formats, footer_string, get_preset

logger = logging.getLogger(__name__)

LARGE_ROWS_THRESHOLD = 50_000

POLARS_DTYPE_FOR_TYPE = {
    "text": pl.Utf8,
    "number": pl.Float64,
    "integer": pl.Int64,
    "currency": pl.Float64,
    "percent": pl.Float64,
    "date": pl.Datetime,
}


def build_excel_report(spec: ExcelReportSpec) -> bytes:
    """Genera un .xlsx en memoria a partir de una spec declarativa."""
    spec = _apply_report_type_defaults(spec)

    buffer = BytesIO()
    max_rows = max((len(s.rows) for s in spec.sheets), default=0)
    use_streaming = max_rows > LARGE_ROWS_THRESHOLD

    wb_options: dict[str, Any] = {
        "in_memory": True,
        "default_date_format": "dd-mmm-yyyy",
        "strings_to_formulas": False,
        "strings_to_urls": False,
    }
    if use_streaming:
        wb_options["constant_memory"] = True

    workbook = xlsxwriter.Workbook(buffer, wb_options)
    formats = build_formats(workbook, spec.style_preset)

    if spec.cover_sheet:
        build_cover_sheet(
            workbook, formats,
            title=spec.sheets[0].title or spec.filename.replace(".xlsx", ""),
            subtitle=spec.sheets[0].subtitle,
            author=spec.author,
            division=spec.division,
        )

    for sheet_spec in spec.sheets:
        _render_sheet(
            workbook, formats, sheet_spec,
            global_preset=spec.style_preset,
            author=spec.author,
            streaming=use_streaming,
        )

    if spec.summary_sheet:
        summary = _ensure_summary(spec.summary_sheet, spec.sheets[0])
        build_summary_sheet(workbook, formats, summary)

    workbook.set_properties({
        "title": spec.sheets[0].title or spec.filename,
        "author": spec.author or "Plataforma IA",
        "company": "Plataforma IA",
        "category": spec.division or "",
        "comments": "Generado por Plataforma IA",
    })

    workbook.close()
    return buffer.getvalue()


def _apply_report_type_defaults(spec: ExcelReportSpec) -> ExcelReportSpec:
    """Inferir report_type si era 'auto'; aplicar defaults del preset elegido."""
    rt = spec.report_type
    if rt == "auto" and spec.sheets:
        rt = infer_report_type(spec.sheets[0].rows, spec.sheets[0].columns)

    defaults = get_preset_defaults(rt)
    spec.report_type = rt

    if defaults.get("cover_sheet") and not spec.cover_sheet:
        spec.cover_sheet = True
    if defaults.get("style_preset") and spec.style_preset == "modern_orange":
        spec.style_preset = defaults["style_preset"]

    if defaults.get("include_summary") and spec.summary_sheet is None and spec.sheets:
        first = spec.sheets[0]
        spec.summary_sheet = SummarySheetSpec(
            kpis=infer_kpis_from_rows(first.rows, first.columns),
            chart=infer_chart(first.rows, first.columns, rt),
        )

    for sheet in spec.sheets:
        if sheet.totals == "auto" and defaults.get("totals") is None:
            sheet.totals = None
        if sheet.conditional_formats == "auto" and defaults.get("conditional_formats") is None:
            sheet.conditional_formats = None
        if defaults.get("auto_chart_type") and sheet.chart is None:
            inferred = infer_chart(sheet.rows, sheet.columns, rt)
            if inferred is not None:
                inferred.type = defaults["auto_chart_type"]
                sheet.chart = inferred
        if defaults.get("auto_sparklines") and sheet.sparklines is None:
            sheet.sparklines = infer_sparklines(sheet.rows, sheet.columns)
        if defaults.get("force_currency"):
            for col in sheet.columns:
                if col.type == "number":
                    col.type = "currency"
        if defaults.get("sort_desc_first_metric"):
            metrics = [c for c in sheet.columns if c.type in {"number", "integer", "currency", "percent"}]
            if metrics and sheet.rows:
                key = metrics[0].key
                sheet.rows = sorted(
                    sheet.rows,
                    key=lambda r: (r.get(key) is None, r.get(key) or 0),
                    reverse=True,
                )

    return spec


def _ensure_summary(summary: SummarySheetSpec, source_sheet: SheetSpec) -> SummarySheetSpec:
    """Si la summary no tiene KPIs, inferirlos del primer sheet."""
    if not summary.kpis:
        summary.kpis = infer_kpis_from_rows(source_sheet.rows, source_sheet.columns)
    return summary


def _render_sheet(
    workbook: xlsxwriter.Workbook,
    formats: dict,
    sheet_spec: SheetSpec,
    *,
    global_preset: str,
    author: str | None,
    streaming: bool,
) -> None:
    preset_name = sheet_spec.style_preset or global_preset
    preset = get_preset(preset_name)

    df = _build_dataframe(sheet_spec)
    if df.is_empty():
        ws = workbook.add_worksheet(sheet_spec.name[:31])
        ws.write(0, 0, "(sin datos)")
        ws.set_footer(footer_string(author))
        return

    ws = workbook.add_worksheet(sheet_spec.name[:31])
    ws.set_tab_color(preset["accent_color"])
    ws.hide_gridlines(2)
    ws.set_footer(footer_string(author))

    title_rows = 0
    if sheet_spec.title:
        ws.set_row(title_rows, 28)
        ws.merge_range(
            title_rows, 0, title_rows, max(0, len(df.columns) - 1),
            sheet_spec.title, formats["title"],
        )
        title_rows += 1
    if sheet_spec.subtitle:
        ws.set_row(title_rows, 22)
        ws.merge_range(
            title_rows, 0, title_rows, max(0, len(df.columns) - 1),
            sheet_spec.subtitle, formats["subtitle"],
        )
        title_rows += 1

    table_first_row = title_rows + (1 if title_rows else 0)
    if table_first_row > 0 and not (sheet_spec.title or sheet_spec.subtitle):
        table_first_row = 0
    if title_rows == 0:
        table_first_row = 0

    column_formats = _build_column_formats(sheet_spec.columns, preset)
    totals = _resolve_totals(sheet_spec, streaming)
    cond_formats = _resolve_conditional_formats(sheet_spec, df, streaming)
    sparklines = _resolve_sparklines(sheet_spec, df, streaming)

    write_kwargs: dict[str, Any] = {
        "workbook": workbook,
        "worksheet": ws,
        "position": (table_first_row, 0),
        "table_style": preset["table_style"],
        "header_format": preset["header_format"],
        "column_formats": column_formats,
        "autofilter": True,
        "autofit": True,
        "include_header": True,
        "hide_gridlines": True,
    }
    if totals:
        write_kwargs["column_totals"] = totals
    if cond_formats:
        write_kwargs["conditional_formats"] = cond_formats
    if sparklines:
        write_kwargs["sparklines"] = sparklines
    if sheet_spec.freeze_header:
        write_kwargs["freeze_panes"] = (table_first_row + 1, 0)

    df.write_excel(**write_kwargs)

    data_last_row = table_first_row + df.height
    if sheet_spec.chart and not streaming:
        try:
            chart_for_render = sheet_spec.chart.model_copy(update={
                "x_column": _header_for_key(sheet_spec, sheet_spec.chart.x_column),
                "y_columns": [
                    _header_for_key(sheet_spec, y) for y in sheet_spec.chart.y_columns
                ],
            })
            insert_chart(
                workbook, ws, chart_for_render,
                sheet_name=sheet_spec.name[:31],
                data_columns=list(df.columns),
                data_first_row=table_first_row,
                data_last_row=data_last_row,
                data_first_col=0,
            )
        except Exception as exc:
            logger.warning("insert_chart falló: %s", exc)


def _build_dataframe(sheet_spec: SheetSpec) -> pl.DataFrame:
    """Construye DataFrame respetando ColumnSpec.type → dtype polars."""
    if not sheet_spec.rows:
        return pl.DataFrame({c.header: [] for c in sheet_spec.columns})

    data: dict[str, list[Any]] = {}
    schema: dict[str, Any] = {}
    for col in sheet_spec.columns:
        col_values = [row.get(col.key) for row in sheet_spec.rows]
        coerced = [_coerce_value(v, col.type) for v in col_values]
        data[col.header] = coerced
        schema[col.header] = POLARS_DTYPE_FOR_TYPE.get(col.type, pl.Utf8)

    try:
        return pl.DataFrame(data, schema=schema, strict=False)
    except Exception as exc:
        logger.warning("DataFrame strict schema falló (%s); usando inferencia", exc)
        return pl.DataFrame(data)


def _coerce_value(value: Any, col_type: str) -> Any:
    if value is None or value == "":
        return None
    if col_type in {"number", "currency", "integer", "percent"}:
        if isinstance(value, bool):
            return int(value)
        if isinstance(value, (int, float)):
            if col_type == "percent" and isinstance(value, str) and "%" in value:
                return float(value.replace("%", "")) / 100.0
            return value
        if isinstance(value, str):
            cleaned = value.strip().replace(",", "")
            had_pct = "%" in cleaned
            cleaned = cleaned.replace("%", "")
            if not cleaned:
                return None
            try:
                num = float(cleaned)
                if col_type == "percent" and had_pct:
                    num /= 100.0
                if col_type == "integer":
                    return int(num)
                return num
            except ValueError:
                return None
    if col_type == "date":
        if isinstance(value, datetime):
            return value
        if isinstance(value, date):
            return datetime(value.year, value.month, value.day)
        if isinstance(value, str):
            for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S",
                        "%d-%m-%Y", "%d/%m/%Y"):
                try:
                    return datetime.strptime(value, fmt)
                except ValueError:
                    continue
            return None
    if isinstance(value, str):
        return sanitize_cell(value)
    return value


def _build_column_formats(columns: list[ColumnSpec], preset: dict) -> dict[str, str]:
    out: dict[str, str] = {}
    dtype_fmts = preset.get("dtype_formats", {})
    for col in columns:
        if col.number_format:
            out[col.header] = col.number_format
        elif col.type in dtype_fmts:
            out[col.header] = dtype_fmts[col.type]
    return out


def _resolve_totals(sheet_spec: SheetSpec, streaming: bool) -> Optional[dict[str, str]]:
    if streaming:
        return None
    totals = sheet_spec.totals
    if totals is None:
        return None
    if totals == "auto":
        inferred = infer_totals(sheet_spec.columns)
        return {_header_for_key(sheet_spec, k): v for k, v in inferred.items()} or None
    return {_header_for_key(sheet_spec, k): v for k, v in totals.items()}


def _resolve_conditional_formats(
    sheet_spec: SheetSpec, df: pl.DataFrame, streaming: bool
) -> Optional[dict[str, str]]:
    if streaming:
        return None
    cf = sheet_spec.conditional_formats
    if cf is None:
        return None
    if cf == "auto":
        inferred = infer_conditional_formats(sheet_spec.rows, sheet_spec.columns)
        out = {_header_for_key(sheet_spec, k): v for k, v in inferred.items()}
        return out or None
    return {_header_for_key(sheet_spec, k): v for k, v in cf.items()}


def _header_for_key(sheet_spec: SheetSpec, key: str) -> str:
    for col in sheet_spec.columns:
        if col.key == key:
            return col.header
    return key


def _resolve_sparklines(
    sheet_spec: SheetSpec, df: pl.DataFrame, streaming: bool
) -> Optional[dict[str, list[str]]]:
    """Remap user-provided sparklines de keys → headers; descarta el target si
    ya existe en el DataFrame (polars exige inyectarlo como columna nueva)."""
    if streaming or not sheet_spec.sparklines:
        return None
    out: dict[str, list[str]] = {}
    for target, sources in sheet_spec.sparklines.items():
        target_header = _header_for_key(sheet_spec, target)
        if target_header in df.columns:
            continue
        mapped_sources = [_header_for_key(sheet_spec, s) for s in sources]
        valid_sources = [s for s in mapped_sources if s in df.columns]
        if not valid_sources:
            continue
        out[target_header] = valid_sources
    return out or None


def infer_spec_from_rows(
    rows: list[dict[str, Any]],
    filename: str,
    sheet_name: str = "Datos",
    author: str | None = None,
    division: str | None = None,
    title: str | None = None,
) -> ExcelReportSpec:
    """Construye una spec mínima inferida a partir de una lista de dicts.

    Usada por save_to_excel / append_to_excel para preservar retrocompatibilidad
    mientras se aprovecha el branding del builder.
    """
    keys: list[str] = []
    for row in rows:
        for key in row.keys():
            if key not in keys:
                keys.append(key)

    columns = [
        ColumnSpec(header=str(key), key=str(key), type=_infer_type(rows, key))
        for key in keys
    ] or [ColumnSpec(header="Datos", key="Datos", type="text")]

    return ExcelReportSpec(
        filename=filename,
        sheets=[SheetSpec(
            name=sheet_name[:31] or "Datos",
            columns=columns,
            rows=rows,
            title=title,
        )],
        author=author,
        division=division,
    )


def _infer_type(rows: list[dict[str, Any]], key: str) -> str:
    numeric_hits = 0
    date_hits = 0
    total = 0
    for row in rows:
        value = row.get(key)
        if value is None or value == "":
            continue
        total += 1
        if isinstance(value, bool):
            continue
        if isinstance(value, (int, float)):
            numeric_hits += 1
            continue
        if isinstance(value, (datetime, date)):
            date_hits += 1
            continue
        if isinstance(value, str):
            for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S",
                        "%d-%m-%Y", "%d/%m/%Y"):
                try:
                    datetime.strptime(value, fmt)
                    date_hits += 1
                    break
                except ValueError:
                    continue
            else:
                cleaned = value.strip().replace(",", "").replace("%", "")
                try:
                    float(cleaned)
                    numeric_hits += 1
                except ValueError:
                    pass

    if total == 0:
        return "text"
    if date_hits / total > 0.7:
        return "date"
    if numeric_hits / total > 0.7:
        return "number"
    return "text"
