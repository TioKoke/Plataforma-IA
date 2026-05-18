"""Sanitización anti-injection para celdas Excel (OWASP CWE-1236)."""
from typing import Any

_DANGEROUS_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def sanitize_cell(value: Any) -> Any:
    """Prefija un apóstrofo a strings que empiecen con caracteres interpretables
    como fórmula por Excel, evitando ejecución de contenido malicioso del LLM
    o de usuarios upstream.

    Valores no-string se devuelven intactos.
    """
    if isinstance(value, str) and value and value[0] in _DANGEROUS_PREFIXES:
        return "'" + value
    return value
