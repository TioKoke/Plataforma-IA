"""Consultas SQL sobre datasets Parquet vía DuckDB.

DuckDB se ejecuta en memoria, sin acceso al filesystem del host: el parquet
se carga vía ``pyarrow.BufferReader`` y se registra como tabla ``dataset``.

La sanitización rechaza statements que escapen del sandbox (ATTACH, COPY,
INSTALL, EXPORT, IMPORT, PRAGMA, LOAD) o que ejecuten múltiples queries.
"""
from __future__ import annotations

import logging
import re
from io import BytesIO
from typing import Any

import duckdb
import pyarrow.parquet as pq

from app.agents.datalake.catalog import DatasetCatalog

logger = logging.getLogger(__name__)

DEFAULT_LIMIT = 1000
HARD_MAX_LIMIT = 10_000

# Keywords que rompen el aislamiento del sandbox.
_BLOCKED_KEYWORDS = re.compile(
    r"\b(?:ATTACH|DETACH|LOAD|INSTALL|COPY|EXPORT|IMPORT|PRAGMA|"
    r"CREATE\s+(?:OR\s+REPLACE\s+)?(?:MACRO|FUNCTION|SECRET)|"
    r"CALL|SET\s+VARIABLE|UPDATE|DELETE|INSERT|DROP|TRUNCATE)\b",
    re.IGNORECASE,
)


class QueryRejectedError(ValueError):
    """SQL bloqueado por el sanitizer."""


def _sanitize_sql(sql: str) -> str:
    """Rechaza queries con statements peligrosos o múltiples sentencias."""
    if not sql or not sql.strip():
        raise QueryRejectedError("query vacía")
    cleaned = sql.strip().rstrip(";")
    # Múltiples sentencias separadas por ';' fuera de comillas → rechazar.
    in_single = False
    in_double = False
    for ch in cleaned:
        if ch == "'" and not in_double:
            in_single = not in_single
        elif ch == '"' and not in_single:
            in_double = not in_double
        elif ch == ";" and not in_single and not in_double:
            raise QueryRejectedError("múltiples sentencias no permitidas")
    if _BLOCKED_KEYWORDS.search(cleaned):
        raise QueryRejectedError(
            "la query usa keywords bloqueadas "
            "(ATTACH/COPY/PRAGMA/LOAD/INSTALL/UPDATE/DELETE/INSERT/DROP)"
        )
    return cleaned


def query_dataset(
    conversation_id: str,
    dataset_id: str,
    sql: str,
    limit: int = DEFAULT_LIMIT,
) -> dict[str, Any]:
    """Ejecuta SQL sobre el dataset y devuelve filas materializadas.

    Args:
        conversation_id: dueño del workspace.
        dataset_id: id devuelto por ``ingest_file``.
        sql: SQL DuckDB. La tabla del dataset se llama ``dataset``.
        limit: cota dura sobre filas devueltas (default 1000, máx 10 000).

    Returns:
        ``{"success": True, "columns": [...], "rows": [...], "row_count": N,
        "truncated": bool}`` o ``{"success": False, "error": "..."}``.
    """
    try:
        clean_sql = _sanitize_sql(sql)
    except QueryRejectedError as exc:
        return {"success": False, "error": str(exc)}

    safe_limit = max(1, min(int(limit or DEFAULT_LIMIT), HARD_MAX_LIMIT))

    meta = DatasetCatalog.get_meta(conversation_id, dataset_id)
    if meta is None:
        return {"success": False, "error": f"dataset {dataset_id} no encontrado"}

    parquet_bytes = DatasetCatalog.get_data_bytes(conversation_id, dataset_id)

    con = duckdb.connect(":memory:")
    try:
        # PyArrow registra el parquet como tabla virtual sin tocar el FS.
        table = pq.read_table(BytesIO(parquet_bytes))
        con.register("dataset", table)
        wrapped = f"SELECT * FROM ({clean_sql}) AS _q LIMIT {safe_limit + 1}"
        result = con.execute(wrapped)
        columns = [d[0] for d in result.description]
        rows = result.fetchall()
        truncated = len(rows) > safe_limit
        if truncated:
            rows = rows[:safe_limit]
        out_rows = [
            {col: _coerce_value(value) for col, value in zip(columns, row)}
            for row in rows
        ]
        return {
            "success": True,
            "columns": columns,
            "rows": out_rows,
            "row_count": len(out_rows),
            "truncated": truncated,
            "limit_applied": safe_limit,
        }
    except duckdb.Error as exc:
        return {"success": False, "error": f"DuckDB error: {exc}"}
    except Exception as exc:
        logger.exception("query_dataset: fallo inesperado")
        return {"success": False, "error": str(exc)}
    finally:
        con.close()


def _coerce_value(value: Any) -> Any:
    """Convierte tipos no-JSON-serializables a primitivos."""
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    # Fechas, decimales, etc.
    return str(value)
