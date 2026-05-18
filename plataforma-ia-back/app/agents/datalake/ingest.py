"""Ingestar archivos tabulares y materializarlos como Parquet canónico.

Pipeline:
  1. Detectar formato por extensión (con magic-number como tie-breaker en xlsx).
  2. Validar tamaño / zip-bomb antes de parsear.
  3. Leer con polars (Rust) usando el motor adecuado.
  4. Escribir Parquet con compresión zstd y registrar metadata.
"""
from __future__ import annotations

import gzip
import logging
from io import BytesIO
from pathlib import Path
from typing import Any, Optional

import polars as pl

from app.agents.datalake.catalog import DatasetCatalog, DatasetMeta, now_iso
from app.agents.file_security import FileSecurityError, zip_bomb_guard

logger = logging.getLogger(__name__)

XLSX_MAGIC = b"PK\x03\x04"  # zip header (también docx, xlsx, etc.)
PARQUET_MAGIC = b"PAR1"


def _detect_format(filename: str, content: bytes) -> str:
    suffix = Path(filename).suffix.lower().lstrip(".")
    head = content[:4]
    if suffix in {"parquet", "pq"} or head == PARQUET_MAGIC:
        return "parquet"
    if suffix in {"xlsx", "xlsm", "xltx"} or (head == XLSX_MAGIC and suffix == ""):
        return "xlsx"
    if suffix == "xls":
        return "xls"
    if suffix in {"jsonl", "ndjson"}:
        return "jsonl"
    if suffix == "json":
        return "json"
    if suffix == "tsv":
        return "tsv"
    if suffix == "csv":
        return "csv"
    if suffix == "gz":
        # Doble extensión: .csv.gz, .tsv.gz, .json.gz
        inner = Path(filename).stem.lower()
        if inner.endswith(".csv"):
            return "csv.gz"
        if inner.endswith(".tsv"):
            return "tsv.gz"
        if inner.endswith(".jsonl") or inner.endswith(".ndjson"):
            return "jsonl.gz"
    # Heurística por contenido
    if head == XLSX_MAGIC:
        return "xlsx"
    if head == PARQUET_MAGIC:
        return "parquet"
    if b"," in content[:512] or b";" in content[:512]:
        return "csv"
    raise ValueError(f"Formato no soportado para archivo: {filename!r}")


def _read_csv_like(content: bytes, separator: str) -> pl.DataFrame:
    return pl.read_csv(
        BytesIO(content),
        separator=separator,
        infer_schema_length=10_000,
        ignore_errors=True,
        truncate_ragged_lines=True,
    )


def _decompress_gzip(content: bytes) -> bytes:
    return gzip.decompress(content)


def _read_xlsx_sheets(content: bytes) -> list[tuple[str, pl.DataFrame]]:
    """Devuelve [(sheet_name, df)] para cada hoja del workbook."""
    zip_bomb_guard(content)
    # Primero listamos hojas usando fastexcel directamente para evitar
    # la heurística de polars (que puede colapsar todo en una hoja).
    try:
        import fastexcel
        reader = fastexcel.read_excel(content)
        sheet_names = reader.sheet_names
    except Exception as exc:
        logger.warning("fastexcel.sheet_names falló (%s); usando hoja 1", exc)
        sheet_names = ["Sheet1"]

    results: list[tuple[str, pl.DataFrame]] = []
    for sheet in sheet_names:
        try:
            df = pl.read_excel(BytesIO(content), sheet_name=sheet, engine="calamine")
            if df.height == 0:
                logger.info("hoja '%s' vacía, omitiendo", sheet)
                continue
            results.append((sheet, df))
        except Exception as exc:
            logger.warning("hoja '%s' falló: %s", sheet, exc)
    if not results:
        raise ValueError("Workbook sin hojas con datos legibles")
    return results


def _read_format(content: bytes, fmt: str) -> list[tuple[Optional[str], pl.DataFrame]]:
    if fmt == "csv":
        return [(None, _read_csv_like(content, ","))]
    if fmt == "tsv":
        return [(None, _read_csv_like(content, "\t"))]
    if fmt == "csv.gz":
        return [(None, _read_csv_like(_decompress_gzip(content), ","))]
    if fmt == "tsv.gz":
        return [(None, _read_csv_like(_decompress_gzip(content), "\t"))]
    if fmt == "jsonl":
        return [(None, pl.read_ndjson(BytesIO(content)))]
    if fmt == "jsonl.gz":
        return [(None, pl.read_ndjson(BytesIO(_decompress_gzip(content))))]
    if fmt == "json":
        return [(None, pl.read_json(BytesIO(content)))]
    if fmt == "parquet":
        return [(None, pl.read_parquet(BytesIO(content)))]
    if fmt == "xlsx":
        return [(name, df) for name, df in _read_xlsx_sheets(content)]
    if fmt == "xls":
        # fastexcel/calamine sí soporta xls
        return [(name, df) for name, df in _read_xlsx_sheets(content)]
    raise ValueError(f"Formato no manejado: {fmt}")


def _df_to_parquet(df: pl.DataFrame) -> bytes:
    buffer = BytesIO()
    df.write_parquet(buffer, compression="zstd", compression_level=3)
    return buffer.getvalue()


def _schema_dict(df: pl.DataFrame) -> dict[str, str]:
    return {name: str(dtype) for name, dtype in zip(df.columns, df.dtypes)}


def ingest_file(
    file_bytes: bytes,
    source_filename: str,
    conversation_id: str,
) -> dict[str, Any]:
    """Ingesta un archivo tabular y registra dataset(s) en el catálogo.

    Args:
        file_bytes: contenido binario del archivo subido.
        source_filename: nombre original (para detectar formato y rastrear origen).
        conversation_id: identificador de la conversación dueña del workspace.

    Returns:
        ``{"success": True, "datasets": [...]}`` con metadata por dataset
        (cada hoja del XLSX produce un dataset independiente).
    """
    try:
        fmt = _detect_format(source_filename, file_bytes)
    except ValueError as exc:
        return {"success": False, "error": str(exc)}

    try:
        if fmt in {"xlsx", "xls"}:
            zip_bomb_guard(file_bytes)
        sheets = _read_format(file_bytes, fmt)
    except FileSecurityError as exc:
        return {"success": False, "error": f"archivo bloqueado: {exc}"}
    except Exception as exc:
        logger.exception("ingest_file: error parseando %s", source_filename)
        return {"success": False, "error": f"no se pudo parsear: {exc}"}

    registered: list[dict[str, Any]] = []
    for sheet_name, df in sheets:
        if df.is_empty():
            continue
        dataset_id = DatasetCatalog.new_dataset_id()
        parquet_bytes = _df_to_parquet(df)
        meta = DatasetMeta(
            dataset_id=dataset_id,
            conversation_id=conversation_id,
            source_filename=source_filename,
            sheet_name=sheet_name,
            row_count=int(df.height),
            column_count=int(df.width),
            schema=_schema_dict(df),
            created_at=now_iso(),
            extra={"format": fmt},
        )
        DatasetCatalog.register(parquet_bytes, meta)
        registered.append({
            "dataset_id": dataset_id,
            "sheet": sheet_name,
            "rows": meta.row_count,
            "columns": meta.column_count,
            "schema": meta.schema,
            "size_bytes": meta.size_bytes,
        })

    if not registered:
        return {"success": False, "error": "sin hojas/filas con datos"}

    return {
        "success": True,
        "datasets": registered,
        "format_detected": fmt,
        "source": source_filename,
    }
