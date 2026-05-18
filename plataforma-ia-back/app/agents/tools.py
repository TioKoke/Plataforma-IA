"""
Herramientas para los agentes.
Define funciones que los agentes pueden usar para realizar tareas específicas.
"""
import pandas as pd
import csv as csv_module
from datetime import datetime
from pathlib import Path
import logging
import re
from typing import Awaitable, Callable, Dict, List, Any, Optional
from io import BytesIO, StringIO
import json

from pydantic import ValidationError

logger = logging.getLogger(__name__)

# Ruta al catálogo de agentes
AGENTS_CATALOG_PATH = Path(__file__).parent.parent / "data" / "agents_catalog.json"


# ── Helpers compartidos por las tools UI ─────────────────────────────────────

def _coerce_json(value: Any, default: Any = None) -> Any:
    """Acepta un valor nativo (dict/list) o un JSON string y retorna el objeto.

    Los modelos OpenAI a veces emiten listas como string JSON pese a que el
    schema declare `array` — aceptar ambas formas evita errores espurios.
    """
    if value is None or value == "":
        return default
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return default
    return value


def _validation_error_summary(exc: ValidationError, limit: int = 4) -> str:
    """Extrae los primeros errores de Pydantic en un string compacto."""
    parts: list[str] = []
    for err in exc.errors()[:limit]:
        loc = ".".join(str(p) for p in err.get("loc", ()))
        msg = err.get("msg", "invalid")
        parts.append(f"{loc}: {msg}" if loc else msg)
    more = len(exc.errors()) - limit
    if more > 0:
        parts.append(f"(+{more} más)")
    return "; ".join(parts)


def _rows_from_data_payload(data: str) -> List[Dict[str, Any]]:
    """Normaliza el payload `data` (JSON string o texto) a lista de dicts."""
    try:
        parsed = json.loads(data)
    except (json.JSONDecodeError, TypeError):
        lines = (data or "").strip().split("\n")
        return [{"Información": line} for line in lines if line] or [{"Información": ""}]

    if isinstance(parsed, list):
        rows: List[Dict[str, Any]] = []
        for item in parsed:
            if isinstance(item, dict):
                rows.append(item)
            else:
                rows.append({"Datos": item})
        return rows or [{"Datos": ""}]
    if isinstance(parsed, dict):
        return [parsed]
    return [{"Datos": parsed}]


def save_to_excel(
    data: str,
    filename: Optional[str] = None,
    sheet_name: str = "Datos"
) -> Dict[str, Any]:
    """
    Guarda información estructurada en un archivo Excel con branding Plataforma IA.

    Internamente delega en el constructor declarativo (xlsxwriter) con paleta
    corporativa, tabla filtrable y header congelado. Mantiene la firma pública
    para retrocompatibilidad con agentes que ya la invocan.

    Args:
        data: Datos en formato JSON string o texto estructurado
        filename: Nombre del archivo (opcional, se genera automáticamente si no se provee)
        sheet_name: Nombre de la hoja de Excel

    Returns:
        Dict con información sobre el archivo creado
    """
    try:
        from app.services.storage_service import storage_service
        from app.agents.excel import build_excel_report
        from app.agents.excel.builder import infer_spec_from_rows

        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"datos_agente_{timestamp}.xlsx"
        if not filename.endswith('.xlsx'):
            filename += '.xlsx'

        rows = _rows_from_data_payload(data)
        spec = infer_spec_from_rows(rows, filename=filename, sheet_name=sheet_name)
        file_bytes = build_excel_report(spec)

        blob_path = f"generated/{filename}"
        storage_service.upload_blob(file_bytes, blob_path)

        logger.info(f"Datos guardados en storage: {blob_path}")

        return {
            "success": True,
            "filepath": blob_path,
            "filename": filename,
            "rows": len(rows),
            "columns": len(spec.sheets[0].columns),
            "message": f"Datos guardados exitosamente en {filename}"
        }

    except Exception as e:
        logger.error(f"Error al guardar en Excel: {e}")
        return {
            "success": False,
            "error": str(e),
            "message": f"Error al guardar datos: {str(e)}"
        }


def append_to_excel(
    data: str,
    filename: str,
    sheet_name: str = "Datos"
) -> Dict[str, Any]:
    """
    Agrega información a un archivo Excel existente, re-generándolo con
    branding Plataforma IA. Lee filas existentes con openpyxl, concatena las nuevas
    y reescribe el archivo completo con el constructor declarativo.

    Args:
        data: Datos en formato JSON string
        filename: Nombre del archivo Excel existente
        sheet_name: Nombre de la hoja

    Returns:
        Dict con información sobre la operación
    """
    try:
        from app.services.storage_service import storage_service
        from app.agents.excel import build_excel_report
        from app.agents.excel.builder import infer_spec_from_rows

        if not filename.endswith('.xlsx'):
            filename += '.xlsx'

        blob_path = f"generated/{filename}"
        for prefix in ("generated", "uploads"):
            candidate = f"{prefix}/{filename}"
            if storage_service.blob_exists(candidate):
                blob_path = candidate
                break

        new_rows = _rows_from_data_payload(data)

        existing_rows: List[Dict[str, Any]] = []
        if storage_service.blob_exists(blob_path):
            existing_bytes = storage_service.download_blob(blob_path)
            try:
                existing_df = pd.read_excel(BytesIO(existing_bytes), sheet_name=sheet_name)
                existing_rows = existing_df.where(existing_df.notna(), None) \
                    .to_dict(orient="records")
            except Exception as read_exc:
                logger.warning(
                    f"No se pudo leer hoja '{sheet_name}' de {blob_path}: {read_exc}"
                )

        combined_rows = existing_rows + new_rows
        spec = infer_spec_from_rows(combined_rows, filename=filename, sheet_name=sheet_name)
        file_bytes = build_excel_report(spec)

        storage_service.upload_blob(file_bytes, blob_path)

        logger.info(f"Datos agregados en storage: {blob_path}")

        return {
            "success": True,
            "filepath": blob_path,
            "filename": filename,
            "total_rows": len(combined_rows),
            "new_rows": len(new_rows),
            "message": f"Datos agregados exitosamente. Total de filas: {len(combined_rows)}"
        }

    except Exception as e:
        logger.error(f"Error al agregar datos a Excel: {e}")
        return {
            "success": False,
            "error": str(e),
            "message": f"Error al agregar datos: {str(e)}"
        }


def generate_excel_report(spec: Any) -> Dict[str, Any]:
    """
    Genera un reporte Excel corporativo Plataforma IA desde una spec declarativa.

    Soporta múltiples hojas, columnas tipadas (number, date, currency, percent),
    tablas con auto-filtro, branding (headers naranja, footer corporativo) y
    sanitización anti-injection en todas las celdas de texto.

    Args:
        spec: Spec declarativa como dict o JSON string. Ver `ExcelReportSpec`.

    Returns:
        Dict con éxito/error y metadatos del archivo generado.
    """
    try:
        from app.services.storage_service import storage_service
        from app.agents.excel import ExcelReportSpec, build_excel_report

        payload = _coerce_json(spec, spec)
        if not isinstance(payload, dict):
            return {
                "success": False,
                "error": "spec debe ser un objeto JSON con las claves filename y sheets",
            }

        try:
            report = ExcelReportSpec.model_validate(payload)
        except ValidationError as exc:
            return {
                "success": False,
                "error": f"Spec inválida: {_validation_error_summary(exc)}",
            }

        file_bytes = build_excel_report(report)

        blob_path = f"generated/{report.filename}"
        storage_service.upload_blob(file_bytes, blob_path)

        logger.info(f"Reporte Excel generado en storage: {blob_path}")

        total_rows = sum(len(s.rows) for s in report.sheets)
        return {
            "success": True,
            "filepath": blob_path,
            "filename": report.filename,
            "sheets": [s.name for s in report.sheets],
            "total_rows": total_rows,
            "message": f"Reporte '{report.filename}' generado con branding Plataforma IA "
                       f"({len(report.sheets)} hoja(s), {total_rows} fila(s)).",
        }

    except Exception as exc:
        logger.exception("Error en generate_excel_report")
        return {
            "success": False,
            "error": str(exc),
            "message": f"Error al generar reporte: {exc}",
        }


def generate_pdf_report(spec: Any) -> Dict[str, Any]:
    """
    Genera un reporte PDF corporativo Plataforma IA desde una spec declarativa.

    Soporta portada con branding, KPIs, tablas, listas, secciones con
    saltos de página controlados. Útil para informes ejecutivos, memos,
    actas, cotizaciones y análisis.
    """
    try:
        from app.services.storage_service import storage_service
        from app.agents.pdf import PDFReportSpec, render_report

        payload = _coerce_json(spec, spec)
        if not isinstance(payload, dict):
            return {
                "success": False,
                "error": "spec debe ser un objeto JSON con las claves filename, title y sections",
            }

        try:
            report = PDFReportSpec.model_validate(payload)
        except ValidationError as exc:
            return {
                "success": False,
                "error": f"Spec inválida: {_validation_error_summary(exc)}",
            }

        file_bytes = render_report(report)

        blob_path = f"generated/{report.filename}"
        storage_service.upload_blob(file_bytes, blob_path)

        logger.info(f"Reporte PDF generado en storage: {blob_path}")

        return {
            "success": True,
            "filepath": blob_path,
            "filename": report.filename,
            "num_sections": len(report.sections),
            "message": f"Reporte PDF '{report.filename}' generado con branding Plataforma IA "
                       f"({len(report.sections)} sección(es)).",
        }

    except ImportError as exc:
        logger.exception("WeasyPrint no disponible")
        return {
            "success": False,
            "error": f"WeasyPrint no está disponible en este entorno: {exc}",
            "message": "No se pudo generar el PDF: falta el runtime de WeasyPrint.",
        }
    except Exception as exc:
        logger.exception("Error en generate_pdf_report")
        return {
            "success": False,
            "error": str(exc),
            "message": f"Error al generar reporte PDF: {exc}",
        }


def export_html_to_pdf(
    html: str,
    filename: Optional[str] = None,
    title: str = "Documento Plataforma IA",
) -> Dict[str, Any]:
    """
    Convierte HTML libre a PDF aplicando el CSS Plataforma IA.

    Úsalo cuando generate_pdf_report no encaje y necesites un layout custom.
    """
    try:
        from app.services.storage_service import storage_service
        from app.agents.pdf import render_html

        if not html or not html.strip():
            return {"success": False, "error": "html vacío"}

        if not filename:
            filename = f"documento_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        if not filename.endswith(".pdf"):
            filename += ".pdf"

        file_bytes = render_html(html, title=title)

        blob_path = f"generated/{filename}"
        storage_service.upload_blob(file_bytes, blob_path)

        logger.info(f"PDF generado desde HTML en storage: {blob_path}")

        return {
            "success": True,
            "filepath": blob_path,
            "filename": filename,
            "message": f"PDF '{filename}' generado desde HTML con branding Plataforma IA.",
        }

    except ImportError as exc:
        logger.exception("WeasyPrint no disponible")
        return {
            "success": False,
            "error": f"WeasyPrint no está disponible en este entorno: {exc}",
            "message": "No se pudo generar el PDF: falta el runtime de WeasyPrint.",
        }
    except Exception as exc:
        logger.exception("Error en export_html_to_pdf")
        return {
            "success": False,
            "error": str(exc),
            "message": f"Error al convertir HTML a PDF: {exc}",
        }


def _resolve_excel_blob(filename: str) -> Optional[tuple]:
    """Busca un archivo Excel en generated/ y uploads/. Retorna (blob_path, file_bytes) o None.

    Aplica zip_bomb_guard y sanitización de filename antes de entregar bytes.
    """
    from app.services.storage_service import storage_service
    from app.agents.file_security import (
        zip_bomb_guard, safe_filename, FileSecurityError,
    )

    try:
        filename = safe_filename(filename if filename.endswith('.xlsx') else filename + '.xlsx')
    except FileSecurityError as exc:
        logger.warning("filename xlsx rechazado: %s", exc)
        return None

    for prefix in ("generated", "uploads"):
        candidate = f"{prefix}/{filename}"
        if storage_service.blob_exists(candidate):
            file_bytes = storage_service.download_blob(candidate)
            try:
                zip_bomb_guard(file_bytes)
            except FileSecurityError as exc:
                logger.error("zip_bomb_guard bloqueó %s: %s", candidate, exc)
                return None
            return candidate, file_bytes
    return None


def _resolve_csv_blob(filename: str) -> Optional[tuple]:
    """Busca un archivo CSV en generated/ y uploads/. Retorna (blob_path, file_bytes) o None."""
    from app.services.storage_service import storage_service
    from app.agents.file_security import safe_filename, FileSecurityError

    try:
        filename = safe_filename(filename if filename.endswith('.csv') else filename + '.csv')
    except FileSecurityError as exc:
        logger.warning("filename csv rechazado: %s", exc)
        return None

    for prefix in ("generated", "uploads"):
        candidate = f"{prefix}/{filename}"
        if storage_service.blob_exists(candidate):
            file_bytes = storage_service.download_blob(candidate)
            return candidate, file_bytes
    return None


def inspect_csv(
    filename: str,
    sample_rows: int = 5,
    delimiter: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Inspecciona la estructura de un archivo CSV sin cargar todos los datos.
    Auto-detecta el delimitador y encoding.

    Args:
        filename: Nombre del archivo CSV
        sample_rows: Número de filas de muestra (máx 20)
        delimiter: Delimitador (auto-detecta si no se indica)

    Returns:
        Dict con metadata: columnas, tipos, estadísticas básicas, muestra
    """
    try:
        resolved = _resolve_csv_blob(filename)
        if not resolved:
            return {
                "success": False,
                "error": "Archivo no encontrado",
                "message": f"El archivo {filename} no existe en generated/ ni en uploads/"
            }

        blob_path, file_bytes = resolved
        sample_rows = min(sample_rows, 20)

        # Detect encoding
        try:
            text = file_bytes.decode("utf-8")
            encoding = "utf-8"
        except UnicodeDecodeError:
            text = file_bytes.decode("latin-1")
            encoding = "latin-1"

        # Auto-detect delimiter
        if delimiter is None:
            try:
                dialect = csv_module.Sniffer().sniff(text[:4096])
                delimiter = dialect.delimiter
            except csv_module.Error:
                delimiter = ","

        # Read with pandas
        df = pd.read_csv(StringIO(text), delimiter=delimiter, nrows=1000)
        total_lines = text.count('\n')

        # Column types and profile
        column_types = {}
        data_profile = {}
        for col in df.columns:
            if pd.api.types.is_numeric_dtype(df[col]):
                col_type = "number"
                desc = df[col].describe()
                data_profile[str(col)] = {
                    "type": "number",
                    "null_count": int(df[col].isna().sum()),
                    "min": round(float(desc.get("min", 0)), 4),
                    "max": round(float(desc.get("max", 0)), 4),
                    "mean": round(float(desc.get("mean", 0)), 4),
                }
            elif pd.api.types.is_datetime64_any_dtype(df[col]):
                col_type = "date"
                data_profile[str(col)] = {
                    "type": "date",
                    "null_count": int(df[col].isna().sum()),
                    "min_date": str(df[col].min()),
                    "max_date": str(df[col].max()),
                }
            else:
                col_type = "text"
                from collections import Counter
                non_null = df[col].dropna().astype(str)
                top = Counter(non_null).most_common(3)
                data_profile[str(col)] = {
                    "type": "text",
                    "null_count": int(df[col].isna().sum()),
                    "unique_count": int(non_null.nunique()),
                    "top_values": [{"value": v, "count": c} for v, c in top],
                }
            column_types[str(col)] = col_type

        # Sample data
        sample_df = pd.read_csv(StringIO(text), delimiter=delimiter, nrows=sample_rows)
        sample_data = json.loads(sample_df.to_json(orient="records", date_format="iso", default_handler=str))

        logger.info(f"CSV inspeccionado: {blob_path}")

        return {
            "success": True,
            "filename": filename,
            "blob_path": blob_path,
            "total_rows_estimate": total_lines,
            "total_columns": len(df.columns),
            "columns": list(df.columns),
            "delimiter": delimiter,
            "encoding": encoding,
            "column_types": column_types,
            "data_profile": data_profile,
            "sample_data": sample_data,
            "message": f"CSV {filename}: ~{total_lines} filas, {len(df.columns)} columnas, delimitador='{delimiter}'. "
                       f"Usa read_from_csv para leer datos con filtros.",
        }

    except Exception as e:
        logger.error(f"Error al inspeccionar CSV: {e}")
        return {"success": False, "error": str(e), "message": f"Error al inspeccionar CSV: {str(e)}"}


def read_from_csv(
    filename: str,
    columns: Optional[List[str]] = None,
    max_rows: int = 100,
    delimiter: Optional[str] = None,
    offset: int = 0,
    filters: Optional[str] = None,
    date_column: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    skip_unnamed: bool = True,
    business_days_only: bool = False,
) -> Dict[str, Any]:
    """
    Lee datos de un archivo CSV con filtros, paginación y selección de columnas.

    Args:
        filename: Nombre del archivo CSV
        columns: Lista de columnas a retornar (None = todas)
        max_rows: Máximo de filas a retornar (default 100, máx 2000)
        delimiter: Delimitador (auto-detecta si no se indica)
        offset: Filas a saltar para paginación
        filters: JSON con filtros genéricos
        date_column: Columna de fecha para filtrar
        date_from: Fecha inicio (YYYY-MM-DD)
        date_to: Fecha fin (YYYY-MM-DD)
        skip_unnamed: Omitir columnas sin nombre
        business_days_only: Excluir fines de semana

    Returns:
        Dict con datos filtrados
    """
    try:
        resolved = _resolve_csv_blob(filename)
        if not resolved:
            return {"success": False, "error": "Archivo no encontrado",
                    "message": f"El archivo {filename} no existe en storage"}

        blob_path, file_bytes = resolved
        max_rows = min(max_rows, 5000)

        try:
            text = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            text = file_bytes.decode("latin-1")

        if delimiter is None:
            try:
                dialect = csv_module.Sniffer().sniff(text[:4096])
                delimiter = dialect.delimiter
            except csv_module.Error:
                delimiter = ","

        df = pd.read_csv(StringIO(text), delimiter=delimiter)
        total_rows_original = len(df)

        if skip_unnamed:
            df = df[[c for c in df.columns if not str(c).startswith("Unnamed")]]

        # Column selection
        if columns:
            matched = []
            for req_col in columns:
                for df_col in df.columns:
                    if req_col.lower() in str(df_col).lower():
                        if df_col not in matched:
                            matched.append(df_col)
                        break
            if matched:
                df = df[matched]
            else:
                return {"success": False, "error": "Columnas no encontradas",
                        "requested": columns, "available": list(df.columns)}

        # Generic filters
        if filters:
            df = _apply_filters(df, filters)

        # Date filtering
        if date_column:
            date_col_match = None
            for df_col in df.columns:
                if date_column.lower() in str(df_col).lower():
                    date_col_match = df_col
                    break
            if date_col_match:
                df[date_col_match] = pd.to_datetime(df[date_col_match], errors="coerce")
                df = df.dropna(subset=[date_col_match])
                if date_from:
                    df = df[df[date_col_match] >= pd.to_datetime(date_from)]
                if date_to:
                    df = df[df[date_col_match] <= pd.to_datetime(date_to)]
                df = df.sort_values(date_col_match, ascending=False)
                if business_days_only:
                    df = df[df[date_col_match].dt.dayofweek < 5]

        # Pagination
        total_after_filters = len(df)
        df = df.iloc[offset:offset + max_rows]
        has_more = (offset + max_rows) < total_after_filters

        data = json.loads(df.to_json(orient="records", date_format="iso", default_handler=str))

        result = {
            "success": True,
            "filename": filename,
            "total_rows_in_file": total_rows_original,
            "total_after_filters": total_after_filters,
            "rows_returned": len(data),
            "columns_returned": list(df.columns),
            "offset": offset,
            "has_more": has_more,
            "data": data,
            "message": f"Leídas {len(data)} filas (offset={offset}) de {total_after_filters} filtradas"
        }

        if has_more:
            result["next_offset"] = offset + max_rows

        return result

    except Exception as e:
        logger.error(f"Error al leer CSV: {e}")
        return {"success": False, "error": str(e), "message": f"Error al leer CSV: {str(e)}"}


def _detect_column_type(values: list) -> Dict[str, Any]:
    """Detecta el tipo dominante de una columna a partir de valores de muestra."""
    from datetime import datetime as dt_class
    type_counts = {"number": 0, "date": 0, "text": 0, "boolean": 0, "empty": 0}
    has_currency = False
    has_percentage = False

    for v in values:
        if v is None or (isinstance(v, str) and v.strip() == ""):
            type_counts["empty"] += 1
        elif isinstance(v, bool):
            type_counts["boolean"] += 1
        elif isinstance(v, (int, float)):
            type_counts["number"] += 1
        elif isinstance(v, dt_class):
            type_counts["date"] += 1
        elif isinstance(v, str):
            v_clean = v.strip()
            if v_clean.lower() in ("true", "false", "sí", "si", "no", "verdadero", "falso"):
                type_counts["boolean"] += 1
            elif any(c in v_clean for c in ("$", "USD", "CLP", "€", "£")):
                has_currency = True
                type_counts["number"] += 1
            elif v_clean.endswith("%") or "%" in v_clean:
                has_percentage = True
                type_counts["number"] += 1
            else:
                try:
                    float(v_clean.replace(",", "").replace(".", "", v_clean.count(".") - 1))
                    type_counts["number"] += 1
                except (ValueError, AttributeError):
                    type_counts["text"] += 1
        else:
            type_counts["text"] += 1

    non_empty = sum(v for k, v in type_counts.items() if k != "empty")
    if non_empty == 0:
        return {"type": "empty", "null_count": type_counts["empty"]}

    dominant = max((k for k in type_counts if k != "empty"), key=lambda k: type_counts[k])

    if dominant == "number" and has_currency:
        dominant = "currency"
    elif dominant == "number" and has_percentage:
        dominant = "percentage"

    # Check if mixed
    non_empty_counts = {k: v for k, v in type_counts.items() if k != "empty" and v > 0}
    if len(non_empty_counts) > 1:
        max_count = max(non_empty_counts.values())
        if max_count / non_empty < 0.7:
            dominant = "mixed"

    return {"type": dominant, "null_count": type_counts["empty"]}


def _analyze_sheet_raw(wb_path_or_bytes, sheet_name: str, sample_n: int = 5) -> Dict[str, Any]:
    """
    Analiza una hoja Excel usando openpyxl directamente para manejar
    headers multi-fila, columnas vacías, errores #REF!, celdas combinadas,
    y cualquier tipo de estructura de datos.
    """
    import openpyxl

    if isinstance(wb_path_or_bytes, bytes):
        wb = openpyxl.load_workbook(BytesIO(wb_path_or_bytes), read_only=True, data_only=True)
    else:
        wb = openpyxl.load_workbook(wb_path_or_bytes, read_only=True, data_only=True)

    ws = wb[sheet_name]

    total_rows = ws.max_row or 0
    total_cols = ws.max_column or 0

    # Detectar celdas combinadas. En modo read_only, openpyxl no expone
    # `merged_cells` en la hoja (optimización de memoria); toleramos la
    # ausencia en vez de romper el análisis.
    merged_cells_obj = getattr(ws, "merged_cells", None)
    if merged_cells_obj and getattr(merged_cells_obj, "ranges", None):
        merged_ranges = [str(r) for r in merged_cells_obj.ranges]
    else:
        merged_ranges = []

    # Leer primeras filas para detectar estructura de headers
    scan_rows = min(sample_n + 15, total_rows, 60)
    all_rows = []
    for row in ws.iter_rows(min_row=1, max_row=scan_rows, values_only=True):
        all_rows.append(row)

    wb.close()

    if not all_rows:
        return {"total_rows": 0, "columns": [], "data_blocks": [], "issues": [], "sample": [],
                "column_types": {}, "data_profile": {}, "merged_ranges": merged_ranges}

    # ── Detección universal de header ──
    # Heurística generalizada: busca la fila que más parece un header
    # sin depender de keywords de un dominio específico.
    header_row_idx = 0
    best_header_score = -1

    HEADER_KEYWORDS = {
        'fecha', 'date', 'nombre', 'name', 'id', 'código', 'codigo', 'code',
        'descripción', 'descripcion', 'description', 'total', 'cantidad',
        'monto', 'amount', 'estado', 'status', 'tipo', 'type', 'categoría',
        'categoria', 'category', 'área', 'area', 'división', 'division',
        'precio', 'price', 'valor', 'value', 'región', 'region', 'periodo',
        'period', 'año', 'year', 'mes', 'month', 'unidad', 'unit', 'rut',
        'email', 'teléfono', 'telefono', 'dirección', 'direccion', 'proyecto',
        'project', 'contrato', 'contract', 'proveedor', 'supplier', 'cliente',
        'customer', 'responsable', 'cargo', 'departamento', 'department',
        # Financial (kept but not privileged)
        'px_last', 'mid', 'close', 'open', 'high', 'low', 'volume',
    }

    for i, row in enumerate(all_rows[:8]):
        non_null = [(j, v) for j, v in enumerate(row) if v is not None]
        if not non_null:
            continue

        str_vals = [str(v).strip() for _, v in non_null if isinstance(v, str)]
        num_vals = [v for _, v in non_null if isinstance(v, (int, float)) and not isinstance(v, bool)]

        score = 0

        # 1. Bonus: fila donde TODAS las celdas no vacías son strings (header típico)
        if str_vals and not num_vals:
            score += len(str_vals) * 3

        # 2. Bonus: valores únicos entre sí (headers no se repiten)
        if str_vals:
            unique_ratio = len(set(s.lower() for s in str_vals)) / len(str_vals)
            score += unique_ratio * 5

        # 3. Bonus: strings cortos (típico de headers)
        short_strs = [s for s in str_vals if len(s) <= 25]
        score += len(short_strs) * 2

        # 4. Bonus: keywords genéricos de header
        lower_vals = [s.lower() for s in str_vals]
        keyword_matches = sum(1 for s in lower_vals if s in HEADER_KEYWORDS)
        score += keyword_matches * 5

        # 5. Bonus: fila seguida de fila con datos numéricos (patrón header → data)
        if i + 1 < len(all_rows):
            next_row = all_rows[i + 1]
            next_nums = sum(1 for v in next_row if isinstance(v, (int, float)) and not isinstance(v, bool))
            if next_nums > 0 and str_vals:
                score += next_nums * 2

        # 6. Penalizar: strings muy largos (labels descriptivos, no headers)
        long_strs = [s for s in str_vals if len(s) > 40]
        score -= len(long_strs) * 8

        # 7. Penalizar: filas con muchos números (probablemente datos, no headers)
        score -= len(num_vals) * 3

        # 8. Bonus: muchas celdas no vacías (un header suele tener muchas columnas)
        score += len(non_null) * 0.5

        if score > best_header_score:
            best_header_score = score
            header_row_idx = i

    # Construir headers combinando filas de grupo (anteriores) + fila de headers
    group_labels = {}
    for i in range(header_row_idx):
        row = all_rows[i]
        current_group = None
        for j, val in enumerate(row):
            if val is not None:
                current_group = str(val)
            if current_group:
                group_labels[j] = current_group

    header_row = all_rows[header_row_idx] if header_row_idx < len(all_rows) else []

    # Construir data blocks: detectar secciones de datos separadas por columnas vacías
    data_blocks = []
    current_block = None

    for j, header_val in enumerate(header_row):
        if header_val is not None:
            if current_block is None or j > current_block["end_col"] + 2:
                if current_block:
                    data_blocks.append(current_block)
                group = group_labels.get(j, "")
                current_block = {
                    "group": group,
                    "start_col": j,
                    "end_col": j,
                    "columns": [str(header_val)],
                }
            else:
                current_block["end_col"] = j
                current_block["columns"].append(str(header_val))

    if current_block:
        data_blocks.append(current_block)

    # ── Issues y análisis de datos ──
    issues = []
    ref_count = 0
    data_start = header_row_idx + 1
    data_rows = all_rows[data_start:data_start + 50]

    for row in data_rows:
        for val in row:
            if isinstance(val, str) and '#REF!' in val:
                ref_count += 1

    if ref_count > 0:
        issues.append(f"Contiene {ref_count}+ celdas con #REF! (fórmulas rotas)")

    if merged_ranges:
        issues.append(f"Contiene {len(merged_ranges)} rango(s) de celdas combinadas")

    # ── Detectar filas de subtotales/totales ──
    subtotal_indices = []
    total_keywords = {'total', 'subtotal', 'suma', 'sum', 'gran total', 'totales'}
    for row_idx, row in enumerate(data_rows):
        for val in row:
            if isinstance(val, str) and val.strip().lower() in total_keywords:
                subtotal_indices.append(data_start + row_idx)
                break

    if subtotal_indices:
        issues.append(f"Detectadas {len(subtotal_indices)} fila(s) de totales/subtotales (filas: {subtotal_indices[:5]})")

    # ── Detectar filas vacías que separan secciones ──
    empty_row_indices = []
    for row_idx, row in enumerate(data_rows):
        if all(v is None for v in row):
            empty_row_indices.append(data_start + row_idx)

    if empty_row_indices:
        issues.append(f"{len(empty_row_indices)} fila(s) vacía(s) detectadas (pueden separar secciones)")

    # ── Muestra de datos ──
    sample_data = []
    for row in all_rows[data_start:data_start + sample_n]:
        row_dict = {}
        for block in data_blocks:
            for k, col_name in enumerate(block["columns"]):
                col_idx = block["start_col"] + k
                if col_idx < len(row):
                    val = row[col_idx]
                    if isinstance(val, str) and '#REF!' in val:
                        val = None
                    row_dict[col_name] = str(val) if val is not None else None
        sample_data.append(row_dict)

    # ── Data profile: tipos y estadísticas por columna ──
    column_types = {}
    data_profile = {}

    for block in data_blocks:
        for k, col_name in enumerate(block["columns"]):
            col_idx = block["start_col"] + k
            col_values = []
            for row in data_rows:
                if col_idx < len(row):
                    col_values.append(row[col_idx])

            type_info = _detect_column_type(col_values)
            column_types[col_name] = type_info["type"]

            # Profile stats
            profile = {"type": type_info["type"], "null_count": type_info["null_count"]}
            non_null_vals = [v for v in col_values if v is not None]

            if type_info["type"] in ("number", "currency", "percentage"):
                nums = []
                for v in non_null_vals:
                    if isinstance(v, (int, float)) and not isinstance(v, bool):
                        nums.append(float(v))
                    elif isinstance(v, str):
                        try:
                            cleaned = v.replace("$", "").replace(",", "").replace("%", "").replace("CLP", "").replace("USD", "").strip()
                            nums.append(float(cleaned))
                        except ValueError:
                            pass
                if nums:
                    profile["min"] = round(min(nums), 2)
                    profile["max"] = round(max(nums), 2)
                    profile["mean"] = round(sum(nums) / len(nums), 2)

            elif type_info["type"] == "date":
                from datetime import datetime as dt_class
                dates = [v for v in non_null_vals if isinstance(v, dt_class)]
                if dates:
                    profile["min_date"] = str(min(dates).date())
                    profile["max_date"] = str(max(dates).date())

            elif type_info["type"] == "text":
                if non_null_vals:
                    unique = set(str(v) for v in non_null_vals)
                    profile["unique_count"] = len(unique)
                    from collections import Counter
                    top = Counter(str(v) for v in non_null_vals).most_common(3)
                    profile["top_values"] = [{"value": v, "count": c} for v, c in top]

            data_profile[col_name] = profile

    # Densidad de datos por bloque
    for block in data_blocks:
        filled = 0
        total = 0
        for row in data_rows:
            for k in range(len(block["columns"])):
                col_idx = block["start_col"] + k
                total += 1
                if col_idx < len(row) and row[col_idx] is not None:
                    val = row[col_idx]
                    if not (isinstance(val, str) and '#REF!' in val):
                        filled += 1
        block["data_density"] = f"{filled}/{total}" if total > 0 else "0/0"

    # Limpiar campos internos para output
    for block in data_blocks:
        del block["start_col"]
        del block["end_col"]

    return {
        "total_rows": total_rows,
        "total_cols": total_cols,
        "header_row": header_row_idx,
        "data_blocks": data_blocks,
        "issues": issues,
        "sample": sample_data,
        "column_types": column_types,
        "data_profile": data_profile,
        "merged_ranges": merged_ranges[:20],  # Limitar para no sobrecargar
        "subtotal_rows": subtotal_indices[:10] if subtotal_indices else None,
    }


def inspect_excel(
    filename: str,
    sheet_name: Optional[str] = None,
    sample_rows: int = 5,
) -> Dict[str, Any]:
    """
    Inspecciona la estructura de un archivo Excel sin cargar todos los datos.
    Maneja archivos complejos con headers multi-fila, bloques de datos lado a lado,
    y fórmulas rotas (#REF!). Retorna bloques de datos identificados, columnas útiles,
    y una muestra de filas.

    Args:
        filename: Nombre del archivo Excel
        sheet_name: Hoja específica a inspeccionar (None = resumen de todas las hojas)
        sample_rows: Número de filas de muestra a incluir (máx 20)

    Returns:
        Dict con metadata del archivo: hojas, bloques de datos, columnas, muestra
    """
    try:
        resolved = _resolve_excel_blob(filename)
        if not resolved:
            return {
                "success": False,
                "error": "Archivo no encontrado",
                "message": f"El archivo {filename} no existe en generated/ ni en uploads/"
            }

        blob_path, file_bytes = resolved
        xls = pd.ExcelFile(BytesIO(file_bytes))
        sample_rows = min(sample_rows, 20)

        if sheet_name and sheet_name in xls.sheet_names:
            sheets_to_inspect = [sheet_name]
        else:
            sheets_to_inspect = xls.sheet_names

        sheets_info = []
        best_sheet = None
        best_score = -1

        for sname in sheets_to_inspect:
            info = _analyze_sheet_raw(file_bytes, sname, sample_rows)

            # Puntuar la hoja para recomendar la mejor
            score = info["total_rows"]
            if info["issues"]:
                score *= 0.7  # Penalizar hojas con errores (pero no tanto)
            if len(info["data_blocks"]) > 0:
                score *= len(info["data_blocks"])

            if score > best_score:
                best_score = score
                best_sheet = sname

            sheet_entry = {
                "sheet_name": sname,
                "total_rows": info["total_rows"],
                "total_cols": info["total_cols"],
                "header_at_row": info["header_row"],
                "data_blocks": info["data_blocks"],
                "issues": info["issues"] if info["issues"] else None,
                "sample_data": info["sample"],
                "column_types": info.get("column_types", {}),
                "data_profile": info.get("data_profile", {}),
            }

            if info.get("merged_ranges"):
                sheet_entry["merged_ranges"] = info["merged_ranges"]
            if info.get("subtotal_rows"):
                sheet_entry["subtotal_rows"] = info["subtotal_rows"]

            sheets_info.append(sheet_entry)

        # Dar info de columnas con pandas usando el header_row detectado
        pandas_columns = {}
        if best_sheet:
            best_header = next(
                (s["header_at_row"] for s in sheets_info if s["sheet_name"] == best_sheet), 0
            )
            df = pd.read_excel(xls, sheet_name=best_sheet, header=best_header, nrows=0)
            named = [str(c) for c in df.columns if not str(c).startswith("Unnamed")]
            duplicated = [c for c in named if '.' in c and c.rsplit('.', 1)[-1].isdigit()]
            pandas_columns = {
                "sheet": best_sheet,
                "header_row": best_header,
                "pandas_column_names": named,
                "note": f"Usa read_from_excel(sheet_name='{best_sheet}', header_row={best_header}, columns=[...])"
            }
            if duplicated:
                pandas_columns["warning"] = (
                    f"Columnas duplicadas detectadas: {duplicated[:8]}. "
                    "El sheet tiene múltiples secciones con nombres similares."
                )

        logger.info(f"Excel inspeccionado: {blob_path} ({len(sheets_to_inspect)} hojas)")

        return {
            "success": True,
            "filename": filename,
            "blob_path": blob_path,
            "available_sheets": xls.sheet_names,
            "recommended_sheet": best_sheet,
            "sheets": sheets_info,
            "pandas_columns_for_read": pandas_columns,
            "message": f"Estructura del archivo {filename}. Hoja recomendada: '{best_sheet}'. "
                       f"Revisa column_types y data_profile para entender los datos. "
                       f"Usa read_from_excel con sheet_name, columns y filtros para obtener datos específicos.",
        }

    except Exception as e:
        logger.error(f"Error al inspeccionar Excel: {e}")
        return {
            "success": False,
            "error": str(e),
            "message": f"Error al inspeccionar archivo: {str(e)}"
        }


def _apply_filters(df: pd.DataFrame, filters_json: str) -> pd.DataFrame:
    """Aplica filtros genéricos a un DataFrame."""
    try:
        filters_list = json.loads(filters_json) if isinstance(filters_json, str) else filters_json
    except json.JSONDecodeError:
        return df

    for f in filters_list:
        col_name = f.get("column", "")
        op = f.get("op", "equals")
        value = f.get("value")

        # Match flexible de columna
        matched_col = None
        for df_col in df.columns:
            if col_name.lower() in str(df_col).lower():
                matched_col = df_col
                break
        if not matched_col:
            continue

        try:
            if op == "equals":
                df = df[df[matched_col].astype(str).str.lower() == str(value).lower()]
            elif op == "not_equals":
                df = df[df[matched_col].astype(str).str.lower() != str(value).lower()]
            elif op == "contains":
                df = df[df[matched_col].astype(str).str.lower().str.contains(str(value).lower(), na=False)]
            elif op == "not_contains":
                df = df[~df[matched_col].astype(str).str.lower().str.contains(str(value).lower(), na=False)]
            elif op == "greater_than":
                df = df[pd.to_numeric(df[matched_col], errors="coerce") > float(value)]
            elif op == "less_than":
                df = df[pd.to_numeric(df[matched_col], errors="coerce") < float(value)]
            elif op == "greater_equal":
                df = df[pd.to_numeric(df[matched_col], errors="coerce") >= float(value)]
            elif op == "less_equal":
                df = df[pd.to_numeric(df[matched_col], errors="coerce") <= float(value)]
            elif op == "in":
                vals = [str(v).lower() for v in value] if isinstance(value, list) else [str(value).lower()]
                df = df[df[matched_col].astype(str).str.lower().isin(vals)]
            elif op == "not_in":
                vals = [str(v).lower() for v in value] if isinstance(value, list) else [str(value).lower()]
                df = df[~df[matched_col].astype(str).str.lower().isin(vals)]
            elif op == "is_null":
                df = df[df[matched_col].isna()]
            elif op == "not_null":
                df = df[df[matched_col].notna()]
        except Exception:
            continue  # Skip filter on error

    return df


def _auto_detect_header_row(file_bytes: bytes, sheet_name: str) -> int:
    """Auto-detecta la fila de header usando heurística universal."""
    df_raw = pd.read_excel(BytesIO(file_bytes), sheet_name=sheet_name, header=None, nrows=8)
    best_score = -1
    best_row = 0

    HEADER_KEYWORDS = {
        'fecha', 'date', 'nombre', 'name', 'id', 'código', 'codigo',
        'descripción', 'descripcion', 'total', 'cantidad', 'monto',
        'estado', 'status', 'tipo', 'type', 'categoría', 'categoria',
        'área', 'area', 'división', 'division', 'precio', 'price',
        'valor', 'value', 'rut', 'email', 'proyecto', 'contrato',
        'px_last', 'mid', 'close', 'open', 'high', 'low',
    }

    for i in range(min(8, len(df_raw))):
        row_vals = df_raw.iloc[i]
        str_vals = [str(v).lower().strip() for v in row_vals if pd.notna(v) and isinstance(v, str)]
        num_vals = [v for v in row_vals if pd.notna(v) and isinstance(v, (int, float)) and not isinstance(v, bool)]

        if not str_vals:
            continue

        score = 0
        # All strings, no numbers → likely header
        if str_vals and not num_vals:
            score += len(str_vals) * 3
        # Short strings
        score += sum(2 for s in str_vals if len(s) <= 25)
        # Header keywords
        score += sum(5 for s in str_vals if s in HEADER_KEYWORDS)
        # Unique values
        if str_vals:
            score += (len(set(str_vals)) / len(str_vals)) * 5
        # Penalize long strings
        score -= sum(8 for s in str_vals if len(s) > 40)
        # Penalize numbers
        score -= len(num_vals) * 3
        # Next row has numbers → this is header
        if i + 1 < len(df_raw):
            next_nums = sum(1 for v in df_raw.iloc[i + 1] if pd.notna(v) and isinstance(v, (int, float)))
            if next_nums > 0 and str_vals:
                score += next_nums * 2

        if score > best_score:
            best_score = score
            best_row = i

    return best_row


def read_from_excel(
    filename: str,
    sheet_name: str = "Datos",
    columns: Optional[List[str]] = None,
    max_rows: int = 100,
    header_row: Optional[int] = None,
    date_column: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    skip_unnamed: bool = True,
    business_days_only: bool = False,
    offset: int = 0,
    filters: Optional[str] = None,
    cell_range: Optional[str] = None,
    sheets: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Lee datos de un archivo Excel con filtros inteligentes, paginación y soporte multi-hoja.

    Args:
        filename: Nombre del archivo Excel
        sheet_name: Nombre de la hoja (ignorado si se usa 'sheets')
        columns: Lista de columnas específicas a retornar (None = todas las nombradas)
        max_rows: Máximo de filas a retornar (default 100, máx 2000)
        header_row: Fila que contiene los headers (0-indexed). Si no se indica, se auto-detecta.
        date_column: Nombre de la columna de fecha para filtrar por rango
        date_from: Fecha inicio filtro (formato YYYY-MM-DD)
        date_to: Fecha fin filtro (formato YYYY-MM-DD)
        skip_unnamed: Omitir columnas 'Unnamed:...' (default True)
        business_days_only: Excluir sábados y domingos (requiere date_column)
        offset: Número de filas a saltar antes de retornar datos (para paginación)
        filters: JSON string con filtros genéricos: [{"column":"Col","op":"equals","value":"X"}]
                 Operadores: equals, not_equals, contains, not_contains, greater_than,
                 less_than, greater_equal, less_equal, in, not_in, is_null, not_null
        cell_range: Rango de celdas específico (ej: "A1:D10"). Si se usa, ignora otros filtros.
        sheets: Lista de hojas a leer simultáneamente. Si se usa, ignora sheet_name.

    Returns:
        Dict con los datos filtrados
    """
    try:
        resolved = _resolve_excel_blob(filename)
        if not resolved:
            return {
                "success": False,
                "error": "Archivo no encontrado",
                "message": f"El archivo {filename} no existe en generated/ ni en uploads/"
            }

        blob_path, file_bytes = resolved
        max_rows = min(max_rows, 5000)

        # ── Modo cell_range: leer rango específico con openpyxl ──
        if cell_range:
            import openpyxl
            wb = openpyxl.load_workbook(BytesIO(file_bytes), read_only=True, data_only=True)
            ws = wb[sheet_name] if sheet_name in wb.sheetnames else wb.active
            rows_data = []
            for row in ws[cell_range]:
                row_data = []
                for cell in row:
                    val = cell.value
                    if isinstance(val, str) and '#REF!' in val:
                        val = None
                    row_data.append(str(val) if val is not None else None)
                rows_data.append(row_data)
            wb.close()
            return {
                "success": True,
                "filename": filename,
                "cell_range": cell_range,
                "rows_returned": len(rows_data),
                "data": rows_data,
                "message": f"Leído rango {cell_range}: {len(rows_data)} filas"
            }

        # ── Modo multi-hoja ──
        if sheets:
            xls = pd.ExcelFile(BytesIO(file_bytes))
            results_by_sheet = {}
            for sname in sheets:
                if sname not in xls.sheet_names:
                    results_by_sheet[sname] = {"error": f"Hoja '{sname}' no encontrada"}
                    continue
                hr = header_row if header_row is not None else _auto_detect_header_row(file_bytes, sname)
                df = pd.read_excel(BytesIO(file_bytes), sheet_name=sname, header=hr)
                df = df.replace(r'#REF!', pd.NA, regex=False)
                if skip_unnamed:
                    df = df[[c for c in df.columns if not str(c).startswith("Unnamed")]]
                if filters:
                    df = _apply_filters(df, filters)
                df = df.iloc[offset:offset + max_rows]
                data = json.loads(df.to_json(orient="records", date_format="iso", default_handler=str))
                results_by_sheet[sname] = {
                    "rows_returned": len(data),
                    "columns": list(df.columns),
                    "data": data,
                }
            return {
                "success": True,
                "filename": filename,
                "sheets_data": results_by_sheet,
                "message": f"Leídas {len(sheets)} hojas del archivo {filename}"
            }

        # ── Modo estándar (una hoja) ──
        if header_row is None:
            header_row = _auto_detect_header_row(file_bytes, sheet_name)

        df = pd.read_excel(BytesIO(file_bytes), sheet_name=sheet_name, header=header_row)
        total_rows_original = len(df)

        # Limpiar valores #REF!
        df = df.replace(r'#REF!', pd.NA, regex=False)

        # Filtrar columnas Unnamed
        if skip_unnamed:
            named_cols = [c for c in df.columns if not str(c).startswith("Unnamed")]
            df = df[named_cols]

        # Seleccionar columnas específicas
        if columns:
            matched = []
            for req_col in columns:
                for df_col in df.columns:
                    if req_col.lower() in str(df_col).lower():
                        if df_col not in matched:
                            matched.append(df_col)
                        break
            if matched:
                df = df[matched]
            else:
                return {
                    "success": False,
                    "error": "Columnas no encontradas",
                    "requested": columns,
                    "available": list(df.columns),
                    "message": f"Ninguna de las columnas solicitadas fue encontrada. Columnas disponibles: {list(df.columns)}"
                }

        # Aplicar filtros genéricos
        if filters:
            df = _apply_filters(df, filters)

        # Filtrar por rango de fechas
        if date_column:
            date_col_match = None
            for df_col in df.columns:
                if date_column.lower() in str(df_col).lower():
                    date_col_match = df_col
                    break

            if date_col_match:
                df[date_col_match] = pd.to_datetime(df[date_col_match], errors="coerce")
                df = df.dropna(subset=[date_col_match])

                if date_from:
                    df = df[df[date_col_match] >= pd.to_datetime(date_from)]
                if date_to:
                    df = df[df[date_col_match] <= pd.to_datetime(date_to)]

                df = df.sort_values(date_col_match, ascending=False)

                if business_days_only:
                    df = df[df[date_col_match].dt.dayofweek < 5]

        # Aplicar paginación
        total_after_filters = len(df)
        df = df.iloc[offset:offset + max_rows]
        has_more = (offset + max_rows) < total_after_filters

        # Convertir a lista de diccionarios
        data = json.loads(df.to_json(orient="records", date_format="iso", default_handler=str))

        logger.info(f"Datos leídos de storage: {blob_path} ({len(data)} filas, {len(df.columns)} columnas)")

        result = {
            "success": True,
            "filename": filename,
            "sheet_name": sheet_name,
            "total_rows_in_file": total_rows_original,
            "total_after_filters": total_after_filters,
            "rows_returned": len(data),
            "columns_returned": list(df.columns),
            "offset": offset,
            "has_more": has_more,
            "data": data,
            "message": f"Leídas {len(data)} filas (offset={offset}) de {total_after_filters} filtradas ({total_rows_original} totales)"
        }

        if has_more:
            result["next_offset"] = offset + max_rows
            result["message"] += f". Usa offset={offset + max_rows} para la siguiente página."

        return result

    except Exception as e:
        logger.error(f"Error al leer Excel: {e}")
        return {
            "success": False,
            "error": str(e),
            "message": f"Error al leer datos: {str(e)}"
        }


def _resolve_data_file(filename: str) -> Optional[tuple]:
    """Resuelve un archivo de datos (Excel o CSV) en storage. Retorna (blob_path, file_bytes, file_type)."""
    from app.services.storage_service import storage_service

    # Intentar como Excel
    excel_name = filename if filename.endswith('.xlsx') else filename + '.xlsx'
    for prefix in ("generated", "uploads"):
        candidate = f"{prefix}/{excel_name}"
        if storage_service.blob_exists(candidate):
            return candidate, storage_service.download_blob(candidate), "excel"

    # Intentar como CSV
    csv_name = filename if filename.endswith('.csv') else filename + '.csv'
    for prefix in ("generated", "uploads"):
        candidate = f"{prefix}/{csv_name}"
        if storage_service.blob_exists(candidate):
            return candidate, storage_service.download_blob(candidate), "csv"

    # Intentar nombre exacto
    for prefix in ("generated", "uploads"):
        candidate = f"{prefix}/{filename}"
        if storage_service.blob_exists(candidate):
            ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ""
            ftype = "csv" if ext == "csv" else "excel"
            return candidate, storage_service.download_blob(candidate), ftype

    return None


def _load_dataframe(file_bytes: bytes, file_type: str, sheet_name: str = None,
                    header_row: Optional[int] = None, delimiter: Optional[str] = None) -> pd.DataFrame:
    """Carga un DataFrame desde bytes de archivo Excel o CSV.

    Usa polars + fastexcel (Rust, ~15-20× más rápido que openpyxl) como motor
    primario, con fallback a pandas ante formatos exóticos o celdas combinadas.
    La salida es un pandas.DataFrame para preservar compat con las tools legacy.
    """
    df: Optional[pd.DataFrame] = None

    if file_type == "csv":
        if delimiter is None:
            try:
                dialect = csv_module.Sniffer().sniff(file_bytes[:4096].decode("utf-8", errors="replace"))
                delimiter = dialect.delimiter
            except csv_module.Error:
                delimiter = ","
        try:
            import polars as pl
            df_pl = pl.read_csv(
                BytesIO(file_bytes),
                separator=delimiter,
                infer_schema_length=10000,
                ignore_errors=True,
                truncate_ragged_lines=True,
            )
            df = df_pl.to_pandas()
        except Exception as exc:
            logger.warning("polars.read_csv falló (%s); cayendo a pandas", exc)
            df = pd.read_csv(StringIO(file_bytes.decode("utf-8", errors="replace")), delimiter=delimiter)
    else:
        if header_row is None:
            header_row = _auto_detect_header_row(file_bytes, sheet_name or "Sheet1")
        try:
            import polars as pl
            read_opts = {"header_row": int(header_row)} if header_row else {}
            kwargs: Dict[str, Any] = {
                "source": BytesIO(file_bytes),
                "engine": "calamine",
                "read_options": read_opts,
            }
            if sheet_name:
                kwargs["sheet_name"] = sheet_name
            else:
                kwargs["sheet_id"] = 1
            df_pl = pl.read_excel(**kwargs)
            # Si multi-sheet sin filtro devuelve dict, tomar el primero
            if isinstance(df_pl, dict):
                df_pl = next(iter(df_pl.values()))
            df = df_pl.to_pandas()
        except Exception as exc:
            logger.warning("polars.read_excel falló (%s); cayendo a pandas/openpyxl", exc)
            df = pd.read_excel(BytesIO(file_bytes), sheet_name=sheet_name or 0, header=header_row)

    df = df.replace(r'#REF!', pd.NA, regex=False)
    # Remove unnamed columns
    df = df[[c for c in df.columns if not str(c).startswith("Unnamed")]]
    return df


def summarize_data(
    filename: str,
    sheet_name: Optional[str] = None,
    columns: Optional[List[str]] = None,
    group_by: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Calcula estadísticas descriptivas completas de un archivo Excel o CSV.
    Mucho más eficiente que leer todas las filas: procesa el archivo completo
    internamente y retorna un resumen compacto.

    Args:
        filename: Nombre del archivo (Excel o CSV)
        sheet_name: Hoja específica (solo para Excel)
        columns: Lista de columnas a analizar (None = todas)
        group_by: Columna por la cual agrupar las estadísticas

    Returns:
        Dict con estadísticas por columna (y por grupo si group_by)
    """
    try:
        resolved = _resolve_data_file(filename)
        if not resolved:
            return {"success": False, "error": "Archivo no encontrado",
                    "message": f"El archivo {filename} no existe en storage"}

        blob_path, file_bytes, file_type = resolved
        df = _load_dataframe(file_bytes, file_type, sheet_name)

        if columns:
            matched = []
            for req_col in columns:
                for df_col in df.columns:
                    if req_col.lower() in str(df_col).lower():
                        if df_col not in matched:
                            matched.append(df_col)
                        break
            if matched:
                # Keep group_by column even if not in requested columns
                if group_by:
                    gb_match = None
                    for df_col in df.columns:
                        if group_by.lower() in str(df_col).lower():
                            gb_match = df_col
                            break
                    if gb_match and gb_match not in matched:
                        matched.append(gb_match)
                df = df[matched]

        def _compute_stats(sub_df: pd.DataFrame) -> Dict[str, Any]:
            stats = {}
            for col in sub_df.columns:
                col_stats = {"count": int(sub_df[col].notna().sum()), "null_count": int(sub_df[col].isna().sum())}

                if pd.api.types.is_numeric_dtype(sub_df[col]):
                    desc = sub_df[col].describe()
                    col_stats.update({
                        "type": "number",
                        "min": round(float(desc.get("min", 0)), 4),
                        "max": round(float(desc.get("max", 0)), 4),
                        "mean": round(float(desc.get("mean", 0)), 4),
                        "median": round(float(sub_df[col].median()), 4),
                        "std": round(float(desc.get("std", 0)), 4),
                        "sum": round(float(sub_df[col].sum()), 4),
                        "p25": round(float(desc.get("25%", 0)), 4),
                        "p75": round(float(desc.get("75%", 0)), 4),
                    })
                elif pd.api.types.is_datetime64_any_dtype(sub_df[col]):
                    col_stats.update({
                        "type": "date",
                        "min_date": str(sub_df[col].min()),
                        "max_date": str(sub_df[col].max()),
                    })
                else:
                    unique_vals = sub_df[col].dropna().astype(str)
                    from collections import Counter
                    top = Counter(unique_vals).most_common(5)
                    col_stats.update({
                        "type": "text",
                        "unique_count": int(unique_vals.nunique()),
                        "top_values": [{"value": v, "count": c} for v, c in top],
                        "avg_length": round(unique_vals.str.len().mean(), 1) if len(unique_vals) > 0 else 0,
                    })
                stats[str(col)] = col_stats
            return stats

        if group_by:
            gb_col = None
            for df_col in df.columns:
                if group_by.lower() in str(df_col).lower():
                    gb_col = df_col
                    break
            if not gb_col:
                return {"success": False, "error": f"Columna '{group_by}' no encontrada",
                        "available": list(df.columns)}

            grouped_stats = {}
            for group_val, group_df in df.groupby(gb_col):
                grouped_stats[str(group_val)] = _compute_stats(group_df.drop(columns=[gb_col]))

            return {
                "success": True,
                "filename": filename,
                "total_rows": len(df),
                "group_by": str(gb_col),
                "num_groups": len(grouped_stats),
                "grouped_stats": grouped_stats,
                "message": f"Estadísticas agrupadas por '{gb_col}': {len(grouped_stats)} grupos, {len(df)} filas totales"
            }

        stats = _compute_stats(df)
        return {
            "success": True,
            "filename": filename,
            "total_rows": len(df),
            "total_columns": len(df.columns),
            "stats": stats,
            "message": f"Estadísticas de {filename}: {len(df)} filas, {len(df.columns)} columnas"
        }

    except Exception as e:
        logger.error(f"Error en summarize_data: {e}")
        return {"success": False, "error": str(e), "message": f"Error al resumir datos: {str(e)}"}


def aggregate_data(
    filename: str,
    group_by: List[str],
    aggregations: str,
    sheet_name: Optional[str] = None,
    sort_by: Optional[str] = None,
    max_groups: int = 100,
    filters: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Agrupa y agrega datos de un archivo Excel o CSV (equivalente a GroupBy/Pivot).
    El resultado es compatible directamente con generate_chart_data.

    Args:
        filename: Nombre del archivo (Excel o CSV)
        group_by: Lista de columnas para agrupar
        aggregations: JSON string con lista de agregaciones:
            [{"column": "Ventas", "function": "sum"}, {"column": "Precio", "function": "mean"}]
            Funciones: sum, mean, median, min, max, count, count_distinct, first, last, std
        sheet_name: Hoja específica (solo para Excel)
        sort_by: Columna por la cual ordenar el resultado
        max_groups: Máximo de grupos a retornar (default 100)
        filters: JSON con filtros previos a la agregación

    Returns:
        Dict con datos agregados como lista de diccionarios
    """
    try:
        resolved = _resolve_data_file(filename)
        if not resolved:
            return {"success": False, "error": "Archivo no encontrado",
                    "message": f"El archivo {filename} no existe en storage"}

        blob_path, file_bytes, file_type = resolved
        df = _load_dataframe(file_bytes, file_type, sheet_name)

        # Apply filters before aggregation
        if filters:
            df = _apply_filters(df, filters)

        # Match group_by columns
        gb_cols = []
        for gb in group_by:
            for df_col in df.columns:
                if gb.lower() in str(df_col).lower():
                    gb_cols.append(df_col)
                    break

        if not gb_cols:
            return {"success": False, "error": "Columnas de agrupación no encontradas",
                    "requested": group_by, "available": list(df.columns)}

        # Parse aggregations
        try:
            agg_list = json.loads(aggregations) if isinstance(aggregations, str) else aggregations
        except json.JSONDecodeError:
            return {"success": False, "error": "aggregations debe ser JSON válido"}

        agg_dict = {}
        for agg in agg_list:
            col = agg.get("column", "")
            func = agg.get("function", "sum")

            # Match column
            matched_col = None
            for df_col in df.columns:
                if col.lower() in str(df_col).lower():
                    matched_col = df_col
                    break
            if not matched_col:
                continue

            if func == "count_distinct":
                agg_dict[matched_col] = pd.NamedAgg(column=matched_col, aggfunc="nunique")
            else:
                agg_dict[matched_col] = pd.NamedAgg(column=matched_col, aggfunc=func)

        if not agg_dict:
            return {"success": False, "error": "Ninguna agregación válida encontrada",
                    "available_columns": list(df.columns)}

        # Execute aggregation
        result_df = df.groupby(gb_cols, dropna=False).agg(**agg_dict).reset_index()

        # Sort
        if sort_by:
            sort_col = None
            for df_col in result_df.columns:
                if sort_by.lower() in str(df_col).lower():
                    sort_col = df_col
                    break
            if sort_col:
                result_df = result_df.sort_values(sort_col, ascending=False)

        # Limit groups
        result_df = result_df.head(max_groups)

        data = json.loads(result_df.to_json(orient="records", date_format="iso", default_handler=str))

        return {
            "success": True,
            "filename": filename,
            "group_by": [str(c) for c in gb_cols],
            "aggregations": [{"column": str(k), "function": str(v.aggfunc)} for k, v in agg_dict.items()],
            "total_groups": len(data),
            "data": data,
            "message": f"Agrupado por {gb_cols}: {len(data)} grupos"
        }

    except Exception as e:
        logger.error(f"Error en aggregate_data: {e}")
        return {"success": False, "error": str(e), "message": f"Error al agregar datos: {str(e)}"}


def compare_files(
    filename_a: str,
    filename_b: str,
    join_column: str,
    comparison_type: str = "merge",
    sheet_a: Optional[str] = None,
    sheet_b: Optional[str] = None,
    columns_a: Optional[List[str]] = None,
    columns_b: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Compara o cruza datos entre dos archivos Excel/CSV.

    Args:
        filename_a: Primer archivo
        filename_b: Segundo archivo
        join_column: Columna en común para unir/comparar
        comparison_type: Tipo de comparación:
            "merge" - Left join (todas las filas de A + datos de B)
            "diff" - Filas en A que NO están en B
            "common" - Solo filas presentes en ambos (inner join)
            "stats_compare" - Estadísticas lado a lado
        sheet_a: Hoja del archivo A (solo Excel)
        sheet_b: Hoja del archivo B (solo Excel)
        columns_a: Columnas específicas del archivo A
        columns_b: Columnas específicas del archivo B

    Returns:
        Dict con resultado de la comparación
    """
    try:
        resolved_a = _resolve_data_file(filename_a)
        resolved_b = _resolve_data_file(filename_b)

        if not resolved_a:
            return {"success": False, "error": f"Archivo '{filename_a}' no encontrado"}
        if not resolved_b:
            return {"success": False, "error": f"Archivo '{filename_b}' no encontrado"}

        _, bytes_a, type_a = resolved_a
        _, bytes_b, type_b = resolved_b

        df_a = _load_dataframe(bytes_a, type_a, sheet_a)
        df_b = _load_dataframe(bytes_b, type_b, sheet_b)

        # Select columns
        if columns_a:
            matched = [c for c in df_a.columns if any(r.lower() in str(c).lower() for r in columns_a)]
            if matched:
                df_a = df_a[matched]
        if columns_b:
            matched = [c for c in df_b.columns if any(r.lower() in str(c).lower() for r in columns_b)]
            if matched:
                df_b = df_b[matched]

        # Find join column in both
        join_a = None
        for c in df_a.columns:
            if join_column.lower() in str(c).lower():
                join_a = c
                break
        join_b = None
        for c in df_b.columns:
            if join_column.lower() in str(c).lower():
                join_b = c
                break

        if not join_a or not join_b:
            return {"success": False, "error": f"Columna '{join_column}' no encontrada",
                    "columns_a": list(df_a.columns), "columns_b": list(df_b.columns)}

        if comparison_type == "stats_compare":
            def _quick_stats(df, name):
                stats = {"file": name, "rows": len(df), "columns": len(df.columns)}
                for col in df.select_dtypes(include=["number"]).columns:
                    stats[f"{col}_mean"] = round(float(df[col].mean()), 2)
                    stats[f"{col}_sum"] = round(float(df[col].sum()), 2)
                return stats

            return {
                "success": True,
                "comparison_type": "stats_compare",
                "file_a": _quick_stats(df_a, filename_a),
                "file_b": _quick_stats(df_b, filename_b),
                "common_columns": list(set(str(c) for c in df_a.columns) & set(str(c) for c in df_b.columns)),
                "message": f"Comparación estadística entre {filename_a} y {filename_b}"
            }

        # Rename join column in B to match A for merge
        if join_a != join_b:
            df_b = df_b.rename(columns={join_b: join_a})

        # Add suffixes to avoid column name conflicts
        how = {"merge": "left", "diff": "left", "common": "inner"}.get(comparison_type, "left")
        result_df = pd.merge(df_a, df_b, on=join_a, how=how, suffixes=("_A", "_B"), indicator=True)

        if comparison_type == "diff":
            result_df = result_df[result_df["_merge"] == "left_only"]
            result_df = result_df.drop(columns=["_merge"])
        elif comparison_type in ("merge", "common"):
            result_df = result_df.drop(columns=["_merge"])

        result_df = result_df.head(1000)
        data = json.loads(result_df.to_json(orient="records", date_format="iso", default_handler=str))

        return {
            "success": True,
            "comparison_type": comparison_type,
            "join_column": join_a,
            "rows_a": len(df_a),
            "rows_b": len(df_b),
            "rows_result": len(data),
            "columns_result": list(result_df.columns),
            "data": data,
            "message": f"Comparación '{comparison_type}' por '{join_a}': {len(data)} filas resultado"
        }

    except Exception as e:
        logger.error(f"Error en compare_files: {e}")
        return {"success": False, "error": str(e), "message": f"Error al comparar archivos: {str(e)}"}


def search_in_file(
    filename: str,
    search_term: str,
    sheet_name: Optional[str] = None,
    columns: Optional[List[str]] = None,
    match_type: str = "contains",
    max_results: int = 500,
) -> Dict[str, Any]:
    """
    Busca un valor en un archivo Excel o CSV. Retorna las filas que coinciden.

    Args:
        filename: Nombre del archivo (Excel o CSV)
        search_term: Valor a buscar
        sheet_name: Hoja específica (solo para Excel)
        columns: Columnas donde buscar (None = todas)
        match_type: Tipo de búsqueda: "contains", "exact", "starts_with", "regex"
        max_results: Máximo de filas a retornar (default 100)

    Returns:
        Dict con las filas que coinciden
    """
    try:
        resolved = _resolve_data_file(filename)
        if not resolved:
            return {"success": False, "error": "Archivo no encontrado",
                    "message": f"El archivo {filename} no existe en storage"}

        blob_path, file_bytes, file_type = resolved
        df = _load_dataframe(file_bytes, file_type, sheet_name)

        # Select columns to search in
        search_cols = df.columns.tolist()
        if columns:
            matched = []
            for req_col in columns:
                for df_col in df.columns:
                    if req_col.lower() in str(df_col).lower():
                        if df_col not in matched:
                            matched.append(df_col)
                        break
            if matched:
                search_cols = matched

        # Build mask
        mask = pd.Series(False, index=df.index)
        term_lower = str(search_term).lower()

        for col in search_cols:
            col_str = df[col].astype(str).str.lower()
            if match_type == "exact":
                mask = mask | (col_str == term_lower)
            elif match_type == "starts_with":
                mask = mask | col_str.str.startswith(term_lower, na=False)
            elif match_type == "regex":
                try:
                    mask = mask | col_str.str.contains(search_term, regex=True, na=False, case=False)
                except re.error:
                    mask = mask | col_str.str.contains(term_lower, na=False)
            else:  # contains
                mask = mask | col_str.str.contains(term_lower, na=False)

        result_df = df[mask].head(max_results)
        total_matches = int(mask.sum())

        data = json.loads(result_df.to_json(orient="records", date_format="iso", default_handler=str))

        return {
            "success": True,
            "filename": filename,
            "search_term": search_term,
            "match_type": match_type,
            "total_matches": total_matches,
            "rows_returned": len(data),
            "columns_searched": [str(c) for c in search_cols],
            "data": data,
            "message": f"Encontradas {total_matches} coincidencias para '{search_term}' en {filename}"
                       + (f" (mostrando {len(data)})" if total_matches > len(data) else "")
        }

    except Exception as e:
        logger.error(f"Error en search_in_file: {e}")
        return {"success": False, "error": str(e), "message": f"Error al buscar: {str(e)}"}


def batch_inspect(
    filenames: List[str],
) -> Dict[str, Any]:
    """
    Inspecciona múltiples archivos (Excel y/o CSV) en una sola llamada.
    Mucho más eficiente que llamar inspect_excel/inspect_csv por separado.
    Esencial cuando hay 3+ archivos en la conversación.

    Args:
        filenames: Lista de nombres de archivos a inspeccionar

    Returns:
        Dict con resumen de cada archivo inspeccionado
    """
    results = {}
    for fname in filenames:
        ext = fname.rsplit('.', 1)[-1].lower() if '.' in fname else ""
        try:
            if ext == "csv":
                results[fname] = inspect_csv(fname)
            else:
                results[fname] = inspect_excel(fname)
        except Exception as e:
            results[fname] = {"success": False, "error": str(e)}

    successful = sum(1 for r in results.values() if r.get("success"))
    return {
        "success": True,
        "total_files": len(filenames),
        "inspected": successful,
        "failed": len(filenames) - successful,
        "files": results,
        "message": f"Inspeccionados {successful}/{len(filenames)} archivos"
    }


def save_to_csv(
    data: str,
    filename: Optional[str] = None,
    delimiter: str = ",",
) -> Dict[str, Any]:
    """
    Guarda datos en un archivo CSV con hardening anti-injection (OWASP CWE-1236)
    y encoding UTF-8-SIG (BOM) para visualización correcta de tildes/ñ en Excel Windows.

    Args:
        data: Datos en formato JSON string (lista de objetos)
        filename: Nombre del archivo (opcional, se genera automáticamente)
        delimiter: Delimitador (default ",")

    Returns:
        Dict con información del archivo creado
    """
    import csv as _csv
    from io import StringIO

    try:
        from app.services.storage_service import storage_service
        from app.agents.excel.sanitize import sanitize_cell
        from app.agents.file_security import safe_filename, FileSecurityError

        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"datos_agente_{timestamp}.csv"
        if not filename.endswith('.csv'):
            filename += '.csv'
        try:
            filename = safe_filename(filename)
        except FileSecurityError as exc:
            return {"success": False, "error": f"Filename inseguro: {exc}",
                    "message": "Usa solo letras, números, guiones y puntos en el nombre."}

        rows = _rows_from_data_payload(data)
        columns: list[str] = []
        for row in rows:
            for key in row.keys():
                if key not in columns:
                    columns.append(str(key))
        if not columns:
            columns = ["Datos"]

        buffer = StringIO()
        writer = _csv.writer(buffer, delimiter=delimiter, quoting=_csv.QUOTE_MINIMAL)
        writer.writerow([sanitize_cell(c) for c in columns])
        for row in rows:
            writer.writerow([sanitize_cell(row.get(c, "")) for c in columns])

        csv_content = buffer.getvalue().encode("utf-8-sig")
        blob_path = f"generated/{filename}"
        storage_service.upload_blob(csv_content, blob_path)

        logger.info(f"CSV guardado en storage: {blob_path}")

        return {
            "success": True,
            "filepath": blob_path,
            "filename": filename,
            "rows": len(rows),
            "columns": len(columns),
            "message": f"Datos guardados exitosamente en {filename}"
        }

    except Exception as e:
        logger.error(f"Error al guardar CSV: {e}")
        return {"success": False, "error": str(e), "message": f"Error al guardar CSV: {str(e)}"}


def transform_column(
    filename: str,
    operations: str,
    sheet_name: Optional[str] = None,
    output_filename: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Aplica transformaciones a columnas de un archivo Excel/CSV y guarda el resultado.
    Permite renombrar, crear columnas calculadas, eliminar, convertir tipos, y más.

    Args:
        filename: Archivo origen (Excel o CSV)
        operations: JSON string con lista de operaciones:
            [
                {"op": "rename", "column": "Viejo", "new_name": "Nuevo"},
                {"op": "delete", "columns": ["Col1", "Col2"]},
                {"op": "add_calculated", "new_column": "Total", "formula": "col1 + col2"},
                {"op": "fill_null", "column": "Col", "value": 0},
                {"op": "to_number", "column": "Monto"},
                {"op": "to_date", "column": "Fecha", "format": "%d/%m/%Y"},
                {"op": "to_uppercase", "column": "Nombre"},
                {"op": "to_lowercase", "column": "Email"},
                {"op": "trim", "column": "Texto"},
                {"op": "replace", "column": "Col", "old": "A", "new": "B"},
                {"op": "sort", "column": "Fecha", "ascending": true},
                {"op": "drop_duplicates", "columns": ["RUT"]},
                {"op": "drop_nulls", "columns": ["Monto"]}
            ]
        sheet_name: Hoja (solo Excel)
        output_filename: Nombre del archivo resultado (default: mismo formato con sufijo _transformed)

    Returns:
        Dict con info del archivo transformado
    """
    try:
        from app.services.storage_service import storage_service

        resolved = _resolve_data_file(filename)
        if not resolved:
            return {"success": False, "error": "Archivo no encontrado",
                    "message": f"El archivo {filename} no existe en storage"}

        blob_path, file_bytes, file_type = resolved
        df = _load_dataframe(file_bytes, file_type, sheet_name)

        try:
            ops_list = json.loads(operations) if isinstance(operations, str) else operations
        except json.JSONDecodeError:
            return {"success": False, "error": "operations debe ser JSON válido"}

        applied = []
        for op_def in ops_list:
            op = op_def.get("op", "")
            try:
                if op == "rename":
                    col = op_def["column"]
                    matched = next((c for c in df.columns if col.lower() in str(c).lower()), None)
                    if matched:
                        df = df.rename(columns={matched: op_def["new_name"]})
                        applied.append(f"rename: {matched} → {op_def['new_name']}")

                elif op == "delete":
                    cols = op_def.get("columns", [])
                    to_drop = [c for c in df.columns if any(r.lower() in str(c).lower() for r in cols)]
                    df = df.drop(columns=to_drop)
                    applied.append(f"delete: {to_drop}")

                elif op == "add_calculated":
                    from app.agents.safe_eval import safe_arith_eval, UnsafeExpressionError
                    new_col = op_def["new_column"]
                    formula = op_def["formula"]
                    local_vars: Dict[str, Any] = {str(c): df[c] for c in df.columns}
                    for c in df.columns:
                        local_vars[str(c).lower().replace(" ", "_")] = df[c]
                    try:
                        df[new_col] = safe_arith_eval(formula, local_vars)
                    except UnsafeExpressionError as exc:
                        return {
                            "success": False,
                            "error": f"Fórmula no permitida: {exc}",
                            "message": "Solo se aceptan expresiones aritméticas (+ - * / // % **) "
                                       "sobre columnas y funciones abs/min/max/round.",
                        }
                    applied.append(f"add_calculated: {new_col} = {formula}")

                elif op == "fill_null":
                    col = op_def["column"]
                    matched = next((c for c in df.columns if col.lower() in str(c).lower()), None)
                    if matched:
                        df[matched] = df[matched].fillna(op_def.get("value", 0))
                        applied.append(f"fill_null: {matched}")

                elif op == "to_number":
                    col = op_def["column"]
                    matched = next((c for c in df.columns if col.lower() in str(c).lower()), None)
                    if matched:
                        df[matched] = pd.to_numeric(df[matched].astype(str).str.replace(",", "").str.replace("$", "").str.replace("%", ""), errors="coerce")
                        applied.append(f"to_number: {matched}")

                elif op == "to_date":
                    col = op_def["column"]
                    matched = next((c for c in df.columns if col.lower() in str(c).lower()), None)
                    if matched:
                        fmt = op_def.get("format")
                        df[matched] = pd.to_datetime(df[matched], format=fmt, errors="coerce")
                        applied.append(f"to_date: {matched}")

                elif op == "to_uppercase":
                    col = op_def["column"]
                    matched = next((c for c in df.columns if col.lower() in str(c).lower()), None)
                    if matched:
                        df[matched] = df[matched].astype(str).str.upper()
                        applied.append(f"to_uppercase: {matched}")

                elif op == "to_lowercase":
                    col = op_def["column"]
                    matched = next((c for c in df.columns if col.lower() in str(c).lower()), None)
                    if matched:
                        df[matched] = df[matched].astype(str).str.lower()
                        applied.append(f"to_lowercase: {matched}")

                elif op == "trim":
                    col = op_def["column"]
                    matched = next((c for c in df.columns if col.lower() in str(c).lower()), None)
                    if matched:
                        df[matched] = df[matched].astype(str).str.strip()
                        applied.append(f"trim: {matched}")

                elif op == "replace":
                    col = op_def["column"]
                    matched = next((c for c in df.columns if col.lower() in str(c).lower()), None)
                    if matched:
                        df[matched] = df[matched].astype(str).str.replace(
                            str(op_def.get("old", "")), str(op_def.get("new", "")), regex=False
                        )
                        applied.append(f"replace: {matched}")

                elif op == "sort":
                    col = op_def["column"]
                    matched = next((c for c in df.columns if col.lower() in str(c).lower()), None)
                    if matched:
                        df = df.sort_values(matched, ascending=op_def.get("ascending", True))
                        applied.append(f"sort: {matched}")

                elif op == "drop_duplicates":
                    cols = op_def.get("columns", [])
                    matched = [c for c in df.columns if any(r.lower() in str(c).lower() for r in cols)]
                    if matched:
                        df = df.drop_duplicates(subset=matched)
                        applied.append(f"drop_duplicates: {matched}")
                    else:
                        df = df.drop_duplicates()
                        applied.append("drop_duplicates: all")

                elif op == "drop_nulls":
                    cols = op_def.get("columns", [])
                    matched = [c for c in df.columns if any(r.lower() in str(c).lower() for r in cols)]
                    if matched:
                        df = df.dropna(subset=matched)
                        applied.append(f"drop_nulls: {matched}")

            except Exception as op_err:
                applied.append(f"ERROR en {op}: {str(op_err)}")

        # Save result
        if not output_filename:
            stem = filename.rsplit('.', 1)[0] if '.' in filename else filename
            ext = filename.rsplit('.', 1)[-1] if '.' in filename else "xlsx"
            output_filename = f"{stem}_transformed.{ext}"

        if output_filename.endswith('.csv'):
            content = df.to_csv(index=False).encode("utf-8")
        else:
            if not output_filename.endswith('.xlsx'):
                output_filename += '.xlsx'
            buffer = BytesIO()
            df.to_excel(buffer, index=False)
            buffer.seek(0)
            content = buffer.read()

        out_blob = f"generated/{output_filename}"
        storage_service.upload_blob(content, out_blob)

        return {
            "success": True,
            "filename": output_filename,
            "filepath": out_blob,
            "rows": len(df),
            "columns": len(df.columns),
            "operations_applied": applied,
            "message": f"Archivo transformado guardado como {output_filename} ({len(df)} filas, {len(applied)} operaciones)"
        }

    except Exception as e:
        logger.error(f"Error en transform_column: {e}")
        return {"success": False, "error": str(e), "message": f"Error al transformar: {str(e)}"}


BRAND_CHART_COLORS = ["#0072B1", "#F4A261", "#00B4D8", "#2EC4B6", "#E76F51", "#A8DADC"]
BRAND_NAMED_COLORS = ["turquesa", "azul", "naranja", "verde-oscuro", "amarillo", "rojo"]
_CHART_TYPE_ALIASES = {"scatter": "line", "bubble": "line", "histogram": "bar", "heatmap": "bar"}
_VALID_CHART_TYPES = {"bar", "line", "pie", "area", "donut", "stacked_area", "stacked_bar", "waterfall"}


async def generate_chart_data(
    data: Any,
    chart_type: str = "bar",
    chart_id: str = "chart_1",
    title: str = "",
    description: str = "",
    x_key: str = "",
    y_keys: Any = None,
    filters: Any = None,
    on_click_message: str = "",
    selectable: bool = True,
    _event_callback: Optional[Callable[[dict], Awaitable[None]]] = None,
    _message_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Formatea datos como especificación de gráfico interactivo.

    Acepta arrays nativos (preferido por el schema) o JSON strings (legacy).
    Valida con `ChartSpec` de ui_schemas y emite evento `ui-component`.
    """
    from app.agents.ui_schemas import ChartSpec
    from app.agents.ui_emitter import emit_ui_component

    try:
        parsed_data = _coerce_json(data, default=[])
        if not isinstance(parsed_data, list):
            return {
                "success": False,
                "error": "data debe ser una lista de objetos",
                "message": "El parámetro 'data' debe ser un array de objetos (output de read_from_excel['data']).",
            }

        if chart_type not in _VALID_CHART_TYPES:
            chart_type = _CHART_TYPE_ALIASES.get(chart_type, "bar")

        # Heurística: títulos con "dona/donut" → tipo donut
        if chart_type == "pie" and any(kw in title.lower() for kw in ("dona", "donut", "rosquilla")):
            chart_type = "donut"

        parsed_y_keys = _coerce_json(y_keys, default=[]) or []
        if not isinstance(parsed_y_keys, list):
            parsed_y_keys = []

        # Auto-detecta columnas numéricas si no se proveyeron
        if not parsed_y_keys and parsed_data:
            first_row = parsed_data[0]
            color_idx = 0
            for col, val in first_row.items():
                if col == x_key:
                    continue
                if isinstance(val, (int, float)) and val is not None:
                    parsed_y_keys.append({
                        "key": col,
                        "label": col,
                        "color": BRAND_CHART_COLORS[color_idx % len(BRAND_CHART_COLORS)],
                    })
                    color_idx += 1
            parsed_y_keys = parsed_y_keys[:8]

        # Asegura colores asignados
        for i, yk in enumerate(parsed_y_keys):
            if isinstance(yk, dict) and not yk.get("color"):
                yk["color"] = BRAND_CHART_COLORS[i % len(BRAND_CHART_COLORS)]

        parsed_filters = _coerce_json(filters, default=[]) or []
        if not isinstance(parsed_filters, list):
            parsed_filters = []

        # Limpia filas sin x_key o con todos los y_keys en None
        y_col_keys = [yk["key"] for yk in parsed_y_keys if isinstance(yk, dict) and "key" in yk]
        clean_data = []
        for row in parsed_data:
            if not isinstance(row, dict) or row.get(x_key) is None:
                continue
            if not y_col_keys or any(row.get(k) is not None for k in y_col_keys):
                clean_data.append(row)
        parsed_data = clean_data

        # Trunca ISO timestamps a fecha-solo si todos tienen T00:00:00
        if parsed_data and isinstance(parsed_data[0].get(x_key), str):
            if all("T00:00:00" in str(r.get(x_key, "")) for r in parsed_data if r.get(x_key) is not None):
                for row in parsed_data:
                    row[x_key] = str(row.get(x_key, "")).split("T")[0]

        raw_spec = {
            "id": chart_id,
            "type": chart_type,
            "title": title,
            "description": description or None,
            "x_key": x_key,
            "y_keys": parsed_y_keys,
            "data": parsed_data,
            "filters": parsed_filters or None,
            "on_click_message": on_click_message or f"Analiza en detalle: {x_key}={{x_value}}, valor={{y_value}}",
            "selectable": selectable,
        }

        try:
            validated = ChartSpec.model_validate(raw_spec)
        except ValidationError as ve:
            summary = _validation_error_summary(ve)
            logger.warning(f"Chart spec inválido: {summary}")
            return {
                "success": False,
                "error": "validation_error",
                "message": f"Spec de gráfico inválido: {summary}. Revisa los campos y vuelve a llamar la tool.",
            }

        chart_spec = validated.model_dump(exclude_none=True)
        emitted = await emit_ui_component(
            "chart", chart_spec,
            event_callback=_event_callback,
            message_id=_message_id,
        )
        logger.info(f"✅ Chart spec: {chart_id} ({chart_type}, {len(parsed_data)} filas, ws_emit={emitted})")

        # Cuando el WS emitió el evento ui-component, el frontend renderiza
        # por esa vía y NO necesita el bloque markdown — incluirlo duplica el
        # render y gasta tokens en la historia. Fallback sólo si WS falló.
        if emitted:
            message = (
                "Gráfico renderizado en la UI. Introdúcelo con 1-2 frases de "
                "contexto — NO repitas datos ni JSON, el componente ya se muestra."
            )
        else:
            embed_block = f"```chart-component\n{json.dumps(chart_spec, ensure_ascii=False)}\n```"
            message = (
                f"Gráfico renderizado (fallback markdown). Introdúcelo con 1-2 "
                f"frases de contexto.\n\n{embed_block}"
            )
        return {
            "success": True,
            "chart_spec": chart_spec,
            "rendered": emitted,
            "message": message,
        }

    except Exception as e:
        logger.error(f"❌ Error al generar chart spec: {e}")
        return {"success": False, "error": str(e), "message": f"Error al generar gráfico: {str(e)}"}


async def generate_dashboard_data(
    dashboard_id: str,
    title: str,
    panels: Any,
    filters: Any = None,
    layout_columns: int = 2,
    description: str = "",
    _event_callback: Optional[Callable[[dict], Awaitable[None]]] = None,
    _message_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Genera un dashboard interactivo con múltiples paneles.

    Acepta arrays nativos o JSON strings. Valida con `DashboardSpec` y emite
    evento `ui-component`.
    """
    from app.agents.ui_schemas import DashboardSpec
    from app.agents.ui_emitter import emit_ui_component

    _chart_types = ("bar", "line", "pie", "area", "donut", "stacked_area",
                    "stacked_bar", "waterfall")

    try:
        parsed_panels = _coerce_json(panels, default=[]) or []
        if not isinstance(parsed_panels, list) or len(parsed_panels) == 0:
            return {
                "success": False,
                "error": "panels debe ser una lista no vacía",
                "message": "Se requiere al menos un panel para el dashboard.",
            }

        # Normaliza cada panel
        for i, panel in enumerate(parsed_panels):
            if not isinstance(panel, dict):
                continue
            if not panel.get("id"):
                panel["id"] = f"panel_{i}"
            if not panel.get("type"):
                panel["type"] = "bar"

            if panel.get("type") in _chart_types:
                p_data = _coerce_json(panel.get("data"), default=[]) or []
                panel["data"] = p_data
                x_key_p = panel.get("x_key", "")

                # Limpia rows sin x_key
                if p_data and x_key_p:
                    panel["data"] = [r for r in p_data if isinstance(r, dict) and r.get(x_key_p) is not None]

                # Normaliza y_keys (acepta strings o dicts)
                y_keys_p = _coerce_json(panel.get("y_keys"), default=[]) or []
                if not isinstance(y_keys_p, list):
                    y_keys_p = []

                # Auto-detect si está vacío
                if not y_keys_p and panel.get("data"):
                    first = panel["data"][0] if panel["data"] else {}
                    ci = 0
                    for col, val in first.items():
                        if col == x_key_p:
                            continue
                        if isinstance(val, (int, float)) and val is not None:
                            y_keys_p.append({
                                "key": col,
                                "label": col,
                                "color": BRAND_CHART_COLORS[ci % len(BRAND_CHART_COLORS)],
                            })
                            ci += 1
                            if ci >= 8:
                                break

                # Normaliza strings → dicts, asigna colores
                norm_yks = []
                for j, yk in enumerate(y_keys_p):
                    if isinstance(yk, str):
                        norm_yks.append({
                            "key": yk, "label": yk,
                            "color": BRAND_CHART_COLORS[j % len(BRAND_CHART_COLORS)],
                        })
                    elif isinstance(yk, dict):
                        if not yk.get("color"):
                            yk["color"] = BRAND_CHART_COLORS[j % len(BRAND_CHART_COLORS)]
                        norm_yks.append(yk)
                panel["y_keys"] = norm_yks

                # Trunca timestamps midnight
                if panel.get("data") and x_key_p:
                    if all("T00:00:00" in str(r.get(x_key_p, ""))
                           for r in panel["data"] if r.get(x_key_p) is not None):
                        for row in panel["data"]:
                            row[x_key_p] = str(row.get(x_key_p, "")).split("T")[0]

        parsed_filters = _coerce_json(filters, default=[]) or []
        layout_columns = max(1, min(4, layout_columns))

        # ── Validación: paneles chart/table deben venir con data utilizable ──
        # Si un panel no-kpi llega vacío, la UI lo renderiza como headers pelados
        # (tabla) o área gris (chart), y el usuario lo percibe como "cortado".
        # Mejor devolverle al modelo un error explícito con las claves reales
        # para que re-llame con x_key/table_columns alineados.
        panel_errors: list[str] = []
        for panel in parsed_panels:
            if not isinstance(panel, dict):
                continue
            ptype = panel.get("type")
            pid = panel.get("id", "?")
            pdata = panel.get("data") or []
            first_keys = list(pdata[0].keys())[:8] if pdata and isinstance(pdata[0], dict) else []

            if ptype in _chart_types:
                x_key_p = panel.get("x_key")
                y_keys_p = panel.get("y_keys") or []
                if not pdata:
                    panel_errors.append(
                        f"panel '{pid}' ({ptype}): data vacía. "
                        f"Si tu lectura devolvió 0 filas corre inspect_excel/read_from_excel "
                        f"sin filtros. Si sí hay filas, probablemente x_key='{x_key_p}' no "
                        f"coincide con ninguna clave del row (las claves son case-sensitive)."
                    )
                elif not x_key_p:
                    panel_errors.append(
                        f"panel '{pid}' ({ptype}): falta x_key. "
                        f"Claves disponibles en data[0]: {first_keys}."
                    )
                elif not y_keys_p:
                    panel_errors.append(
                        f"panel '{pid}' ({ptype}): y_keys vacío y no se pudo auto-detectar. "
                        f"Claves disponibles en data[0]: {first_keys}. Usa las numéricas."
                    )

            elif ptype == "table":
                tcols = panel.get("table_columns") or []
                if not pdata:
                    panel_errors.append(
                        f"panel '{pid}' (table): data vacía. "
                        f"Si tu lectura devolvió 0 filas, revisa la hoja/filtros antes "
                        f"de armar el dashboard."
                    )
                elif not tcols:
                    panel_errors.append(
                        f"panel '{pid}' (table): falta table_columns. "
                        f"Claves disponibles en data[0]: {first_keys}."
                    )
                else:
                    missing = [c["key"] for c in tcols if isinstance(c, dict)
                               and c.get("key") and c["key"] not in (first_keys or [])]
                    if first_keys and missing:
                        panel_errors.append(
                            f"panel '{pid}' (table): table_columns[].key {missing} no existen "
                            f"en data[0] (claves reales: {first_keys}). "
                            f"Las claves son case-sensitive."
                        )

        if panel_errors:
            joined = "; ".join(panel_errors)
            logger.warning(f"Dashboard {dashboard_id} rechazado por paneles inútiles: {joined}")
            return {
                "success": False,
                "error": "empty_panels",
                "message": (
                    f"Paneles con data vacía o claves desalineadas: {joined}. "
                    f"Corrige y vuelve a llamar generate_dashboard_data. "
                    f"Regla: x_key y table_columns[].key deben ser idénticos (case-sensitive) "
                    f"a las claves del primer row de panels[].data."
                ),
            }

        raw_spec = {
            "id": dashboard_id,
            "title": title,
            "description": description or None,
            "layout": {"columns": layout_columns},
            "filters": parsed_filters or None,
            "panels": parsed_panels,
            "auto_refresh": False,
        }

        try:
            validated = DashboardSpec.model_validate(raw_spec)
        except ValidationError as ve:
            summary = _validation_error_summary(ve)
            logger.warning(f"Dashboard spec inválido: {summary}")
            return {
                "success": False,
                "error": "validation_error",
                "message": f"Spec de dashboard inválido: {summary}. Corrige y reintenta.",
            }

        dashboard_spec = validated.model_dump(exclude_none=True)
        emitted = await emit_ui_component(
            "dashboard", dashboard_spec,
            event_callback=_event_callback,
            message_id=_message_id,
        )
        logger.info(f"✅ Dashboard: {dashboard_id} ({len(parsed_panels)} paneles, ws_emit={emitted})")

        if emitted:
            message = (
                "Dashboard renderizado. Introdúcelo con 1-2 frases de contexto — "
                "NO repitas datos ni JSON."
            )
        else:
            embed_block = f"```dashboard-component\n{json.dumps(dashboard_spec, ensure_ascii=False)}\n```"
            message = (
                f"Dashboard renderizado (fallback markdown). Introdúcelo con "
                f"1-2 frases de contexto.\n\n{embed_block}"
            )
        return {
            "success": True,
            "dashboard_spec": dashboard_spec,
            "rendered": emitted,
            "message": message,
        }

    except Exception as e:
        logger.error(f"❌ Error al generar dashboard spec: {e}")
        return {"success": False, "error": str(e), "message": f"Error al generar dashboard: {str(e)}"}


async def generate_kpi_data(
    kpi_id: str,
    title: str,
    cards: Any,
    columns: int = 3,
    description: str = "",
    _event_callback: Optional[Callable[[dict], Awaitable[None]]] = None,
    _message_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Genera tarjetas KPI. Valida con `StandaloneKPISpec` y emite `ui-component`."""
    from app.agents.ui_schemas import StandaloneKPISpec
    from app.agents.ui_emitter import emit_ui_component

    try:
        parsed_cards = _coerce_json(cards, default=[]) or []
        if not isinstance(parsed_cards, list) or len(parsed_cards) == 0:
            return {
                "success": False,
                "error": "cards debe ser una lista no vacía",
                "message": "Se requiere al menos una tarjeta KPI.",
            }

        for i, card in enumerate(parsed_cards):
            if not isinstance(card, dict):
                continue
            if not card.get("id"):
                card["id"] = f"kpi_card_{i}"
            if not card.get("color"):
                card["color"] = BRAND_NAMED_COLORS[i % len(BRAND_NAMED_COLORS)]

        columns = max(1, min(4, columns))

        raw_spec = {
            "id": kpi_id,
            "title": title,
            "description": description or None,
            "columns": columns,
            "cards": parsed_cards,
        }

        try:
            validated = StandaloneKPISpec.model_validate(raw_spec)
        except ValidationError as ve:
            summary = _validation_error_summary(ve)
            logger.warning(f"KPI spec inválido: {summary}")
            return {
                "success": False,
                "error": "validation_error",
                "message": f"Spec de KPIs inválido: {summary}. Corrige y reintenta.",
            }

        kpi_spec = validated.model_dump(exclude_none=True)
        emitted = await emit_ui_component(
            "kpi", kpi_spec,
            event_callback=_event_callback,
            message_id=_message_id,
        )
        logger.info(f"✅ KPI: {kpi_id} ({len(parsed_cards)} tarjetas, ws_emit={emitted})")

        if emitted:
            message = (
                "KPIs renderizados. Introdúcelos con 1-2 frases de contexto — "
                "NO repitas datos ni JSON."
            )
        else:
            embed_block = f"```kpi-component\n{json.dumps(kpi_spec, ensure_ascii=False)}\n```"
            message = (
                f"KPIs renderizados (fallback markdown). Introdúcelos con 1-2 "
                f"frases de contexto.\n\n{embed_block}"
            )
        return {
            "success": True,
            "kpi_spec": kpi_spec,
            "rendered": emitted,
            "message": message,
        }

    except Exception as e:
        logger.error(f"❌ Error al generar KPI spec: {e}")
        return {"success": False, "error": str(e), "message": f"Error al generar KPIs: {str(e)}"}


async def generate_infographic_data(
    infographic_id: str,
    infographic_type: str,
    title: str,
    nodes: Any,
    edges: Any,
    direction: str = "",
    description: str = "",
    _event_callback: Optional[Callable[[dict], Awaitable[None]]] = None,
    _message_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Genera diagramas interactivos. Valida con `InfographicSpec` y emite evento."""
    from app.agents.ui_schemas import InfographicSpec
    from app.agents.ui_emitter import emit_ui_component

    VALID_TYPES = {"flowchart", "orgchart", "timeline"}
    DEFAULT_DIRECTIONS = {"flowchart": "TB", "orgchart": "TB", "timeline": "LR"}
    CATEGORY_COLORS = {
        "start": "turquesa", "process": "azul", "decision": "amarillo",
        "end": "verde-oscuro", "info": "turquesa", "warning": "naranja",
    }

    try:
        parsed_nodes = _coerce_json(nodes, default=[]) or []
        parsed_edges = _coerce_json(edges, default=[]) or []

        if not isinstance(parsed_nodes, list) or len(parsed_nodes) == 0:
            return {
                "success": False,
                "error": "nodes debe ser una lista no vacía",
                "message": "Se requiere al menos un nodo.",
            }

        if infographic_type not in VALID_TYPES:
            infographic_type = "flowchart"

        if not direction or direction not in ("TB", "LR", "BT", "RL"):
            direction = DEFAULT_DIRECTIONS.get(infographic_type, "TB")

        for i, node in enumerate(parsed_nodes):
            if not isinstance(node, dict):
                continue
            if not node.get("id"):
                node["id"] = f"n{i + 1}"
            if not node.get("color") and node.get("category"):
                node["color"] = CATEGORY_COLORS.get(node["category"], "azul")

        node_ids = {n["id"] for n in parsed_nodes if isinstance(n, dict) and "id" in n}
        valid_edges = []
        for i, edge in enumerate(parsed_edges):
            if not isinstance(edge, dict):
                continue
            if edge.get("source") in node_ids and edge.get("target") in node_ids:
                if not edge.get("id"):
                    edge["id"] = f"e{i + 1}"
                valid_edges.append(edge)

        raw_spec = {
            "id": infographic_id,
            "type": infographic_type,
            "title": title,
            "description": description or None,
            "direction": direction,
            "nodes": parsed_nodes,
            "edges": valid_edges,
        }

        try:
            validated = InfographicSpec.model_validate(raw_spec)
        except ValidationError as ve:
            summary = _validation_error_summary(ve)
            logger.warning(f"Infographic spec inválido: {summary}")
            return {
                "success": False,
                "error": "validation_error",
                "message": f"Spec de infografía inválido: {summary}. Corrige y reintenta.",
            }

        infographic_spec = validated.model_dump(exclude_none=True)
        emitted = await emit_ui_component(
            "infographic", infographic_spec,
            event_callback=_event_callback,
            message_id=_message_id,
        )
        logger.info(
            f"✅ Infographic: {infographic_id} ({infographic_type}, "
            f"{len(parsed_nodes)} nodos, {len(valid_edges)} edges, ws_emit={emitted})"
        )

        if emitted:
            message = (
                "Infografía renderizada. Introdúcela con 1-2 frases de contexto — "
                "NO repitas nodos ni JSON."
            )
        else:
            embed_block = f"```infographic-component\n{json.dumps(infographic_spec, ensure_ascii=False)}\n```"
            message = (
                f"Infografía renderizada (fallback markdown). Introdúcela con "
                f"1-2 frases de contexto.\n\n{embed_block}"
            )
        return {
            "success": True,
            "infographic_spec": infographic_spec,
            "rendered": emitted,
            "message": message,
        }

    except Exception as e:
        logger.error(f"❌ Error al generar infographic spec: {e}")
        return {"success": False, "error": str(e), "message": f"Error al generar infografía: {str(e)}"}


async def generate_widget_data(
    widget_id: str,
    widget_type: str,
    title: str,
    data: Any,
    description: str = "",
    _event_callback: Optional[Callable[[dict], Awaitable[None]]] = None,
    _message_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Genera widgets interactivos (gauge, stepper, comparison, accordion,
    checklist, ranking, swot, risk_matrix, kanban).

    Valida con el discriminador `type` de `WidgetSpec` y emite `ui-component`.
    """
    from pydantic import TypeAdapter
    from app.agents.ui_schemas import WidgetSpec
    from app.agents.ui_emitter import emit_ui_component

    VALID_WIDGET_TYPES = {"comparison", "checklist", "ranking", "swot", "risk_matrix"}

    try:
        if widget_type not in VALID_WIDGET_TYPES:
            return {
                "success": False,
                "error": f"widget_type inválido: {widget_type}",
                "message": f"Tipo '{widget_type}' no válido. Usa uno de: {sorted(VALID_WIDGET_TYPES)}.",
            }

        parsed_data = _coerce_json(data, default={}) or {}
        if not isinstance(parsed_data, dict):
            return {
                "success": False,
                "error": "data debe ser un objeto",
                "message": "'data' debe ser un objeto con los campos propios del tipo de widget.",
            }

        raw_spec = {
            "id": widget_id,
            "type": widget_type,
            "title": title,
            "description": description or None,
            **parsed_data,
        }

        try:
            validated = TypeAdapter(WidgetSpec).validate_python(raw_spec)
        except ValidationError as ve:
            summary = _validation_error_summary(ve)
            logger.warning(f"Widget spec inválido ({widget_type}): {summary}")
            return {
                "success": False,
                "error": "validation_error",
                "message": f"Spec de widget {widget_type} inválido: {summary}. Corrige y reintenta.",
            }

        widget_spec = validated.model_dump(exclude_none=True)
        emitted = await emit_ui_component(
            "widget", widget_spec,
            event_callback=_event_callback,
            message_id=_message_id,
        )
        logger.info(f"✅ Widget: {widget_id} ({widget_type}, ws_emit={emitted})")

        if emitted:
            message = (
                "Widget renderizado. Introdúcelo con 1-2 frases de contexto — "
                "NO repitas datos ni JSON."
            )
        else:
            embed_block = f"```widget-component\n{json.dumps(widget_spec, ensure_ascii=False)}\n```"
            message = (
                f"Widget renderizado (fallback markdown). Introdúcelo con 1-2 "
                f"frases de contexto.\n\n{embed_block}"
            )
        return {
            "success": True,
            "widget_spec": widget_spec,
            "rendered": emitted,
            "message": message,
        }

    except Exception as e:
        logger.error(f"❌ Error al generar widget spec: {e}")
        return {"success": False, "error": str(e), "message": f"Error al generar widget: {str(e)}"}


def create_backlog_requirement(
    titulo: str,
    descripcion: str,
    problema_a_resolver: str,
    usuarios_objetivo: str,
    funcionalidades_clave: List[str],
    datos_fuentes: str,
    beneficio_esperado: str,
    solicitante_email: str,
    solicitante_nombre: str,
    division: str,
    prioridad: str = "media",
    conversation_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Registra un requerimiento de nuevo agente en el backlog de Plataforma IA.

    Args:
        titulo: Nombre corto del agente propuesto
        descripcion: Descripción general del requerimiento
        problema_a_resolver: Problema específico que busca resolver
        usuarios_objetivo: Quiénes usarían el agente
        funcionalidades_clave: Lista de funcionalidades principales
        datos_fuentes: Fuentes de datos o sistemas que usaría
        beneficio_esperado: Valor o impacto esperado
        solicitante_email: Email del solicitante (del contexto del sistema)
        solicitante_nombre: Nombre del solicitante (del contexto del sistema)
        division: División del solicitante (del contexto del sistema)
        prioridad: baja | media | alta | critica (por defecto "media")
        conversation_id: ID de la conversación de origen

    Returns:
        Dict con backlog_id y mensaje de confirmación
    """
    import uuid
    try:
        from app.services.cosmos_service import cosmos_service

        backlog_id = f"bl_{uuid.uuid4().hex[:12]}"
        now = datetime.utcnow().isoformat()

        item = {
            "id": backlog_id,
            "titulo": titulo,
            "descripcion": descripcion,
            "problema_a_resolver": problema_a_resolver,
            "usuarios_objetivo": usuarios_objetivo,
            "funcionalidades_clave": funcionalidades_clave,
            "datos_fuentes": datos_fuentes,
            "beneficio_esperado": beneficio_esperado,
            "estado": "pendiente",
            "prioridad": prioridad,
            "division": division,
            "solicitante_nombre": solicitante_nombre,
            "solicitante_email": solicitante_email,
            "origen": "chat",
            "conversation_id": conversation_id,
            "created_at": now,
            "updated_at": now,
            "votos": 0,
        }

        cosmos_service.create_backlog(item)

        logger.info(f"✅ Requerimiento creado en backlog: {backlog_id}")
        return {
            "success": True,
            "backlog_id": backlog_id,
            "message": f"Requerimiento registrado exitosamente con ID {backlog_id}. El equipo de la Plataforma IA lo revisará pronto.",
        }

    except Exception as e:
        logger.error(f"❌ Error al crear backlog requirement: {e}")
        return {
            "success": False,
            "error": str(e),
            "message": f"No se pudo registrar el requerimiento: {str(e)}",
        }


def get_backlog_status(
    solicitante_email: str,
    division: str,
) -> Dict[str, Any]:
    """
    Consulta los requerimientos en el backlog del usuario.

    Args:
        solicitante_email: Email del solicitante para filtrar sus requerimientos
        division: División del usuario (partition key en Cosmos DB)

    Returns:
        Dict con la lista de requerimientos del usuario
    """
    try:
        from app.services.cosmos_service import cosmos_service

        items = cosmos_service.get_backlogs_filtered(
            division=division,
            solicitante_email=solicitante_email,
        )

        if not items:
            return {
                "success": True,
                "total": 0,
                "items": [],
                "message": "No tienes requerimientos registrados en el backlog.",
            }

        summary = [
            {
                "id": i["id"],
                "titulo": i["titulo"],
                "estado": i["estado"],
                "prioridad": i["prioridad"],
                "created_at": i["created_at"],
            }
            for i in items
        ]

        return {
            "success": True,
            "total": len(summary),
            "items": summary,
            "message": f"Tienes {len(summary)} requerimiento(s) en el backlog.",
        }

    except Exception as e:
        logger.error(f"❌ Error al consultar backlog status: {e}")
        return {
            "success": False,
            "error": str(e),
            "message": f"No se pudo consultar el backlog: {str(e)}",
        }


def search_agent_info(
    query: str,
    search_type: str = "nombre"
) -> Dict[str, Any]:
    """
    Busca información detallada sobre agentes disponibles en Plataforma IA.

    Args:
        query: Término de búsqueda (nombre del agente, categoría, o palabra clave)
        search_type: Tipo de búsqueda - "nombre", "categoria", "keyword" (por defecto "nombre")

    Returns:
        Dict con información detallada del/los agente(s) encontrado(s)
    """
    try:
        from app.services.cosmos_service import cosmos_service
        try:
            agents = cosmos_service.get_all_agents()
        except Exception as cosmos_err:
            logger.warning(f"Cosmos no disponible para search_agent_info, fallback a JSON: {cosmos_err}")
            if not AGENTS_CATALOG_PATH.exists():
                return {
                    "success": False,
                    "error": "Catálogo de agentes no encontrado",
                    "message": "No se pudo acceder al catálogo de agentes"
                }
            with open(AGENTS_CATALOG_PATH, 'r', encoding='utf-8') as f:
                agents = json.load(f)

        results = []
        query_lower = query.lower()

        # Buscar según el tipo
        for agent in agents:
            match = False

            if search_type == "nombre":
                # Búsqueda por nombre (coincidencia parcial)
                if query_lower in agent.get("nombre", "").lower():
                    match = True

            elif search_type == "categoria":
                # Búsqueda por categoría
                if query_lower in agent.get("categoria", "").lower():
                    match = True

            elif search_type == "keyword":
                # Búsqueda por palabra clave en descripción, casos de uso, beneficios
                if (query_lower in agent.get("descripcion", "").lower() or
                    query_lower in agent.get("categoria", "").lower() or
                    query_lower in str(agent.get("casos_uso", [])).lower() or
                    query_lower in str(agent.get("beneficios", [])).lower()):
                    match = True

            if match:
                results.append(agent)

        if not results:
            return {
                "success": True,
                "found": False,
                "query": query,
                "search_type": search_type,
                "message": f"No se encontraron agentes que coincidan con '{query}'",
                "suggestion": "Intenta con otros términos o usa búsqueda por 'keyword' para una búsqueda más amplia"
            }

        logger.info(f"✅ Encontrados {len(results)} agente(s) para '{query}'")

        return {
            "success": True,
            "found": True,
            "query": query,
            "search_type": search_type,
            "count": len(results),
            "agents": results,
            "message": f"Se encontraron {len(results)} agente(s) que coinciden con '{query}'"
        }

    except Exception as e:
        logger.error(f"❌ Error al buscar información de agentes: {e}")
        return {
            "success": False,
            "error": str(e),
            "message": f"Error al buscar agentes: {str(e)}"
        }


# ── Datalake lite (lakehouse en Parquet por conversación) ────────────────────

def ingest_file_tool(
    filename: str,
    conversation_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Ingesta un archivo a Parquet canónico y retorna dataset_id por hoja."""
    from app.agents.datalake import ingest_file as _ingest
    from app.services.storage_service import storage_service

    if not conversation_id:
        return {"success": False, "error": "conversation_id no disponible"}

    content: Optional[bytes] = None
    for prefix in ("generated", "uploads"):
        candidate = f"{prefix}/{filename}"
        if storage_service.blob_exists(candidate):
            content = storage_service.download_blob(candidate)
            break
    if content is None:
        return {"success": False, "error": f"archivo {filename!r} no encontrado en storage"}

    return _ingest(content, filename, conversation_id)


def query_dataset_tool(
    dataset_id: str,
    sql: str,
    limit: int = 1000,
    conversation_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Ejecuta SQL DuckDB (SELECT-only) sobre un dataset ingestado."""
    from app.agents.datalake import query_dataset as _query
    if not conversation_id:
        return {"success": False, "error": "conversation_id no disponible"}
    return _query(conversation_id, dataset_id, sql, limit=limit)


def export_dataset_tool(
    dataset_id: str,
    format: str,
    options: Optional[Dict[str, Any]] = None,
    conversation_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Exporta un dataset al formato pedido (xlsx/csv/tsv/parquet/json)."""
    from app.agents.datalake import export_dataset as _export
    if not conversation_id:
        return {"success": False, "error": "conversation_id no disponible"}
    return _export(conversation_id, dataset_id, format, options=options)


# Definición de herramientas en formato OpenAI (type/function/parameters)
EXCEL_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "create_backlog_requirement",
            "description": "Registra un requerimiento de nuevo agente IA en el backlog de Plataforma IA. Úsala cuando el usuario haya confirmado que quiere proponer un nuevo agente y ya has recopilado toda la información necesaria (problema, usuarios, funcionalidades, datos y beneficio esperado).",
            "parameters": {
                "type": "object",
                "properties": {
                    "titulo": {
                        "type": "string",
                        "description": "Nombre corto y descriptivo para el agente propuesto (ej: 'Agente de análisis de vibraciones SAG')"
                    },
                    "descripcion": {
                        "type": "string",
                        "description": "Descripción general del requerimiento en 2-3 oraciones"
                    },
                    "problema_a_resolver": {
                        "type": "string",
                        "description": "Problema específico o necesidad que el agente busca resolver"
                    },
                    "usuarios_objetivo": {
                        "type": "string",
                        "description": "Quiénes usarían el agente (roles, áreas, cantidad estimada)"
                    },
                    "funcionalidades_clave": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Lista de 3-5 funcionalidades principales que debe tener el agente"
                    },
                    "datos_fuentes": {
                        "type": "string",
                        "description": "Fuentes de datos, sistemas o archivos que el agente necesitaría procesar"
                    },
                    "beneficio_esperado": {
                        "type": "string",
                        "description": "Valor o impacto esperado del agente (puede incluir métricas estimadas)"
                    },
                    "solicitante_email": {
                        "type": "string",
                        "description": "Email del solicitante (siempre disponible en el contexto del sistema bajo 'Email:')"
                    },
                    "solicitante_nombre": {
                        "type": "string",
                        "description": "Nombre del solicitante (siempre disponible en el contexto del sistema bajo 'Nombre:')"
                    },
                    "division": {
                        "type": "string",
                        "description": "División del solicitante (siempre disponible en el contexto del sistema bajo 'División:')"
                    },
                    "prioridad": {
                        "type": "string",
                        "enum": ["baja", "media", "alta", "critica"],
                        "description": "Prioridad del requerimiento según el impacto en la operación (por defecto 'media')"
                    },
                    "conversation_id": {
                        "type": "string",
                        "description": "ID de la conversación actual (opcional, para trazabilidad)"
                    }
                },
                "required": [
                    "titulo", "descripcion", "problema_a_resolver",
                    "usuarios_objetivo", "funcionalidades_clave",
                    "datos_fuentes", "beneficio_esperado",
                    "solicitante_email", "solicitante_nombre", "division"
                ]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_backlog_status",
            "description": "Consulta los requerimientos de agentes que el usuario ha registrado en el backlog. Úsala cuando el usuario pregunte sobre sus requerimientos pendientes, el estado de sus propuestas, o quiera saber qué tiene registrado.",
            "parameters": {
                "type": "object",
                "properties": {
                    "solicitante_email": {
                        "type": "string",
                        "description": "Email del solicitante (del contexto del sistema)"
                    },
                    "division": {
                        "type": "string",
                        "description": "División del usuario (del contexto del sistema)"
                    }
                },
                "required": ["solicitante_email", "division"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_agent_info",
            "description": "Busca información detallada sobre los agentes de IA disponibles en Plataforma IA. Proporciona descripción completa, casos de uso, beneficios, enlace y más detalles del agente. Úsala cuando el usuario pregunte sobre agentes específicos o necesite recomendaciones detalladas.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Término de búsqueda: nombre del agente, categoría (ej: 'Legal', 'RRHH', 'Contratos'), o palabra clave relacionada con lo que hace el agente"
                    },
                    "search_type": {
                        "type": "string",
                        "enum": ["nombre", "categoria", "keyword"],
                        "description": "Tipo de búsqueda: 'nombre' para buscar por nombre del agente, 'categoria' para buscar por categoría, 'keyword' para búsqueda amplia en descripción y funcionalidades. Por defecto 'nombre'."
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "save_to_excel",
            "description": "Guarda información estructurada en un archivo Excel simple con branding Plataforma IA. Úsalo SOLO para dumps rápidos de datos tabulares de una sola hoja sin formato especial. Para CUALQUIER output que sea un reporte, dashboard, análisis, ranking, comparativa, KPIs o resumen ejecutivo, prefiere SIEMPRE generate_excel_report (produce charts embebidos, KPI tiles, portada, presets de estilo, totales y formato condicional automáticos).",
            "parameters": {
                "type": "object",
                "properties": {
                    "data": {
                        "type": "string",
                        "description": "Datos a guardar en formato JSON string (puede ser una lista de objetos o un objeto único). También acepta texto plano que se organizará en columnas."
                    },
                    "filename": {
                        "type": "string",
                        "description": "Nombre del archivo Excel (opcional). Si no se provee, se genera automáticamente con timestamp."
                    },
                    "sheet_name": {
                        "type": "string",
                        "description": "Nombre de la hoja en el archivo Excel (por defecto 'Datos')"
                    }
                },
                "required": ["data"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "generate_excel_report",
            "description": (
                "Genera un reporte Excel CORPORATIVO PROFESIONAL Plataforma IA desde una spec declarativa. "
                "Es la herramienta DEFAULT para CUALQUIER output tabular (reporte, dashboard, ranking, "
                "comparativa, KPIs, resumen ejecutivo, análisis). Produce: branding Plataforma IA, tablas "
                "filtrables con bandas zebra, headers congelados, autofit de columnas, formato numérico "
                "por tipo, totales automáticos, formato condicional (data bars, color scales), charts "
                "embebidos (bar/column/line/pie), KPI tiles, sparklines, hoja Portada y hoja Resumen. "
                "Soporta múltiples hojas.\n\n"
                "DECISIÓN DE ESTILO — pasa `report_type` para declarar el intent:\n"
                "  • 'kpi_dashboard' — para dashboards ejecutivos. Activa cover_sheet + summary_sheet con KPIs, preset 'executive' (azul navy).\n"
                "  • 'financial_report' — reportes financieros. Preset 'financial', currency formato, totales sum.\n"
                "  • 'ranking' — ranking/top-N. Preset 'modern_orange', data_bar en métrica, ordena desc.\n"
                "  • 'comparison' — comparativas (división A vs B, año X vs Y). Preset 'corporate_navy', 3_color_scale.\n"
                "  • 'timeseries' — evolución temporal. Chart line auto, sparklines opcionales.\n"
                "  • 'data_table' — listados crudos sin charts. Preset 'modern_orange'.\n"
                "  • 'auto' (default) — heurística decide según shape de los datos.\n\n"
                "PRESETS DISPONIBLES (style_preset):\n"
                "  • modern_orange — naranja Plataforma IA. Default elegante.\n"
                "  • corporate_navy — azul corporativo. Reportes formales.\n"
                "  • executive — navy oscuro premium. Dashboards C-level.\n"
                "  • financial — verde sobrio. Reportes financieros.\n"
                "  • minimal_gray — gris minimalista. Listados densos.\n\n"
                "Ejemplo dashboard ejecutivo:\n"
                "{\"filename\":\"dashboard_q1.xlsx\",\"report_type\":\"kpi_dashboard\","
                "\"cover_sheet\":true,\"author\":\"Jorge Tapia\",\"division\":\"Norte\","
                "\"summary_sheet\":{\"name\":\"Resumen\",\"kpis\":["
                "{\"label\":\"Producción total\",\"value\":150300,\"format\":\"integer\",\"delta\":12.5,\"color\":\"green\"},"
                "{\"label\":\"USD MM\",\"value\":1113.6,\"format\":\"currency\",\"color\":\"blue\"}]},"
                "\"sheets\":[{\"name\":\"Detalle\",\"title\":\"Producción Q1 2026\","
                "\"columns\":[{\"header\":\"División\",\"key\":\"div\",\"type\":\"text\"},"
                "{\"header\":\"Toneladas\",\"key\":\"ton\",\"type\":\"integer\"},"
                "{\"header\":\"USD MM\",\"key\":\"usd\",\"type\":\"currency\"}],"
                "\"rows\":[{\"div\":\"Norte\",\"ton\":82500,\"usd\":612.4},"
                "{\"div\":\"RT\",\"ton\":67800,\"usd\":501.2}],"
                "\"chart\":{\"type\":\"bar\",\"title\":\"Producción por división\","
                "\"x_column\":\"div\",\"y_columns\":[\"ton\"]}}]}"
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "spec": {
                        "type": "object",
                        "description": "Spec declarativa del reporte.",
                        "properties": {
                            "filename": {
                                "type": "string",
                                "pattern": r"^[\w\-. ]+\.xlsx$",
                                "description": "Nombre del archivo (debe terminar en .xlsx)."
                            },
                            "author": {
                                "type": "string",
                                "description": "Autor del reporte. Aparece en la portada si cover_sheet=true."
                            },
                            "division": {
                                "type": "string",
                                "description": "División Plataforma IA (Norte, RT, Andina, El Teniente, etc.). Aparece en la portada."
                            },
                            "report_type": {
                                "type": "string",
                                "enum": ["data_table", "kpi_dashboard", "financial_report", "ranking", "comparison", "timeseries", "auto"],
                                "default": "auto",
                                "description": (
                                    "Intent del reporte. Activa defaults inteligentes (preset, totales, "
                                    "conditional formats, chart, sparklines). Si dudas, deja 'auto' y la "
                                    "heurística decide según el shape de los datos."
                                )
                            },
                            "cover_sheet": {
                                "type": "boolean",
                                "default": False,
                                "description": "Si true, agrega una hoja 'Portada' con título grande, fecha, autor y división. Recomendado para report_type=kpi_dashboard / financial_report."
                            },
                            "style_preset": {
                                "type": "string",
                                "enum": ["modern_orange", "corporate_navy", "financial", "minimal_gray", "executive"],
                                "default": "modern_orange",
                                "description": "Paleta de colores y estilo de tabla. Si pasas report_type específico, no necesitas pasar esto: el preset se infiere."
                            },
                            "summary_sheet": {
                                "type": "object",
                                "description": "Hoja 'Resumen' opcional con KPI tiles grandes (label/valor/delta) y chart opcional. Recomendado para dashboards.",
                                "properties": {
                                    "name": {"type": "string", "maxLength": 31, "default": "Resumen"},
                                    "notes": {"type": "string", "description": "Texto opcional bajo los KPIs."},
                                    "kpis": {
                                        "type": "array",
                                        "maxItems": 12,
                                        "items": {
                                            "type": "object",
                                            "properties": {
                                                "label": {"type": "string", "description": "Etiqueta corta (ej: 'Producción total Q1')."},
                                                "value": {"description": "Valor numérico o string."},
                                                "delta": {"type": "number", "description": "Variación % vs período anterior (ej: 12.5 → ▲ +12.5%)."},
                                                "format": {"type": "string", "enum": ["text", "number", "integer", "date", "currency", "percent"], "default": "number"},
                                                "color": {"type": "string", "enum": ["green", "red", "blue", "neutral", "orange"], "default": "neutral"}
                                            },
                                            "required": ["label", "value"]
                                        }
                                    }
                                }
                            },
                            "sheets": {
                                "type": "array",
                                "minItems": 1,
                                "maxItems": 20,
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "name": {
                                            "type": "string",
                                            "maxLength": 31,
                                            "description": "Nombre de la pestaña (máx 31 caracteres, límite Excel)."
                                        },
                                        "title": {
                                            "type": "string",
                                            "description": "Título mostrado en la fila superior de la hoja."
                                        },
                                        "subtitle": {
                                            "type": "string",
                                            "description": "Subtítulo opcional bajo el título."
                                        },
                                        "columns": {
                                            "type": "array",
                                            "minItems": 1,
                                            "items": {
                                                "type": "object",
                                                "properties": {
                                                    "header": {"type": "string"},
                                                    "key": {"type": "string"},
                                                    "type": {
                                                        "type": "string",
                                                        "enum": ["text", "number", "integer", "date", "currency", "percent"],
                                                        "default": "text",
                                                        "description": "Tipo de columna. 'currency' aplica formato CLP, 'percent' formato %, 'date' formato dd-mm-yyyy."
                                                    },
                                                    "width": {"type": "number", "description": "Override de ancho. Por defecto autofit."}
                                                },
                                                "required": ["header", "key"]
                                            }
                                        },
                                        "rows": {
                                            "type": "array",
                                            "items": {"type": "object"},
                                            "description": "Filas de datos. Cada row es un dict {key: valor} donde key coincide con columns[*].key."
                                        },
                                        "table": {
                                            "type": "boolean",
                                            "default": True,
                                            "description": "Envolver el rango en una tabla con auto-filtro y estilos alternados."
                                        },
                                        "freeze_header": {
                                            "type": "boolean",
                                            "default": True,
                                            "description": "Congelar la fila de headers al hacer scroll."
                                        },
                                        "totals": {
                                            "description": (
                                                "Fila de totales al pie de la tabla. Pasa 'auto' para SUM en numéricas (default), "
                                                "null para desactivar, o dict {col_key: 'sum'|'average'|'count'|'max'|'min'|'std_dev'}."
                                            ),
                                            "oneOf": [
                                                {"type": "string", "enum": ["auto"]},
                                                {"type": "null"},
                                                {"type": "object", "additionalProperties": {"type": "string", "enum": ["sum", "average", "count", "max", "min", "std_dev"]}}
                                            ]
                                        },
                                        "conditional_formats": {
                                            "description": (
                                                "Formato condicional. 'auto' (default) elige data_bar para la métrica de mayor varianza "
                                                "y 3_color_scale para la siguiente; null desactiva; dict {col_key: 'data_bar'|'3_color_scale'|'2_color_scale'|'top_5'|'bottom_5'} controla manualmente."
                                            ),
                                            "oneOf": [
                                                {"type": "string", "enum": ["auto"]},
                                                {"type": "null"},
                                                {"type": "object", "additionalProperties": {"type": "string", "enum": ["data_bar", "3_color_scale", "2_color_scale", "top_5", "bottom_5"]}}
                                            ]
                                        },
                                        "chart": {
                                            "type": "object",
                                            "description": "Chart embebido junto a la tabla. Usa 'bar' para rankings, 'line' para series temporales, 'column' para comparaciones, 'pie' para proporciones (≤7 categorías).",
                                            "properties": {
                                                "type": {"type": "string", "enum": ["bar", "column", "line", "pie", "doughnut", "area", "scatter"]},
                                                "title": {"type": "string"},
                                                "x_column": {"type": "string", "description": "Key de la columna eje X (categórica o temporal)."},
                                                "y_columns": {"type": "array", "items": {"type": "string"}, "minItems": 1, "description": "Keys de columnas métricas (1 o más)."},
                                                "style": {"type": "integer", "minimum": 1, "maximum": 48, "default": 11}
                                            },
                                            "required": ["type", "x_column", "y_columns"]
                                        },
                                        "sparklines": {
                                            "type": "object",
                                            "description": "Sparklines por fila. Dict {col_target: [col_source1, col_source2, ...]}. Usa cuando hay varias métricas numéricas comparables por fila.",
                                            "additionalProperties": {"type": "array", "items": {"type": "string"}}
                                        },
                                        "style_preset": {
                                            "type": "string",
                                            "enum": ["modern_orange", "corporate_navy", "financial", "minimal_gray", "executive"],
                                            "description": "Override por hoja del preset global."
                                        }
                                    },
                                    "required": ["name", "columns", "rows"]
                                }
                            }
                        },
                        "required": ["filename", "sheets"]
                    }
                },
                "required": ["spec"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "append_to_excel",
            "description": "Agrega nuevos datos a un archivo Excel existente. Útil para ir acumulando información de manera incremental.",
            "parameters": {
                "type": "object",
                "properties": {
                    "data": {
                        "type": "string",
                        "description": "Datos a agregar en formato JSON string"
                    },
                    "filename": {
                        "type": "string",
                        "description": "Nombre del archivo Excel existente"
                    },
                    "sheet_name": {
                        "type": "string",
                        "description": "Nombre de la hoja (por defecto 'Datos')"
                    }
                },
                "required": ["data", "filename"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "inspect_excel",
            "description": "PASO OBLIGATORIO antes de responder cualquier pregunta sobre un archivo Excel. Inspecciona la estructura del archivo SIN cargar datos. Retorna: hojas disponibles, nombres de columnas, bloques de datos y una muestra. DEBES ejecutar esta herramienta ANTES de read_from_excel. NUNCA respondas sobre datos de un Excel sin usar esta herramienta primero.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filename": {
                        "type": "string",
                        "description": "Nombre del archivo Excel a inspeccionar"
                    },
                    "sheet_name": {
                        "type": "string",
                        "description": "Hoja específica a inspeccionar (omitir para ver resumen de todas)"
                    },
                    "sample_rows": {
                        "type": "integer",
                        "description": "Número de filas de muestra (default 5, máx 20)"
                    }
                },
                "required": ["filename"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "read_from_excel",
            "description": "Lee datos REALES y EXACTOS de un archivo Excel. SIEMPRE usa inspect_excel PRIMERO. Soporta paginación (offset), filtros genéricos, lectura de rangos de celdas, y lectura multi-hoja. NUNCA inventes valores: si necesitas un dato, léelo con esta herramienta.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filename": {
                        "type": "string",
                        "description": "Nombre del archivo Excel a leer"
                    },
                    "sheet_name": {
                        "type": "string",
                        "description": "Nombre de la hoja (por defecto 'Datos'). Ignorado si se usa 'sheets'."
                    },
                    "columns": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Lista de columnas a retornar. Match parcial e insensible a mayúsculas."
                    },
                    "max_rows": {
                        "type": "integer",
                        "description": "Máximo de filas a retornar (default 100, máx 5000)"
                    },
                    "header_row": {
                        "type": "integer",
                        "description": "Fila (0-indexed) que contiene los headers. Auto-detecta si se omite."
                    },
                    "date_column": {
                        "type": "string",
                        "description": "Columna de fecha para filtrar por rango temporal"
                    },
                    "date_from": {
                        "type": "string",
                        "description": "Fecha inicio (YYYY-MM-DD)"
                    },
                    "date_to": {
                        "type": "string",
                        "description": "Fecha fin (YYYY-MM-DD)"
                    },
                    "skip_unnamed": {
                        "type": "boolean",
                        "description": "Omitir columnas 'Unnamed:...' (default true)"
                    },
                    "business_days_only": {
                        "type": "boolean",
                        "description": "Excluir sábados y domingos (default false, requiere date_column)"
                    },
                    "offset": {
                        "type": "integer",
                        "description": "Filas a saltar para paginación (default 0). Usa con has_more/next_offset del resultado."
                    },
                    "filters": {
                        "type": "string",
                        "description": "JSON con filtros genéricos: [{\"column\":\"Estado\",\"op\":\"equals\",\"value\":\"Activo\"}]. Operadores: equals, not_equals, contains, not_contains, greater_than, less_than, greater_equal, less_equal, in, not_in, is_null, not_null"
                    },
                    "cell_range": {
                        "type": "string",
                        "description": "Rango de celdas específico (ej: 'A1:D10'). Si se usa, ignora otros filtros y retorna valores raw."
                    },
                    "sheets": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Lista de hojas a leer simultáneamente. Si se usa, ignora sheet_name."
                    }
                },
                "required": ["filename"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "generate_chart_data",
            "description": (
                "Renderiza un gráfico interactivo en la UI. El componente se muestra automáticamente "
                "— NO necesitas copiar ningún bloque. Introduce el gráfico con 1-2 frases de contexto.\n\n"
                "TIPOS SOPORTADOS (todos funcionan, nunca los rechaces):\n"
                "bar, line, pie, donut, area, stacked_area, stacked_bar, radar, treemap, funnel, waterfall.\n\n"
                "Ejemplo BAR (producción por división):\n"
                "{\"chart_id\":\"prod_cu\",\"chart_type\":\"bar\",\"title\":\"Producción Cu por división\","
                "\"x_key\":\"division\",\"y_keys\":[{\"key\":\"toneladas\",\"label\":\"Toneladas\",\"color\":\"#0072B1\"}],"
                "\"data\":[{\"division\":\"Norte\",\"toneladas\":82500},{\"division\":\"RT\",\"toneladas\":67800}]}\n\n"
                "Ejemplo TREEMAP (jerarquía con valores):\n"
                "{\"chart_id\":\"treemap_costos\",\"chart_type\":\"treemap\",\"title\":\"Distribución de costos\","
                "\"x_key\":\"area\",\"y_keys\":[{\"key\":\"costo\",\"label\":\"MUSD\",\"color\":\"#0072B1\"}],"
                "\"data\":[{\"area\":\"Mina\",\"costo\":450},{\"area\":\"Planta\",\"costo\":320},"
                "{\"area\":\"Mantenimiento\",\"costo\":280},{\"area\":\"Energía\",\"costo\":200}]}\n\n"
                "Ejemplo FUNNEL (embudo de conversión):\n"
                "{\"chart_id\":\"funnel_adop\",\"chart_type\":\"funnel\",\"title\":\"Embudo de adopción\","
                "\"x_key\":\"etapa\",\"y_keys\":[{\"key\":\"usuarios\",\"label\":\"Usuarios\",\"color\":\"#0098AA\"}],"
                "\"data\":[{\"etapa\":\"Enterados\",\"usuarios\":5200},{\"etapa\":\"Registrados\",\"usuarios\":2100},"
                "{\"etapa\":\"Activos\",\"usuarios\":834}]}\n\n"
                "Ejemplo WATERFALL (ingresos → costos → neto):\n"
                "{\"chart_id\":\"waterfall_q1\",\"chart_type\":\"waterfall\",\"title\":\"Desglose Financiero Q1\","
                "\"x_key\":\"concepto\",\"y_keys\":[{\"key\":\"monto\",\"label\":\"MUSD\",\"color\":\"#0072B1\"}],"
                "\"data\":[{\"concepto\":\"Ingresos\",\"monto\":1200},{\"concepto\":\"Costos Op\",\"monto\":-650},"
                "{\"concepto\":\"Impuestos\",\"monto\":-95},{\"concepto\":\"Neto\",\"monto\":455}]}\n\n"
                "Ejemplo STACKED_AREA (volúmenes apilados en el tiempo):\n"
                "{\"chart_id\":\"trafico_sem\",\"chart_type\":\"stacked_area\",\"title\":\"Tráfico semanal\","
                "\"x_key\":\"dia\","
                "\"y_keys\":[{\"key\":\"desktop\",\"label\":\"Desktop\",\"color\":\"#0072B1\"},"
                "{\"key\":\"mobile\",\"label\":\"Mobile\",\"color\":\"#F4A261\"}],"
                "\"data\":[{\"dia\":\"Lun\",\"desktop\":320,\"mobile\":210},"
                "{\"dia\":\"Mar\",\"desktop\":380,\"mobile\":240}]}\n\n"
                "Ejemplo RADAR (multi-dimensional):\n"
                "{\"chart_id\":\"radar_div\",\"chart_type\":\"radar\",\"title\":\"Benchmark divisiones\","
                "\"x_key\":\"metrica\","
                "\"y_keys\":[{\"key\":\"norte\",\"label\":\"Norte\",\"color\":\"#0072B1\"},"
                "{\"key\":\"sur\",\"label\":\"Sur\",\"color\":\"#E55302\"}],"
                "\"data\":[{\"metrica\":\"Producción\",\"norte\":90,\"sur\":78},"
                "{\"metrica\":\"Seguridad\",\"norte\":85,\"sur\":92},"
                "{\"metrica\":\"Costos\",\"norte\":70,\"sur\":80}]}"
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "chart_id": {"type": "string", "description": "ID único (ej: 'prod_cu_mensual')"},
                    "chart_type": {
                        "type": "string",
                        "enum": ["bar", "line", "pie", "area", "donut", "stacked_area", "stacked_bar", "waterfall"],
                        "description": "bar=categorías · line=tendencias · pie/donut=proporciones · area/stacked_area=volúmenes · stacked_bar=composición · waterfall=acumulativo",
                    },
                    "title": {"type": "string", "description": "Título del gráfico"},
                    "description": {"type": "string", "description": "Subtítulo opcional"},
                    "x_key": {"type": "string", "description": "Columna del eje X (categorías o fechas)"},
                    "data": {
                        "type": "array",
                        "description": "Filas del dataset (cada objeto debe incluir x_key y las columnas de y_keys)",
                        "items": {"type": "object"},
                    },
                    "y_keys": {
                        "type": "array",
                        "description": "Series. Omitir para auto-detectar columnas numéricas.",
                        "items": {
                            "type": "object",
                            "properties": {
                                "key": {"type": "string"},
                                "label": {"type": "string"},
                                "color": {"type": "string", "description": "Hex ej '#0072B1'"},
                                "unit": {"type": "string"},
                                "axis": {"type": "string", "enum": ["left", "right"]},
                            },
                            "required": ["key", "label"],
                        },
                    },
                    "filters": {
                        "type": "array",
                        "description": "Filtros interactivos opcionales",
                        "items": {
                            "type": "object",
                            "properties": {
                                "id": {"type": "string"},
                                "label": {"type": "string"},
                                "type": {"type": "string", "enum": ["radio", "dropdown"]},
                                "key_to_filter": {"type": "string"},
                                "options": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {"id": {"type": "string"}, "label": {"type": "string"}},
                                        "required": ["id", "label"],
                                    },
                                },
                                "default": {"type": "string"},
                            },
                            "required": ["id", "label", "type", "key_to_filter", "options", "default"],
                        },
                    },
                    "on_click_message": {"type": "string", "description": "Template con {x_value}/{y_value}"},
                    "selectable": {"type": "boolean"},
                },
                "required": ["chart_id", "chart_type", "title", "x_key", "data"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_dashboard_data",
            "description": (
                "Renderiza un dashboard interactivo con MÚLTIPLES paneles HETEROGÉNEOS. "
                "Se muestra automáticamente — NO copies bloques. Úsala cuando el usuario pida "
                "'dashboard', 'resumen ejecutivo', 'overview', 'panel integral' o tengas 3+ métricas diversas.\n\n"
                "REGLA CLAVE: un dashboard bueno MEZCLA tipos de panel — típicamente 3-4 KPIs + 2-3 "
                "charts de tipos distintos (radar, funnel, treemap, bar) + 1 tabla. NO generes un "
                "dashboard con puros bars repetidos: eso no es un dashboard, es un chart mal envuelto.\n\n"
                "Ejemplo Plataforma IA (dashboard operacional mixto, 8 paneles, layout.columns=3):\n"
                "{\"dashboard_id\":\"dash_ops_q1\",\"title\":\"Dashboard Operacional — Q1 2026\","
                "\"layout_columns\":3,\"panels\":["
                "{\"id\":\"k1\",\"type\":\"kpi\",\"title\":\"Producción Cu\",\"span\":1,"
                "\"kpi\":{\"value\":245680,\"label\":\"toneladas\",\"format\":\"number\","
                "\"trend\":{\"direction\":\"up\",\"value\":\"+5.2%\"}}},"
                "{\"id\":\"k2\",\"type\":\"kpi\",\"title\":\"Costo USD/lb\",\"span\":1,"
                "\"kpi\":{\"value\":1.85,\"label\":\"USD/lb\",\"format\":\"currency\","
                "\"trend\":{\"direction\":\"down\",\"value\":\"-3.1%\"}}},"
                "{\"id\":\"k3\",\"type\":\"kpi\",\"title\":\"Disponibilidad\",\"span\":1,"
                "\"kpi\":{\"value\":0.942,\"label\":\"planta\",\"format\":\"percentage\","
                "\"trend\":{\"direction\":\"up\",\"value\":\"+1.8%\"}}},"
                "{\"id\":\"p_radar\",\"type\":\"radar\",\"title\":\"Benchmark Divisiones\",\"span\":2,"
                "\"x_key\":\"metrica\","
                "\"y_keys\":[{\"key\":\"norte\",\"label\":\"Norte\",\"color\":\"#0072B1\"},"
                "{\"key\":\"sur\",\"label\":\"Sur\",\"color\":\"#E55302\"}],"
                "\"data\":[{\"metrica\":\"Producción\",\"norte\":90,\"sur\":78},"
                "{\"metrica\":\"Seguridad\",\"norte\":85,\"sur\":92}]},"
                "{\"id\":\"p_funnel\",\"type\":\"funnel\",\"title\":\"Adopción IA\",\"span\":1,"
                "\"x_key\":\"etapa\","
                "\"y_keys\":[{\"key\":\"n\",\"label\":\"Usuarios\",\"color\":\"#0098AA\"}],"
                "\"data\":[{\"etapa\":\"Registrados\",\"n\":3400},{\"etapa\":\"Activos\",\"n\":1834}]},"
                "{\"id\":\"p_bar\",\"type\":\"bar\",\"title\":\"Producción por Metal\",\"span\":1,"
                "\"x_key\":\"metal\","
                "\"y_keys\":[{\"key\":\"prod\",\"label\":\"Toneladas\",\"color\":\"#0072B1\"}],"
                "\"data\":[{\"metal\":\"Cobre\",\"prod\":245680},{\"metal\":\"Molibdeno\",\"prod\":12400}]},"
                "{\"id\":\"p_treemap\",\"type\":\"treemap\",\"title\":\"Distribución Costos\",\"span\":1,"
                "\"x_key\":\"area\","
                "\"y_keys\":[{\"key\":\"costo\",\"label\":\"MUSD\",\"color\":\"#E55302\"}],"
                "\"data\":[{\"area\":\"Mina\",\"costo\":450},{\"area\":\"Planta\",\"costo\":320}]},"
                "{\"id\":\"p_table\",\"type\":\"table\",\"title\":\"Últimos Eventos\",\"span\":1,"
                "\"table_columns\":[{\"key\":\"evento\",\"label\":\"Evento\"},"
                "{\"key\":\"fecha\",\"label\":\"Fecha\"},{\"key\":\"estado\",\"label\":\"Estado\"}],"
                "\"data\":[{\"evento\":\"Mantención SAG\",\"fecha\":\"2026-03-12\",\"estado\":\"Completado\"},"
                "{\"evento\":\"Inspección\",\"fecha\":\"2026-03-14\",\"estado\":\"En curso\"}]}"
                "]}"
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "dashboard_id": {"type": "string"},
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "layout_columns": {"type": "integer", "description": "1-4 columnas (default 2)"},
                    "panels": {
                        "type": "array",
                        "description": (
                            "Cada panel tiene type entre: bar, stacked_bar, line, area, stacked_area, pie, donut, radar, "
                            "treemap, funnel, waterfall, kpi, table. Charts usan x_key+y_keys+data. "
                            "KPI usa `kpi: {value,label,trend,format}`. Table usa `table_columns: [{key,label}]` + data."
                        ),
                        "items": {
                            "type": "object",
                            "properties": {
                                "id": {"type": "string"},
                                "type": {
                                    "type": "string",
                                    "enum": ["bar", "line", "pie", "area", "donut", "stacked_area",
                                             "stacked_bar", "waterfall", "kpi", "table"],
                                },
                                "title": {"type": "string"},
                                "description": {"type": "string"},
                                "span": {"type": "integer", "description": "Columnas que ocupa (1-4)"},
                                "x_key": {"type": "string"},
                                "data": {"type": "array", "items": {"type": "object"}},
                                "y_keys": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "key": {"type": "string"},
                                            "label": {"type": "string"},
                                            "color": {"type": "string"},
                                            "unit": {"type": "string"},
                                        },
                                        "required": ["key", "label"],
                                    },
                                },
                                "kpi": {
                                    "type": "object",
                                    "properties": {
                                        "value": {},
                                        "label": {"type": "string"},
                                        "format": {"type": "string", "enum": ["number", "currency", "percentage"]},
                                        "trend": {
                                            "type": "object",
                                            "properties": {
                                                "direction": {"type": "string", "enum": ["up", "down", "flat"]},
                                                "value": {"type": "string"},
                                                "label": {"type": "string"},
                                            },
                                            "required": ["direction", "value"],
                                        },
                                    },
                                    "required": ["value", "label"],
                                },
                                "table_columns": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {"key": {"type": "string"}, "label": {"type": "string"}},
                                        "required": ["key", "label"],
                                    },
                                },
                            },
                            "required": ["id", "type", "title"],
                        },
                    },
                    "filters": {
                        "type": "array",
                        "description": "Filtros compartidos (slicers)",
                        "items": {"type": "object"},
                    },
                },
                "required": ["dashboard_id", "title", "panels"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_kpi_data",
            "description": (
                "Renderiza tarjetas KPI. Se muestran automáticamente — NO copies bloques. "
                "Preferir sobre dashboard cuando solo hay 2-6 indicadores sin gráficos.\n\n"
                "Campos por tarjeta: label, value, format (number|currency|percentage|compact), "
                "unit, icon (lucide ej Factory/DollarSign/Target), color (turquesa|azul|naranja|"
                "verde-oscuro|amarillo|rojo), trend {direction,value,label}, sparkline (6-12 "
                "números), target {value,label}, comparison {value,label}.\n\n"
                "Ejemplo Plataforma IA rico (con sparkline, target, comparison — inclúyelos cuando los tengas):\n"
                "{\"kpi_id\":\"kpis_prod_q1\",\"title\":\"Indicadores de Producción Q1 2026\",\"columns\":3,"
                "\"cards\":["
                "{\"label\":\"Producción Cu\",\"value\":245680,\"format\":\"number\",\"unit\":\"toneladas\","
                "\"icon\":\"Factory\",\"color\":\"turquesa\","
                "\"trend\":{\"direction\":\"up\",\"value\":\"+5.2%\",\"label\":\"vs Q4 2025\"},"
                "\"comparison\":{\"value\":233500,\"label\":\"Q4 2025\"},"
                "\"sparkline\":[220000,225000,231000,228000,240000,238000,245680]},"
                "{\"label\":\"Costo Operacional\",\"value\":1.85,\"format\":\"currency\",\"unit\":\"USD/lb\","
                "\"icon\":\"DollarSign\",\"color\":\"naranja\","
                "\"trend\":{\"direction\":\"down\",\"value\":\"-3.1%\",\"label\":\"vs Q4 2025\"},"
                "\"sparkline\":[2.1,2.05,1.98,1.92,1.88,1.85]},"
                "{\"label\":\"Disponibilidad Planta\",\"value\":0.942,\"format\":\"percentage\","
                "\"icon\":\"Target\",\"color\":\"verde-oscuro\","
                "\"trend\":{\"direction\":\"up\",\"value\":\"+1.8%\",\"label\":\"vs Q4 2025\"},"
                "\"target\":{\"value\":0.95,\"label\":\"Meta Q1\"}}"
                "]}"
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "kpi_id": {"type": "string"},
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "columns": {"type": "integer", "description": "1-4 columnas (default 3)"},
                    "cards": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "id": {"type": "string"},
                                "label": {"type": "string"},
                                "value": {"description": "número o string formateado"},
                                "format": {"type": "string", "enum": ["number", "currency", "percentage", "compact"]},
                                "unit": {"type": "string"},
                                "icon": {"type": "string", "description": "lucide-react ej Factory, DollarSign"},
                                "color": {"type": "string", "description": "turquesa|azul|naranja|verde-oscuro|amarillo|rojo"},
                                "trend": {
                                    "type": "object",
                                    "properties": {
                                        "direction": {"type": "string", "enum": ["up", "down", "flat"]},
                                        "value": {"type": "string"},
                                        "label": {"type": "string"},
                                    },
                                    "required": ["direction", "value"],
                                },
                                "comparison": {
                                    "type": "object",
                                    "properties": {"value": {}, "label": {"type": "string"}},
                                    "required": ["value", "label"],
                                },
                                "sparkline": {"type": "array", "items": {"type": "number"}},
                                "target": {
                                    "type": "object",
                                    "properties": {"value": {"type": "number"}, "label": {"type": "string"}},
                                    "required": ["value", "label"],
                                },
                            },
                            "required": ["label", "value"],
                        },
                    },
                },
                "required": ["kpi_id", "title", "cards"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_infographic_data",
            "description": (
                "OBLIGATORIA ante palabras: mapa mental, mind map, brainstorm, lluvia de ideas, "
                "diagrama de flujo, workflow, organigrama, jerarquía, timeline, cronología, "
                "mapa conceptual, roadmap, hitos. Subtipos: flowchart, mindmap, orgchart, "
                "timeline, conceptmap. Renderiza automáticamente — NO ASCII art ni mermaid.\n\n"
                "Ejemplo FLOWCHART (aprobación de contratos):\n"
                "{\"infographic_id\":\"flujo_contrato\",\"infographic_type\":\"flowchart\","
                "\"title\":\"Aprobación de contratos\",\"direction\":\"TB\","
                "\"nodes\":["
                "{\"id\":\"n1\",\"label\":\"Solicitud\",\"category\":\"start\",\"icon\":\"FileText\"},"
                "{\"id\":\"n2\",\"label\":\"Revisión legal\",\"category\":\"process\",\"icon\":\"Scale\"},"
                "{\"id\":\"n3\",\"label\":\"¿Monto > 500 UF?\",\"category\":\"decision\"},"
                "{\"id\":\"n4\",\"label\":\"VP aprueba\",\"category\":\"process\",\"icon\":\"UserCheck\"},"
                "{\"id\":\"n5\",\"label\":\"Firma\",\"category\":\"end\",\"icon\":\"PenLine\"}"
                "],\"edges\":["
                "{\"source\":\"n1\",\"target\":\"n2\"},{\"source\":\"n2\",\"target\":\"n3\"},"
                "{\"source\":\"n3\",\"target\":\"n4\",\"label\":\"Sí\"},"
                "{\"source\":\"n3\",\"target\":\"n5\",\"label\":\"No\"},"
                "{\"source\":\"n4\",\"target\":\"n5\"}"
                "]}\n\n"
                "Ejemplo MINDMAP (aplicaciones de IA):\n"
                "{\"infographic_id\":\"mapa_ia\",\"infographic_type\":\"mindmap\","
                "\"title\":\"IA en Plataforma IA — Áreas\",\"direction\":\"LR\","
                "\"nodes\":["
                "{\"id\":\"center\",\"label\":\"IA Plataforma IA\",\"icon\":\"Cpu\",\"category\":\"start\"},"
                "{\"id\":\"ops\",\"label\":\"Operaciones\",\"category\":\"process\"},"
                "{\"id\":\"mant\",\"label\":\"Mantenimiento\",\"category\":\"process\"},"
                "{\"id\":\"seg\",\"label\":\"Seguridad\",\"category\":\"process\"},"
                "{\"id\":\"pred\",\"label\":\"Predictivo SAG\",\"category\":\"info\"},"
                "{\"id\":\"vib\",\"label\":\"Análisis Vibraciones\",\"category\":\"info\"}"
                "],\"edges\":["
                "{\"source\":\"center\",\"target\":\"ops\"},{\"source\":\"center\",\"target\":\"mant\"},"
                "{\"source\":\"center\",\"target\":\"seg\"},{\"source\":\"ops\",\"target\":\"pred\"},"
                "{\"source\":\"mant\",\"target\":\"vib\"}"
                "]}\n\n"
                "Ejemplo TIMELINE (roadmap):\n"
                "{\"infographic_id\":\"roadmap_2026\",\"infographic_type\":\"timeline\","
                "\"title\":\"Roadmap Plataforma IA 2026\",\"direction\":\"LR\","
                "\"nodes\":["
                "{\"id\":\"t1\",\"label\":\"Kick-off\",\"description\":\"Enero\",\"category\":\"start\"},"
                "{\"id\":\"t2\",\"label\":\"MVP Agentes\",\"description\":\"Marzo\",\"category\":\"process\"},"
                "{\"id\":\"t3\",\"label\":\"Piloto\",\"description\":\"Mayo\",\"category\":\"process\"},"
                "{\"id\":\"t4\",\"label\":\"Rollout\",\"description\":\"Octubre\",\"category\":\"end\"}"
                "],\"edges\":["
                "{\"source\":\"t1\",\"target\":\"t2\"},{\"source\":\"t2\",\"target\":\"t3\"},"
                "{\"source\":\"t3\",\"target\":\"t4\"}"
                "]}"
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "infographic_id": {"type": "string"},
                    "infographic_type": {
                        "type": "string",
                        "enum": ["flowchart", "orgchart", "timeline"],
                    },
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "direction": {"type": "string", "enum": ["TB", "LR", "BT", "RL"]},
                    "nodes": {
                        "type": "array",
                        "description": "Máximo 15-20 nodos",
                        "items": {
                            "type": "object",
                            "properties": {
                                "id": {"type": "string"},
                                "label": {"type": "string", "description": "Máx 40 chars"},
                                "description": {"type": "string", "description": "Máx 80 chars"},
                                "icon": {"type": "string"},
                                "category": {"type": "string", "enum": ["start", "process", "decision", "end", "info", "warning"]},
                                "color": {"type": "string"},
                            },
                            "required": ["id", "label"],
                        },
                    },
                    "edges": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "id": {"type": "string"},
                                "source": {"type": "string"},
                                "target": {"type": "string"},
                                "label": {"type": "string"},
                                "style": {"type": "string", "enum": ["solid", "dashed", "dotted"]},
                            },
                            "required": ["source", "target"],
                        },
                    },
                },
                "required": ["infographic_id", "infographic_type", "title", "nodes", "edges"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_widget_data",
            "description": (
                "Renderiza widgets especializados: gauge, stepper, comparison, accordion, checklist, "
                "ranking, swot, risk_matrix, kanban. Se muestra automáticamente.\n\n"
                "PALABRAS → widget_type:\n"
                "  FODA/SWOT → swot | kanban/tablero de tareas → kanban\n"
                "  gauge/medidor/velocímetro → gauge | matriz de riesgo → risk_matrix\n"
                "  checklist/pendientes → checklist | ranking/top N → ranking\n"
                "  comparar X vs Y → comparison | FAQ/acordeón → accordion\n"
                "  stepper/pasos → stepper\n\n"
                "Ejemplo SWOT (FODA de negocio cobre):\n"
                "{\"widget_id\":\"foda_cobre\",\"widget_type\":\"swot\",\"title\":\"FODA Negocio Cobre 2026\","
                "\"data\":{\"swot\":{"
                "\"strengths\":[\"Reservas de largo plazo\",\"Experiencia operacional\",\"Escala global\"],"
                "\"weaknesses\":[\"Leyes declinantes\",\"Costos de energía\"],"
                "\"opportunities\":[\"Demanda por transición energética\",\"Litio en salares\"],"
                "\"threats\":[\"Regulación ambiental\",\"Volatilidad precios LME\"]"
                "}}}\n\n"
                "Ejemplo RANKING (top agentes por adopción):\n"
                "{\"widget_id\":\"rank_agentes\",\"widget_type\":\"ranking\","
                "\"title\":\"Top Agentes por Adopción — Q1 2026\","
                "\"data\":{\"items\":["
                "{\"label\":\"Agente Minero\",\"value\":1834,\"unit\":\"usuarios\",\"icon\":\"HardHat\","
                "\"color\":\"turquesa\",\"change\":22},"
                "{\"label\":\"Agente Legal\",\"value\":1245,\"unit\":\"usuarios\",\"icon\":\"Shield\","
                "\"color\":\"azul\",\"change\":15},"
                "{\"label\":\"Agente RRHH\",\"value\":987,\"unit\":\"usuarios\",\"icon\":\"Users\","
                "\"color\":\"naranja\",\"change\":-3}"
                "]}}\n\n"
                "Ejemplo RISK_MATRIX:\n"
                "{\"widget_id\":\"riesgos_op\",\"widget_type\":\"risk_matrix\","
                "\"title\":\"Riesgos operacionales Q1\","
                "\"data\":{\"risks\":["
                "{\"label\":\"Falla molino SAG\",\"likelihood\":3,\"impact\":5,"
                "\"description\":\"Parada no programada\"},"
                "{\"label\":\"Derrame relave\",\"likelihood\":2,\"impact\":5},"
                "{\"label\":\"Ausentismo turno\",\"likelihood\":4,\"impact\":2}"
                "]}}\n\n"
                "Ejemplo GAUGE (medidores):\n"
                "{\"widget_id\":\"gauge_ops\",\"widget_type\":\"gauge\","
                "\"title\":\"Indicadores Operacionales\","
                "\"data\":{\"gauges\":["
                "{\"label\":\"Disponibilidad Planta\",\"value\":94.2,\"min\":0,\"max\":100,"
                "\"unit\":\"%\",\"color\":\"turquesa\",\"target\":95},"
                "{\"label\":\"Eficiencia Molienda\",\"value\":87.5,\"min\":0,\"max\":100,"
                "\"unit\":\"%\",\"color\":\"azul\"}"
                "]}}\n\n"
                "Ejemplo KANBAN (backlog de agentes):\n"
                "{\"widget_id\":\"kanban_backlog\",\"widget_type\":\"kanban\","
                "\"title\":\"Backlog de Agentes IA\","
                "\"data\":{\"columns\":["
                "{\"title\":\"Por Hacer\",\"color\":\"azul\",\"cards\":["
                "{\"title\":\"Agente de Inventario\",\"priority\":\"high\",\"assignee\":\"Carlos M.\"}]},"
                "{\"title\":\"En Progreso\",\"color\":\"turquesa\",\"cards\":["
                "{\"title\":\"Agente Geológico\",\"priority\":\"high\",\"assignee\":\"Ana P.\"}]},"
                "{\"title\":\"Completado\",\"color\":\"verde-oscuro\",\"cards\":["
                "{\"title\":\"Agente Minero v2\",\"priority\":\"low\",\"assignee\":\"Jorge T.\"}]}"
                "]}}"
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "widget_id": {"type": "string"},
                    "widget_type": {
                        "type": "string",
                        "enum": ["comparison", "checklist", "ranking", "swot", "risk_matrix"],
                    },
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "data": {
                        "type": "object",
                        "description": (
                            "Campos según widget_type:\n"
                            "- gauge: {gauges:[{label,value,min,max,unit,color,target}]}\n"
                            "- stepper: {steps:[{label,status:'completed|active|pending|error',description}]}\n"
                            "- comparison: {options:[{title,features:[{label,value}],badge}]}\n"
                            "- accordion: {items:[{title,content,defaultOpen}]}\n"
                            "- checklist: {items:[{label,checked,priority:'high|medium|low'}]}\n"
                            "- ranking: {items:[{label,value,unit,change}]}\n"
                            "- swot: {swot:{strengths:[...],weaknesses:[...],opportunities:[...],threats:[...]}}\n"
                            "- risk_matrix: {risks:[{label,likelihood:1-5,impact:1-5}]}\n"
                            "- kanban: {columns:[{title,cards:[{title,description,priority}]}]}"
                        ),
                    },
                },
                "required": ["widget_id", "widget_type", "title", "data"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "inspect_csv",
            "description": "PASO OBLIGATORIO antes de responder cualquier pregunta sobre un archivo CSV. Inspecciona la estructura del CSV sin cargar todos los datos. Auto-detecta delimitador y encoding. Retorna columnas, tipos, estadísticas y muestra. DEBES usar esta herramienta ANTES de read_from_csv.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filename": {
                        "type": "string",
                        "description": "Nombre del archivo CSV a inspeccionar"
                    },
                    "sample_rows": {
                        "type": "integer",
                        "description": "Filas de muestra (default 5, máx 20)"
                    },
                    "delimiter": {
                        "type": "string",
                        "description": "Delimitador (auto-detecta si se omite)"
                    }
                },
                "required": ["filename"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "read_from_csv",
            "description": "Lee datos de un archivo CSV con filtros, paginación y selección de columnas. SIEMPRE usa inspect_csv PRIMERO. Misma funcionalidad que read_from_excel pero para archivos CSV.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filename": {
                        "type": "string",
                        "description": "Nombre del archivo CSV"
                    },
                    "columns": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Columnas a retornar (match parcial)"
                    },
                    "max_rows": {
                        "type": "integer",
                        "description": "Máximo de filas (default 100, máx 5000)"
                    },
                    "delimiter": {
                        "type": "string",
                        "description": "Delimitador (auto-detecta si se omite)"
                    },
                    "offset": {
                        "type": "integer",
                        "description": "Filas a saltar para paginación"
                    },
                    "filters": {
                        "type": "string",
                        "description": "JSON con filtros: [{\"column\":\"Col\",\"op\":\"equals\",\"value\":\"X\"}]"
                    },
                    "date_column": {"type": "string", "description": "Columna de fecha para filtrar"},
                    "date_from": {"type": "string", "description": "Fecha inicio (YYYY-MM-DD)"},
                    "date_to": {"type": "string", "description": "Fecha fin (YYYY-MM-DD)"},
                    "business_days_only": {"type": "boolean", "description": "Excluir fines de semana"}
                },
                "required": ["filename"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "summarize_data",
            "description": "Calcula estadísticas descriptivas completas (min, max, mean, median, std, sum, percentiles, unique values) de un archivo Excel o CSV. Mucho más eficiente que leer todas las filas. Soporta agrupación por columna. Usar para obtener panorama general de los datos.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filename": {
                        "type": "string",
                        "description": "Nombre del archivo (Excel o CSV)"
                    },
                    "sheet_name": {
                        "type": "string",
                        "description": "Hoja específica (solo Excel)"
                    },
                    "columns": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Columnas a analizar (None = todas)"
                    },
                    "group_by": {
                        "type": "string",
                        "description": "Columna para agrupar estadísticas (ej: 'División')"
                    }
                },
                "required": ["filename"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "aggregate_data",
            "description": "Agrupa y agrega datos (GroupBy/Pivot) de un archivo Excel o CSV. El resultado es compatible con generate_chart_data. Usar cuando necesites totales, promedios o conteos por categoría.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filename": {
                        "type": "string",
                        "description": "Nombre del archivo (Excel o CSV)"
                    },
                    "group_by": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Columnas para agrupar"
                    },
                    "aggregations": {
                        "type": "string",
                        "description": "JSON con agregaciones: [{\"column\":\"Ventas\",\"function\":\"sum\"},{\"column\":\"Precio\",\"function\":\"mean\"}]. Funciones: sum, mean, median, min, max, count, count_distinct, first, last, std"
                    },
                    "sheet_name": {"type": "string", "description": "Hoja específica (solo Excel)"},
                    "sort_by": {"type": "string", "description": "Columna para ordenar resultado"},
                    "max_groups": {"type": "integer", "description": "Máximo de grupos (default 100)"},
                    "filters": {"type": "string", "description": "JSON con filtros previos a la agregación"}
                },
                "required": ["filename", "group_by", "aggregations"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "compare_files",
            "description": "Compara o cruza datos entre dos archivos Excel/CSV. Soporta merge (left join), diff (filas en A no en B), common (inner join), y stats_compare (estadísticas lado a lado). Esencial cuando hay múltiples archivos en la conversación.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filename_a": {"type": "string", "description": "Primer archivo"},
                    "filename_b": {"type": "string", "description": "Segundo archivo"},
                    "join_column": {"type": "string", "description": "Columna en común para unir"},
                    "comparison_type": {
                        "type": "string",
                        "enum": ["merge", "diff", "common", "stats_compare"],
                        "description": "merge=left join, diff=solo en A, common=inner join, stats_compare=estadísticas lado a lado"
                    },
                    "sheet_a": {"type": "string", "description": "Hoja del archivo A"},
                    "sheet_b": {"type": "string", "description": "Hoja del archivo B"},
                    "columns_a": {"type": "array", "items": {"type": "string"}, "description": "Columnas de A"},
                    "columns_b": {"type": "array", "items": {"type": "string"}, "description": "Columnas de B"}
                },
                "required": ["filename_a", "filename_b", "join_column", "comparison_type"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_in_file",
            "description": "Busca un valor en un archivo Excel o CSV. Retorna las filas que coinciden. Útil para encontrar registros específicos sin leer todo el archivo.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filename": {"type": "string", "description": "Nombre del archivo (Excel o CSV)"},
                    "search_term": {"type": "string", "description": "Valor a buscar"},
                    "sheet_name": {"type": "string", "description": "Hoja específica (solo Excel)"},
                    "columns": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Columnas donde buscar (None = todas)"
                    },
                    "match_type": {
                        "type": "string",
                        "enum": ["contains", "exact", "starts_with", "regex"],
                        "description": "Tipo: contains (default), exact, starts_with, regex"
                    },
                    "max_results": {"type": "integer", "description": "Máximo de resultados (default 500)"}
                },
                "required": ["filename", "search_term"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "batch_inspect",
            "description": "Inspecciona múltiples archivos (Excel y/o CSV) en UNA sola llamada. Mucho más eficiente que llamar inspect_excel/inspect_csv por separado. Usar cuando hay 2+ archivos en la conversación.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filenames": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Lista de nombres de archivos a inspeccionar"
                    }
                },
                "required": ["filenames"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "save_to_csv",
            "description": "Guarda datos en un archivo CSV. Complemento de save_to_excel para cuando se necesita formato CSV.",
            "parameters": {
                "type": "object",
                "properties": {
                    "data": {
                        "type": "string",
                        "description": "Datos en formato JSON string (lista de objetos)"
                    },
                    "filename": {
                        "type": "string",
                        "description": "Nombre del archivo CSV (opcional)"
                    },
                    "delimiter": {
                        "type": "string",
                        "description": "Delimitador (default ',')"
                    }
                },
                "required": ["data"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "transform_column",
            "description": "Aplica transformaciones a columnas de un archivo Excel/CSV: renombrar, eliminar, crear columnas calculadas, convertir tipos, limpiar datos, ordenar, deduplicar. Guarda el resultado como archivo nuevo.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filename": {"type": "string", "description": "Archivo origen (Excel o CSV)"},
                    "operations": {
                        "type": "string",
                        "description": "JSON con operaciones: [{\"op\":\"rename\",\"column\":\"Viejo\",\"new_name\":\"Nuevo\"}, {\"op\":\"delete\",\"columns\":[\"Col1\"]}, {\"op\":\"add_calculated\",\"new_column\":\"Total\",\"formula\":\"col1 + col2\"}, {\"op\":\"fill_null\",\"column\":\"Col\",\"value\":0}, {\"op\":\"to_number\",\"column\":\"Monto\"}, {\"op\":\"to_date\",\"column\":\"Fecha\",\"format\":\"%d/%m/%Y\"}, {\"op\":\"to_uppercase\",\"column\":\"Nombre\"}, {\"op\":\"to_lowercase\",\"column\":\"Email\"}, {\"op\":\"trim\",\"column\":\"Texto\"}, {\"op\":\"replace\",\"column\":\"Col\",\"old\":\"A\",\"new\":\"B\"}, {\"op\":\"sort\",\"column\":\"Fecha\",\"ascending\":true}, {\"op\":\"drop_duplicates\",\"columns\":[\"RUT\"]}, {\"op\":\"drop_nulls\",\"columns\":[\"Monto\"]}]"
                    },
                    "sheet_name": {"type": "string", "description": "Hoja (solo Excel)"},
                    "output_filename": {"type": "string", "description": "Nombre del archivo resultado (default: _transformed)"}
                },
                "required": ["filename", "operations"]
            }
        }
    }
]


# ── Herramientas de integración (Outlook + Jira) ─────────────────

INTEGRATION_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "read_emails",
            "description": "Lee emails del usuario desde Microsoft Outlook. Requiere que el usuario haya conectado su cuenta de Outlook desde el panel de Integraciones.",
            "parameters": {
                "type": "object",
                "properties": {
                    "folder": {
                        "type": "string",
                        "description": "Carpeta de email: inbox, sentitems, drafts. Default: inbox",
                        "default": "inbox"
                    },
                    "top": {
                        "type": "integer",
                        "description": "Cantidad máxima de emails a leer (default 10, max 50)",
                        "default": 10
                    },
                    "search": {
                        "type": "string",
                        "description": "Término de b��squeda opcional para filtrar emails"
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "send_email",
            "description": "Envía un email desde la cuenta de Outlook del usuario. Requiere que el usuario haya conectado su cuenta de Outlook.",
            "parameters": {
                "type": "object",
                "properties": {
                    "to": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Lista de direcciones de email destinatarias"
                    },
                    "subject": {
                        "type": "string",
                        "description": "Asunto del email"
                    },
                    "body": {
                        "type": "string",
                        "description": "Cuerpo del email en texto plano"
                    },
                    "cc": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Lista de direcciones en copia (opcional)"
                    }
                },
                "required": ["to", "subject", "body"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_calendar_events",
            "description": "Obtiene eventos del calendario de Outlook del usuario en un rango de fechas. Requiere que el usuario haya conectado su cuenta de Outlook.",
            "parameters": {
                "type": "object",
                "properties": {
                    "start": {
                        "type": "string",
                        "description": "Fecha/hora de inicio en formato ISO 8601 (ej: 2026-04-11T00:00:00)"
                    },
                    "end": {
                        "type": "string",
                        "description": "Fecha/hora de fin en formato ISO 8601 (ej: 2026-04-12T23:59:59)"
                    },
                    "top": {
                        "type": "integer",
                        "description": "Cantidad máxima de eventos (default 20, max 50)",
                        "default": 20
                    }
                },
                "required": ["start", "end"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_jira_issues",
            "description": "Busca issues en Jira usando JQL. Requiere que el usuario haya conectado su cuenta de Jira desde el panel de Integraciones.",
            "parameters": {
                "type": "object",
                "properties": {
                    "jql": {
                        "type": "string",
                        "description": "Query JQL para buscar issues. Default: issues asignados al usuario ordenados por actualización",
                        "default": "assignee = currentUser() ORDER BY updated DESC"
                    },
                    "max_results": {
                        "type": "integer",
                        "description": "Cantidad máxima de issues (default 20, max 50)",
                        "default": 20
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_jira_issue",
            "description": "Crea un nuevo issue en Jira. Requiere que el usuario haya conectado su cuenta de Jira.",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_key": {
                        "type": "string",
                        "description": "Clave del proyecto Jira (ej: PLATAFORMAIA, INGEST)"
                    },
                    "summary": {
                        "type": "string",
                        "description": "Título/resumen del issue"
                    },
                    "description": {
                        "type": "string",
                        "description": "Descripción detallada del issue"
                    },
                    "issue_type": {
                        "type": "string",
                        "description": "Tipo de issue: Task, Bug, Story, Epic. Default: Task",
                        "default": "Task"
                    }
                },
                "required": ["project_key", "summary", "description"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "add_jira_comment",
            "description": "Agrega un comentario a un issue de Jira existente. Requiere que el usuario haya conectado su cuenta de Jira.",
            "parameters": {
                "type": "object",
                "properties": {
                    "issue_key": {
                        "type": "string",
                        "description": "Clave del issue (ej: PLATAFORMAIA-123)"
                    },
                    "body": {
                        "type": "string",
                        "description": "Texto del comentario"
                    }
                },
                "required": ["issue_key", "body"]
            }
        }
    },
]


# ── Funciones async de integración ───────────────────────────────

async def _get_outlook_token(user_email: str) -> Optional[str]:
    """Get a valid Outlook access token, auto-refreshing if needed."""
    from app.services.integration_service import integration_service
    from app.services.outlook_service import outlook_service as _outlook

    token = integration_service.get_decrypted_access_token(user_email, "outlook")
    if token:
        return token

    # Try refresh
    refresh = integration_service.get_decrypted_refresh_token(user_email, "outlook")
    if not refresh:
        return None

    try:
        from datetime import timedelta, timezone
        token_data = await _outlook.refresh_token(refresh)
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=token_data.get("expires_in", 3600))
        integration_service.update_tokens(
            user_email, "outlook",
            token_data["access_token"],
            token_data.get("refresh_token", refresh),
            expires_at,
        )
        return token_data["access_token"]
    except Exception as e:
        logger.error(f"Error refreshing Outlook token: {e}")
        return None


async def _get_jira_token_and_cloud_id(user_email: str) -> Optional[tuple]:
    """Get valid Jira access token + cloud_id, auto-refreshing if needed."""
    from app.services.integration_service import integration_service
    from app.services.jira_service import jira_service as _jira

    doc = integration_service.get_integration(user_email, "jira")
    if not doc:
        return None

    cloud_id = doc.get("service_metadata", {}).get("cloud_id")
    if not cloud_id:
        return None

    token = integration_service.get_decrypted_access_token(user_email, "jira")
    if token:
        return token, cloud_id

    # Try refresh
    refresh = integration_service.get_decrypted_refresh_token(user_email, "jira")
    if not refresh:
        return None

    try:
        from datetime import timedelta, timezone
        token_data = await _jira.refresh_token(refresh)
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=token_data.get("expires_in", 3600))
        integration_service.update_tokens(
            user_email, "jira",
            token_data["access_token"],
            token_data.get("refresh_token", refresh),
            expires_at,
        )
        return token_data["access_token"], cloud_id
    except Exception as e:
        logger.error(f"Error refreshing Jira token: {e}")
        return None


async def read_emails(
    user_email: str,
    folder: str = "inbox",
    top: int = 10,
    search: Optional[str] = None,
) -> Dict[str, Any]:
    """Lee emails de Outlook del usuario."""
    token = await _get_outlook_token(user_email)
    if not token:
        return {"success": False, "error": "Outlook no está conectado. Pide al usuario que conecte su cuenta desde el panel de Integraciones."}
    from app.services.outlook_service import outlook_service as _outlook
    try:
        emails = await _outlook.read_emails(token, folder, top, search)
        return {"success": True, "count": len(emails), "emails": emails}
    except Exception as e:
        return {"success": False, "error": f"Error leyendo emails: {str(e)}"}


async def send_email(
    user_email: str,
    to: List[str] = None,
    subject: str = "",
    body: str = "",
    cc: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Envía un email desde Outlook del usuario."""
    token = await _get_outlook_token(user_email)
    if not token:
        return {"success": False, "error": "Outlook no está conectado. Pide al usuario que conecte su cuenta desde el panel de Integraciones."}
    from app.services.outlook_service import outlook_service as _outlook
    try:
        result = await _outlook.send_email(token, to or [], subject, body, cc)
        return result
    except Exception as e:
        return {"success": False, "error": f"Error enviando email: {str(e)}"}


async def get_calendar_events(
    user_email: str,
    start: str = "",
    end: str = "",
    top: int = 20,
) -> Dict[str, Any]:
    """Obtiene eventos del calendario de Outlook."""
    token = await _get_outlook_token(user_email)
    if not token:
        return {"success": False, "error": "Outlook no está conectado. Pide al usuario que conecte su cuenta desde el panel de Integraciones."}
    from app.services.outlook_service import outlook_service as _outlook
    try:
        events = await _outlook.get_calendar_events(token, start, end, top)
        return {"success": True, "count": len(events), "events": events}
    except Exception as e:
        return {"success": False, "error": f"Error leyendo calendario: {str(e)}"}


async def get_jira_issues(
    user_email: str,
    jql: str = "assignee = currentUser() ORDER BY updated DESC",
    max_results: int = 20,
) -> Dict[str, Any]:
    """Busca issues en Jira."""
    result = await _get_jira_token_and_cloud_id(user_email)
    if not result:
        return {"success": False, "error": "Jira no está conectado. Pide al usuario que conecte su cuenta desde el panel de Integraciones."}
    token, cloud_id = result
    from app.services.jira_service import jira_service as _jira
    try:
        issues = await _jira.get_issues(token, cloud_id, jql, max_results)
        return {"success": True, "count": len(issues), "issues": issues}
    except Exception as e:
        return {"success": False, "error": f"Error buscando issues: {str(e)}"}


async def create_jira_issue(
    user_email: str,
    project_key: str = "",
    summary: str = "",
    description: str = "",
    issue_type: str = "Task",
) -> Dict[str, Any]:
    """Crea un issue en Jira."""
    result = await _get_jira_token_and_cloud_id(user_email)
    if not result:
        return {"success": False, "error": "Jira no está conectado. Pide al usuario que conecte su cuenta desde el panel de Integraciones."}
    token, cloud_id = result
    from app.services.jira_service import jira_service as _jira
    try:
        issue = await _jira.create_issue(token, cloud_id, project_key, summary, description, issue_type)
        return {"success": True, **issue}
    except Exception as e:
        return {"success": False, "error": f"Error creando issue: {str(e)}"}


async def add_jira_comment(
    user_email: str,
    issue_key: str = "",
    body: str = "",
) -> Dict[str, Any]:
    """Agrega un comentario a un issue de Jira."""
    result = await _get_jira_token_and_cloud_id(user_email)
    if not result:
        return {"success": False, "error": "Jira no está conectado. Pide al usuario que conecte su cuenta desde el panel de Integraciones."}
    token, cloud_id = result
    from app.services.jira_service import jira_service as _jira
    try:
        comment = await _jira.add_comment(token, cloud_id, issue_key, body)
        return {"success": True, **comment}
    except Exception as e:
        return {"success": False, "error": f"Error agregando comentario: {str(e)}"}


# Definición de herramientas de generación de PDF (formato OpenAI)
PDF_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "generate_pdf_report",
            "description": (
                "Genera un reporte PDF corporativo Plataforma IA desde una spec declarativa. "
                "Úsalo para informes ejecutivos, memos, actas, cotizaciones, análisis o "
                "cualquier entregable formal que el usuario pida en formato PDF. "
                "Produce un archivo con portada branded, encabezado/pie repetidos, "
                "KPIs con tendencia, tablas, bullets y saltos de página controlados.\n\n"
                "Ejemplo mínimo:\n"
                "{\"filename\":\"informe_marzo.pdf\",\"title\":\"Informe de producción\","
                "\"subtitle\":\"Marzo 2026\",\"division\":\"Norte\",\"date\":\"2026-03-31\","
                "\"sections\":[{\"heading\":\"Resumen\",\"kpis\":["
                "{\"label\":\"Toneladas\",\"value\":\"82.5K\",\"trend\":\"up\"},"
                "{\"label\":\"USD MM\",\"value\":\"612\",\"trend\":\"up\"}],"
                "\"body\":\"La producción del mes superó la meta en 4%.\"},"
                "{\"heading\":\"Detalle por faena\",\"table\":{\"headers\":[\"Faena\",\"Ton\"],"
                "\"rows\":[[\"Chuquicamata\",\"45000\"],[\"Ministro Hales\",\"37500\"]]}}]}"
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "spec": {
                        "type": "object",
                        "description": "Spec declarativa del reporte PDF.",
                        "properties": {
                            "filename": {
                                "type": "string",
                                "pattern": r"^[\w\-. ]+\.pdf$",
                                "description": "Nombre del archivo (debe terminar en .pdf)."
                            },
                            "title": {
                                "type": "string",
                                "description": "Título principal del documento (aparece en la portada)."
                            },
                            "subtitle": {
                                "type": "string",
                                "description": "Subtítulo opcional."
                            },
                            "author": {"type": "string"},
                            "division": {
                                "type": "string",
                                "description": "División Plataforma IA (Norte, RT, Andina, El Teniente, Salvador, Ventanas)."
                            },
                            "date": {
                                "type": "string",
                                "description": "Fecha del documento (texto libre, ej. '31 de marzo de 2026')."
                            },
                            "sections": {
                                "type": "array",
                                "minItems": 1,
                                "maxItems": 40,
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "heading": {"type": "string"},
                                        "body": {
                                            "type": "string",
                                            "description": "Texto plano o con párrafos separados por doble salto de línea."
                                        },
                                        "bullets": {
                                            "type": "array",
                                            "items": {"type": "string"},
                                            "maxItems": 30
                                        },
                                        "kpis": {
                                            "type": "array",
                                            "maxItems": 8,
                                            "items": {
                                                "type": "object",
                                                "properties": {
                                                    "label": {"type": "string"},
                                                    "value": {"type": "string"},
                                                    "trend": {
                                                        "type": "string",
                                                        "enum": ["up", "down", "flat"]
                                                    },
                                                    "caption": {"type": "string"}
                                                },
                                                "required": ["label", "value"]
                                            }
                                        },
                                        "table": {
                                            "type": "object",
                                            "properties": {
                                                "caption": {"type": "string"},
                                                "headers": {
                                                    "type": "array",
                                                    "items": {"type": "string"},
                                                    "minItems": 1,
                                                    "maxItems": 12
                                                },
                                                "rows": {
                                                    "type": "array",
                                                    "items": {
                                                        "type": "array",
                                                        "items": {"type": "string"}
                                                    },
                                                    "maxItems": 200
                                                }
                                            },
                                            "required": ["headers"]
                                        },
                                        "page_break": {
                                            "type": "boolean",
                                            "description": "Si true, la sección empieza en página nueva."
                                        }
                                    }
                                }
                            }
                        },
                        "required": ["filename", "title", "sections"]
                    }
                },
                "required": ["spec"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "export_html_to_pdf",
            "description": (
                "Convierte un fragmento de HTML libre a PDF aplicando el CSS corporativo Plataforma IA. "
                "Úsalo SÓLO cuando generate_pdf_report no encaje (ej. plantillas muy custom). "
                "Prefiere generate_pdf_report para el 95% de los casos — garantiza branding consistente."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "html": {
                        "type": "string",
                        "description": "Cuerpo HTML válido (no página completa; se inyecta dentro de <main>)."
                    },
                    "filename": {
                        "type": "string",
                        "pattern": r"^[\w\-. ]+\.pdf$",
                        "description": "Nombre del archivo (opcional; se genera con timestamp si se omite)."
                    },
                    "title": {
                        "type": "string",
                        "description": "Título mostrado en el encabezado de cada página."
                    }
                },
                "required": ["html"]
            }
        }
    }
]


# Datalake lite: tools para archivos grandes (ingesta → SQL → export).
DATALAKE_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "ingest_file",
            "description": (
                "Ingesta un archivo tabular ya subido (CSV/TSV/XLSX/JSON/Parquet/gzipped) "
                "y lo convierte a Parquet canónico, retornando uno o más dataset_id "
                "(un dataset por hoja en Excel). Úsala cuando el usuario suba un archivo "
                "grande (>10k filas) o cuando necesites correr varias agregaciones SQL "
                "sobre el mismo archivo via query_dataset. Para lecturas puntuales "
                "de archivos pequeños, sigue usando read_from_excel / read_from_csv."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "filename": {
                        "type": "string",
                        "description": "Nombre del archivo ya presente en storage (uploads/ o generated/)."
                    }
                },
                "required": ["filename"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "query_dataset",
            "description": (
                "Ejecuta SQL DuckDB (SELECT-only) sobre un dataset previamente ingestado. "
                "La tabla del dataset se llama 'dataset'. Soporta agregaciones, joins, "
                "window functions, CTEs. Bloquea ATTACH, COPY, PRAGMA, INSTALL, LOAD, "
                "UPDATE, DELETE, INSERT, DROP y múltiples sentencias. Si el resultado "
                "excede 'limit' devuelve truncated=true. Ideal para análisis de archivos grandes."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "dataset_id": {
                        "type": "string",
                        "description": "ID retornado por ingest_file."
                    },
                    "sql": {
                        "type": "string",
                        "description": (
                            "SELECT sobre la tabla 'dataset'. "
                            "Ej: 'SELECT division, SUM(valor) FROM dataset GROUP BY division ORDER BY 2 DESC'."
                        )
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Cota dura de filas devueltas (default 1000, máximo 10000).",
                        "minimum": 1,
                        "maximum": 10000
                    }
                },
                "required": ["dataset_id", "sql"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "export_dataset",
            "description": (
                "Exporta un dataset al formato pedido (xlsx con branding Plataforma IA, csv/tsv "
                "con BOM UTF-8 y anti-injection, parquet, o json). Permite filter_sql, "
                "subset de columnas y sort antes de exportar. Úsala cuando el usuario pida "
                "'descárgame esto como Excel/CSV/...'."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "dataset_id": {
                        "type": "string",
                        "description": "ID del dataset a exportar."
                    },
                    "format": {
                        "type": "string",
                        "enum": ["xlsx", "csv", "tsv", "parquet", "json"],
                        "description": "Formato de salida."
                    },
                    "options": {
                        "type": "object",
                        "description": "Opciones de exportación.",
                        "properties": {
                            "filename": {
                                "type": "string",
                                "description": "Nombre base del archivo (la extensión se autocompleta)."
                            },
                            "columns": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "Subset de columnas a incluir (en orden)."
                            },
                            "sort_by": {
                                "type": "string",
                                "description": "Columna de orden."
                            },
                            "descending": {
                                "type": "boolean",
                                "description": "Orden descendente (default: false)."
                            },
                            "filter_sql": {
                                "type": "string",
                                "description": "SELECT adicional sobre 'dataset' antes de exportar (mismas reglas que query_dataset)."
                            }
                        }
                    }
                },
                "required": ["dataset_id", "format"]
            }
        }
    }
]


# Set de tools que requieren conversation_id inyectado por el dispatcher.
DATALAKE_TOOL_NAMES = {"ingest_file", "query_dataset", "export_dataset"}


# Mapeo de nombres de herramientas a funciones
TOOL_FUNCTIONS = {
    "create_backlog_requirement": create_backlog_requirement,
    "get_backlog_status": get_backlog_status,
    "search_agent_info": search_agent_info,
    "save_to_excel": save_to_excel,
    "append_to_excel": append_to_excel,
    "generate_excel_report": generate_excel_report,
    "inspect_excel": inspect_excel,
    "read_from_excel": read_from_excel,
    "inspect_csv": inspect_csv,
    "read_from_csv": read_from_csv,
    "summarize_data": summarize_data,
    "aggregate_data": aggregate_data,
    "compare_files": compare_files,
    "search_in_file": search_in_file,
    "batch_inspect": batch_inspect,
    "save_to_csv": save_to_csv,
    "transform_column": transform_column,
    "generate_chart_data": generate_chart_data,
    "generate_dashboard_data": generate_dashboard_data,
    "generate_kpi_data": generate_kpi_data,
    "generate_infographic_data": generate_infographic_data,
    "generate_widget_data": generate_widget_data,
    # PDF generation tools
    "generate_pdf_report": generate_pdf_report,
    "export_html_to_pdf": export_html_to_pdf,
    # Integration tools (async)
    "read_emails": read_emails,
    "send_email": send_email,
    "get_calendar_events": get_calendar_events,
    "get_jira_issues": get_jira_issues,
    "create_jira_issue": create_jira_issue,
    "add_jira_comment": add_jira_comment,
    # Datalake tools (conversation_id inyectado por dispatcher)
    "ingest_file": ingest_file_tool,
    "query_dataset": query_dataset_tool,
    "export_dataset": export_dataset_tool,
}

# Set of integration tool names (require user_email injection)
INTEGRATION_TOOL_NAMES = {
    "read_emails", "send_email", "get_calendar_events",
    "get_jira_issues", "create_jira_issue", "add_jira_comment",
}

# All tools = Excel tools + PDF tools + Integration tools + Datalake tools
ALL_TOOLS = EXCEL_TOOLS + PDF_TOOLS + INTEGRATION_TOOLS + DATALAKE_TOOLS


# ── Selector dinámico de tools por contexto del turno ────────────────
# El modelo recibe ~33 tools por defecto. Para análisis simples eso es
# overkill: aumenta tokens de input, eleva el tiempo de selección, y
# tienta al modelo a encadenar exploración exhaustiva. El selector
# recorta el catálogo en función de los archivos adjuntos y la
# intención detectada en el mensaje real.

# Tools mínimas para el flujo "análisis/lectura" de Excel/CSV.
_READ_FILE_TOOL_NAMES: frozenset[str] = frozenset({
    "inspect_excel", "read_from_excel", "summarize_data",
    "inspect_csv", "read_from_csv", "search_in_file",
})

# Tools de generación de archivos / específicas que solo aplican cuando
# el intent es de generación o cuando el mensaje las menciona.
_VIZ_TOOL_NAMES: frozenset[str] = frozenset({
    "generate_dashboard_data", "generate_chart_data", "generate_kpi_data",
    "generate_infographic_data", "generate_widget_data",
})


def select_tools_for_context(
    raw_user_text: str | None,
    files_present: dict | None = None,
    intents: dict | None = None,
) -> list[dict]:
    """Devuelve un subconjunto de `ALL_TOOLS` adecuado al turno actual.

    - ``raw_user_text``: mensaje del usuario sin el bloque
      ``[Archivos de datos disponibles…]``.
    - ``files_present``: dict con flags ``{"excel": bool, "csv": bool,
      "pdf": bool, "docx": bool}``. Si es None, no se asume nada.
    - ``intents``: dict ``{"read": bool, "excel_gen": bool, "pdf_gen":
      bool, "dashboard": bool}`` con los intents ya detectados aguas
      arriba.

    Política:
      * Intent de lectura + archivo Excel/CSV → solo tools de lectura
        (`_READ_FILE_TOOL_NAMES`). Esto corta la "exploración"
        innecesaria del modelo.
      * Excel/CSV adjunto sin intent claro → EXCEL_TOOLS completas
        (incluye generadores) por si pide reporte.
      * PDF adjunto → PDF_TOOLS + las de lectura mínimas.
      * Texto menciona dashboard/kpi/gráfico → añadir generadores viz.
      * Texto menciona pdf/reporte/informe → añadir PDF_TOOLS.
      * Texto menciona ingest/dataset/datalake → añadir DATALAKE_TOOLS.
      * Sin archivos ni señales claras → ALL_TOOLS (fallback seguro).
    """
    text = (raw_user_text or "").lower()
    files = files_present or {}
    ints = intents or {}

    has_excel = bool(files.get("excel"))
    has_csv = bool(files.get("csv"))
    has_pdf = bool(files.get("pdf"))
    is_read = bool(ints.get("read"))
    is_excel_gen = bool(ints.get("excel_gen"))
    is_pdf_gen = bool(ints.get("pdf_gen"))
    is_dashboard = bool(ints.get("dashboard"))

    selected: dict[str, dict] = {}

    def _add(group: list[dict], names: frozenset[str] | None = None) -> None:
        for tool in group:
            name = tool.get("function", {}).get("name", "")
            if names is not None and name not in names:
                continue
            selected.setdefault(name, tool)

    # Caso 1: lectura simple de Excel/CSV → mínimo absoluto.
    if is_read and (has_excel or has_csv) and not (
        is_excel_gen or is_pdf_gen or is_dashboard
    ):
        _add(EXCEL_TOOLS, _READ_FILE_TOOL_NAMES)
        # Si el mensaje menciona viz, añadir generadores específicos.
        if any(kw in text for kw in (
            "gráfico", "grafico", "chart", "kpi", "indicador",
            "dashboard", "tablero", "panel",
        )):
            _add(EXCEL_TOOLS, _VIZ_TOOL_NAMES)
        return list(selected.values())

    # Caso 2: archivo presente sin intent específico → EXCEL_TOOLS
    # completo (cubre lectura + generación + viz).
    if has_excel or has_csv:
        _add(EXCEL_TOOLS)
    if has_pdf:
        _add(EXCEL_TOOLS, _READ_FILE_TOOL_NAMES)
        _add(PDF_TOOLS)

    # Caso 3: el texto pide PDF aunque no haya PDF adjunto.
    if is_pdf_gen or any(
        kw in text for kw in ("pdf", "reporte", "informe", "memo", "acta")
    ):
        _add(PDF_TOOLS)

    # Caso 4: texto menciona viz / dashboard.
    if is_dashboard or any(kw in text for kw in (
        "dashboard", "tablero", "panel", "kpi", "indicador",
        "gráfico", "grafico", "chart",
    )):
        _add(EXCEL_TOOLS, _VIZ_TOOL_NAMES)

    # Caso 5: texto menciona datalake / consultas grandes.
    if any(kw in text for kw in (
        "ingest", "dataset", "datalake", "data lake", "consulta sql",
        "millones de filas", "archivo grande",
    )):
        _add(DATALAKE_TOOLS)

    # Caso 6: sin señales útiles → catálogo completo (seguro).
    if not selected:
        return list(ALL_TOOLS)

    # Siempre incluir las tools de integración livianas si el mensaje
    # las pide (correo / Jira). Caro no es y el modelo a veces necesita.
    if any(kw in text for kw in (
        "correo", "email", "outlook", "jira", "ticket", "issue",
    )):
        _add(INTEGRATION_TOOLS)

    return list(selected.values())

# Etiquetas en español para mostrar en el frontend durante el proceso del agente
TOOL_LABELS_ES: dict[str, str] = {
    "save_to_excel":              "Guardando en Excel",
    "append_to_excel":            "Agregando datos a Excel",
    "generate_excel_report":      "Generando reporte Excel Plataforma IA",
    "read_from_excel":            "Leyendo datos de Excel",
    "inspect_excel":              "Inspeccionando Excel",
    "inspect_csv":                "Inspeccionando CSV",
    "read_from_csv":              "Leyendo datos de CSV",
    "summarize_data":             "Calculando estadísticas",
    "aggregate_data":             "Agrupando y agregando datos",
    "compare_files":              "Comparando archivos",
    "search_in_file":             "Buscando en archivo",
    "batch_inspect":              "Inspeccionando múltiples archivos",
    "save_to_csv":                "Guardando en CSV",
    "transform_column":           "Transformando datos",
    "generate_chart_data":        "Generando visualización de datos",
    "generate_dashboard_data":    "Generando dashboard interactivo",
    "generate_kpi_data":          "Generando indicadores KPI",
    "generate_infographic_data":  "Generando diagrama interactivo",
    "generate_widget_data":       "Generando widget interactivo",
    "generate_pdf_report":        "Generando reporte PDF Plataforma IA",
    "export_html_to_pdf":         "Exportando HTML a PDF",
    "create_backlog_requirement": "Registrando requerimiento",
    "get_backlog_status":         "Consultando estado del backlog",
    "read_emails":                "Leyendo correos de Outlook",
    "send_email":                 "Enviando correo",
    "get_calendar_events":        "Consultando calendario",
    "get_jira_issues":            "Consultando issues de Jira",
    "create_jira_issue":          "Creando issue en Jira",
    "add_jira_comment":           "Agregando comentario en Jira",
    "ingest_file":                "Ingiriendo archivo al datalake",
    "query_dataset":              "Consultando dataset con SQL",
    "export_dataset":             "Exportando dataset",
}


def get_tool_label(tool_name: str) -> str:
    """Retorna la etiqueta en español para una herramienta, o un fallback legible."""
    return TOOL_LABELS_ES.get(tool_name, tool_name.replace("_", " ").capitalize())


async def execute_tool(
    tool_name: str,
    tool_input: Dict[str, Any],
    user_email: Optional[str] = None,
    conversation_id: Optional[str] = None,
    event_callback: Optional[Callable[[dict], Awaitable[None]]] = None,
    message_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Ejecuta una herramienta por su nombre.
    Inyecta user_email (integration tools), conversation_id (datalake tools) y
    event_callback/message_id (tools UI que emiten ui-component al WebSocket).

    Args:
        tool_name: Nombre de la herramienta
        tool_input: Parámetros de entrada
        user_email: Email del usuario (inyectado para integration tools)
        conversation_id: ID de conversación (inyectado para datalake tools)
        event_callback: Callback WebSocket para emitir ui-component (UI tools)
        message_id: ID del mensaje del asistente para asociar el evento ui-component

    Returns:
        Resultado de la ejecución
    """
    if tool_name not in TOOL_FUNCTIONS:
        return {
            "success": False,
            "error": f"Herramienta '{tool_name}' no encontrada"
        }

    try:
        # Inject user_email for integration tools
        if tool_name in INTEGRATION_TOOL_NAMES:
            if not user_email:
                return {
                    "success": False,
                    "error": "Se requiere autenticación para usar integraciones externas."
                }
            tool_input["user_email"] = user_email

        # Inject conversation_id for datalake tools (workspace aislado por conversación)
        if tool_name in DATALAKE_TOOL_NAMES:
            if not conversation_id:
                return {
                    "success": False,
                    "error": "conversation_id no disponible para tool del datalake."
                }
            tool_input["conversation_id"] = conversation_id

        # Inject event_callback + message_id for UI tools (dashboard/chart/kpi/...)
        # Reemplaza al patrón previo basado en ContextVars que se perdía
        # silenciosamente al cruzar límites de Task (gather/wait_for) y dejaba
        # rendered=False con fallback markdown que el front no parsea.
        if tool_name in _VIZ_TOOL_NAMES:
            tool_input["_event_callback"] = event_callback
            tool_input["_message_id"] = message_id

        import asyncio
        function = TOOL_FUNCTIONS[tool_name]
        if asyncio.iscoroutinefunction(function):
            result = await function(**tool_input)
        else:
            result = function(**tool_input)
        return result
    except Exception as e:
        logger.error(f"❌ Error ejecutando herramienta {tool_name}: {e}")
        return {
            "success": False,
            "error": str(e)
        }
