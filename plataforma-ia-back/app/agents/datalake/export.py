"""Exportar un dataset Parquet al formato pedido.

Soporta:
- ``xlsx`` con branding Plataforma IA (tabla, congelar, anchos auto, sanitización).
- ``csv`` y ``tsv`` con BOM UTF-8 y anti-injection.
- ``parquet`` (passthrough — el dataset ya está en Parquet).
- ``json`` (records, indentado).

Permite filtrar/transformar antes del export vía SQL (DuckDB) y subset/sort.
"""
from __future__ import annotations

import csv as csv_module
import io
import json
import logging
import re
from io import BytesIO, StringIO
from typing import Any, Iterable, Optional

import polars as pl

from app.agents.datalake.catalog import DatasetCatalog
from app.agents.datalake.query import _sanitize_sql, QueryRejectedError
from app.agents.excel import ColumnSpec, ExcelReportSpec, SheetSpec, build_excel_report
from app.agents.excel.sanitize import sanitize_cell
from app.services.storage_service import storage_service

logger = logging.getLogger(__name__)

SUPPORTED_FORMATS = {"xlsx", "csv", "tsv", "parquet", "json"}
_SAFE_FILENAME = re.compile(r"^[\w\-. ]{1,120}$")


def _safe_export_filename(name: str, default_ext: str) -> str:
    if not name:
        return f"export_{default_ext}.{default_ext}"
    base = name.strip()
    if not _SAFE_FILENAME.match(base):
        raise ValueError(f"filename inválido: {name!r}")
    if not base.lower().endswith(f".{default_ext}"):
        base = f"{base}.{default_ext}"
    return base


def _load_dataframe(conversation_id: str, dataset_id: str) -> pl.DataFrame:
    parquet_bytes = DatasetCatalog.get_data_bytes(conversation_id, dataset_id)
    return pl.read_parquet(BytesIO(parquet_bytes))


def _apply_transforms(
    df: pl.DataFrame,
    *,
    columns: Optional[list[str]],
    sort_by: Optional[str],
    descending: bool,
    filter_sql: Optional[str],
) -> pl.DataFrame:
    if filter_sql:
        try:
            clean = _sanitize_sql(filter_sql)
        except QueryRejectedError as exc:
            raise ValueError(f"filter_sql rechazado: {exc}") from exc
        # SQL frame-level vía polars' SQLContext.
        ctx = pl.SQLContext(dataset=df, eager=True)
        df = ctx.execute(f"SELECT * FROM ({clean}) AS _q")
    if columns:
        missing = [c for c in columns if c not in df.columns]
        if missing:
            raise ValueError(f"columnas inexistentes: {missing}")
        df = df.select(columns)
    if sort_by:
        if sort_by not in df.columns:
            raise ValueError(f"sort_by inexistente: {sort_by}")
        df = df.sort(sort_by, descending=descending)
    return df


_VALID_REPORT_TYPES = {
    "data_table", "kpi_dashboard", "financial_report",
    "ranking", "comparison", "timeseries", "auto",
}
_VALID_PRESETS = {
    "modern_orange", "corporate_navy", "financial",
    "minimal_gray", "executive",
}


def _to_xlsx(
    df: pl.DataFrame,
    filename: str,
    source: str,
    options: Optional[dict[str, Any]] = None,
) -> bytes:
    options = options or {}
    rows = df.to_dicts()
    columns = [
        ColumnSpec(header=name, key=name, type=_polars_to_excel_type(dtype))
        for name, dtype in zip(df.columns, df.dtypes)
    ]

    sheet_kwargs: dict[str, Any] = {
        "name": "Datos",
        "columns": columns,
        "rows": rows,
        "title": f"Export — {source}",
    }
    if (chart := options.get("chart")) is not None:
        sheet_kwargs["chart"] = chart

    spec_kwargs: dict[str, Any] = {
        "filename": filename,
        "sheets": [SheetSpec(**sheet_kwargs)],
        "author": options.get("author") or "Plataforma IA",
    }
    if (rt := options.get("report_type")) and rt in _VALID_REPORT_TYPES:
        spec_kwargs["report_type"] = rt
    if (sp := options.get("style_preset")) and sp in _VALID_PRESETS:
        spec_kwargs["style_preset"] = sp
    if options.get("cover_sheet"):
        spec_kwargs["cover_sheet"] = True
    if (division := options.get("division")):
        spec_kwargs["division"] = division
    if (summary := options.get("summary_sheet")) is not None:
        spec_kwargs["summary_sheet"] = summary

    spec = ExcelReportSpec(**spec_kwargs)
    return build_excel_report(spec)


def _polars_to_excel_type(dtype: pl.DataType) -> str:
    if dtype.is_integer():
        return "integer"
    if dtype.is_float():
        return "number"
    if dtype.is_temporal():
        return "date"
    return "text"


def _to_csv_like(df: pl.DataFrame, delimiter: str) -> bytes:
    buf = StringIO()
    writer = csv_module.writer(buf, delimiter=delimiter, quoting=csv_module.QUOTE_MINIMAL)
    writer.writerow(df.columns)
    for row in df.iter_rows():
        writer.writerow([sanitize_cell(_stringify(v)) for v in row])
    # BOM para que Excel Windows abra UTF-8 correctamente.
    return ("\ufeff" + buf.getvalue()).encode("utf-8")


def _stringify(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (str, int, float, bool)):
        return str(value)
    return str(value)


def _to_parquet(df: pl.DataFrame) -> bytes:
    buf = BytesIO()
    df.write_parquet(buf, compression="zstd", compression_level=3)
    return buf.getvalue()


def _to_json(df: pl.DataFrame) -> bytes:
    return json.dumps(df.to_dicts(), ensure_ascii=False, indent=2, default=str).encode("utf-8")


def export_dataset(
    conversation_id: str,
    dataset_id: str,
    fmt: str,
    options: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Exporta un dataset al formato pedido y persiste el archivo en ``generated/``.

    Args:
        conversation_id: dueño del dataset.
        dataset_id: identificador retornado por ``ingest_file``.
        fmt: ``xlsx``, ``csv``, ``tsv``, ``parquet`` o ``json``.
        options: dict con `filename`, `columns`, `sort_by`, `descending`,
            `filter_sql` (SELECT sólo, sanitizado).

    Returns:
        ``{"success": True, "filepath": "generated/...", "filename": "...",
        "rows": N, "format": fmt}``.
    """
    fmt = (fmt or "").lower().strip()
    if fmt not in SUPPORTED_FORMATS:
        return {"success": False,
                "error": f"formato no soportado: {fmt!r}; usa {sorted(SUPPORTED_FORMATS)}"}

    options = options or {}
    meta = DatasetCatalog.get_meta(conversation_id, dataset_id)
    if meta is None:
        return {"success": False, "error": f"dataset {dataset_id} no encontrado"}

    try:
        df = _load_dataframe(conversation_id, dataset_id)
        df = _apply_transforms(
            df,
            columns=options.get("columns"),
            sort_by=options.get("sort_by"),
            descending=bool(options.get("descending", False)),
            filter_sql=options.get("filter_sql"),
        )
    except Exception as exc:
        return {"success": False, "error": str(exc)}

    try:
        filename = _safe_export_filename(options.get("filename", ""), fmt)
    except ValueError as exc:
        return {"success": False, "error": str(exc)}

    try:
        if fmt == "xlsx":
            content = _to_xlsx(df, filename, meta.source_filename, options)
        elif fmt == "csv":
            content = _to_csv_like(df, ",")
        elif fmt == "tsv":
            content = _to_csv_like(df, "\t")
        elif fmt == "parquet":
            content = _to_parquet(df)
        elif fmt == "json":
            content = _to_json(df)
        else:  # pragma: no cover — guarded above
            return {"success": False, "error": f"formato no implementado: {fmt}"}
    except Exception as exc:
        logger.exception("export_dataset: fallo serializando %s", fmt)
        return {"success": False, "error": f"error serializando: {exc}"}

    blob_path = f"generated/{filename}"
    storage_service.upload_blob(content, blob_path)
    return {
        "success": True,
        "filepath": blob_path,
        "filename": filename,
        "format": fmt,
        "rows": int(df.height),
        "columns": list(df.columns),
        "size_bytes": len(content),
        "source_dataset_id": dataset_id,
    }
