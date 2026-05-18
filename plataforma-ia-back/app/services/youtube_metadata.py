"""
Helper para extraer metadata (duración) de videos de YouTube.

Aproximación: descargar la página pública del video y extraer "lengthSeconds"
del JSON embebido (ytInitialPlayerResponse). No requiere API key.
"""
import math
import re
from typing import Optional

import httpx

from app.config import get_logger

logger = get_logger("youtube_metadata")

_LENGTH_RE = re.compile(r'"lengthSeconds":"(\d+)"')
_USER_AGENT = "Mozilla/5.0 (compatible; PlataformaIA/1.0)"


def get_duration_minutes(youtube_id: str) -> Optional[str]:
    """
    Retorna la duración del video en formato "N min" (redondeado hacia arriba).
    Retorna None si no se puede obtener (network error, video privado, etc.).
    """
    if not youtube_id:
        return None

    url = f"https://www.youtube.com/watch?v={youtube_id}"
    try:
        resp = httpx.get(
            url,
            headers={"User-Agent": _USER_AGENT, "Accept-Language": "es-CL,es;q=0.9"},
            timeout=5.0,
            follow_redirects=True,
        )
        resp.raise_for_status()
        match = _LENGTH_RE.search(resp.text)
        if not match:
            logger.warning(f"No se encontró lengthSeconds para youtube_id={youtube_id}")
            return None
        seconds = int(match.group(1))
        minutes = max(1, math.ceil(seconds / 60))
        return f"{minutes} min"
    except Exception as e:
        logger.warning(f"Fallo al obtener duración de YouTube ({youtube_id}): {e}")
        return None
