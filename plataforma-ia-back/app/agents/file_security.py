"""Hardening compartido para manejo de archivos tabulares.

Provee:
- `zip_bomb_guard()` — valida que un .xlsx no descomprima a más del límite.
- `apply_defused_xml()` — monkey-patch defensivo para parseo XML (mitiga XXE).
- `safe_filename()` — sanitiza un filename del LLM evitando path traversal.
- `safe_join_under()` — resuelve un path relativo y verifica que cae bajo `base`.
"""
from __future__ import annotations

import logging
import re
import zipfile
from io import BytesIO
from pathlib import PurePosixPath, Path
from typing import Union

logger = logging.getLogger(__name__)

# 200 MB descomprimidos como máximo permitido por defecto. Un xlsx legítimo
# de 100k filas con formato pesa típicamente <50 MB descomprimido.
DEFAULT_MAX_UNCOMPRESSED = 200 * 1024 * 1024
# Ratio máximo (descomprimido / comprimido). Zip bombs típicas exceden 1000:1.
DEFAULT_MAX_RATIO = 200

_FILENAME_SAFE_RE = re.compile(r"^[\w\-. ]+$")


class FileSecurityError(ValueError):
    """Violación de política de seguridad sobre un archivo."""


def zip_bomb_guard(
    file_bytes: bytes,
    max_uncompressed: int = DEFAULT_MAX_UNCOMPRESSED,
    max_ratio: int = DEFAULT_MAX_RATIO,
) -> None:
    """Inspecciona un xlsx (zip) y rechaza si excede límites de descompresión.

    Lanza `FileSecurityError` si:
    - La suma de tamaños descomprimidos excede `max_uncompressed`.
    - El ratio descomprimido/comprimido excede `max_ratio`.
    - El archivo no es un zip válido.

    No-op para archivos que no son zip (ej: .csv puro).
    """
    if not file_bytes or len(file_bytes) < 4:
        return
    if file_bytes[:2] != b"PK":
        return  # no es zip — no aplica el guard

    compressed = max(len(file_bytes), 1)
    try:
        with zipfile.ZipFile(BytesIO(file_bytes)) as zf:
            total = sum(info.file_size for info in zf.infolist())
    except zipfile.BadZipFile as exc:
        raise FileSecurityError(f"Archivo zip inválido: {exc}") from exc

    if total > max_uncompressed:
        raise FileSecurityError(
            f"Archivo descomprime a {total/1e6:.1f} MB (>{max_uncompressed/1e6:.0f} MB permitido)"
        )
    if total / compressed > max_ratio:
        raise FileSecurityError(
            f"Ratio compresión {total/compressed:.0f}:1 excede {max_ratio}:1 (zip bomb)"
        )


def apply_defused_xml() -> None:
    """Monkey-patch los parsers XML estándar con versiones defusadas.

    Mitigación XXE para librerías que dependen de xml.etree (openpyxl no lo hace
    directamente, pero protege a cualquier código de terceros que sí). Idempotente.
    """
    try:
        import defusedxml
        defusedxml.defuse_stdlib()
    except Exception as exc:
        logger.warning("No se pudo aplicar defusedxml: %s", exc)


def safe_filename(filename: str) -> str:
    """Devuelve un filename seguro o lanza FileSecurityError.

    Acepta solo caracteres `\\w`, guion, punto y espacio. Rechaza separadores
    de path, secuencias `..`, y nombres absolutos.
    """
    if not filename:
        raise FileSecurityError("filename vacío")
    name = PurePosixPath(filename).name  # descarta cualquier prefijo de directorio
    if name != filename or ".." in name or name.startswith("."):
        raise FileSecurityError(f"filename inseguro: {filename!r}")
    if not _FILENAME_SAFE_RE.match(name):
        raise FileSecurityError(
            f"filename contiene caracteres no permitidos: {filename!r}"
        )
    return name


def safe_join_under(base: Union[str, Path], *parts: str) -> Path:
    """Resuelve `base / parts...` y garantiza que el resultado cae bajo `base`.

    Lanza `FileSecurityError` si hay path traversal.
    """
    base_path = Path(base).resolve()
    candidate = base_path.joinpath(*parts).resolve()
    try:
        candidate.relative_to(base_path)
    except ValueError as exc:
        raise FileSecurityError(
            f"path fuera del directorio permitido: {candidate}"
        ) from exc
    return candidate
