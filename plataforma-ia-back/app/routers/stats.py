"""
Router de estadísticas.
Expone métricas reales para el Dashboard y la HomePage combinando:
  - Cosmos DB: métricas de negocio (usuarios, conversaciones, backlogs)
  - Azure Monitor: métricas de uso del modelo (tokens, llamadas) desde Azure AI Foundry
"""
import asyncio
import os
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from app.config import get_logger
from app.middleware.auth import require_user
from app.services.cosmos_service import cosmos_service
from app.services import azure_monitor_service
from app.services.connection_manager import manager

logger = get_logger("stats_router")

router = APIRouter(prefix="/stats", tags=["stats"])

_EMPTY_USAGE = {
    "period": {"total_tokens": 0, "prompt_tokens": 0, "completion_tokens": 0, "calls": 0, "tool_calls": 0},
    "total": {"total_tokens": 0, "prompt_tokens": 0, "completion_tokens": 0, "calls": 0, "tool_calls": 0},
    "daily_series": [],
    "by_model": [],
}

_EMPTY_ACTIVITY = {
    "kpis": {
        "unique_users": 0, "unique_users_total": 0,
        "total_conversations": 0, "total_conversations_all": 0,
        "total_agents": 0, "total_backlogs": 0,
        "hours_saved": 0, "hours_saved_total": 0,
        "avg_msgs_per_conv": 0.0,
    },
    "monthly_activity": [],
    "division_breakdown": [],
}

# Caché en memoria: { "stats_30": (data_dict, datetime) }
_cache: dict[str, tuple[dict, datetime]] = {}
_CACHE_TTL_SECONDS = 300  # 5 minutos

# Presencia de usuarios logueados: { email: last_seen }
_active_sessions: dict[str, datetime] = {}
_PRESENCE_TTL_SECONDS = 300  # 5 minutos


class PresencePayload(BaseModel):
    email: str


@router.get("/")
async def get_stats(days: int = Query(default=30, ge=1, le=365, description="Ventana de tiempo en días"), _user: dict = Depends(require_user)):
    """
    Retorna KPIs, series temporales de actividad y estadísticas de uso del modelo.

    - **unique_users**: usuarios únicos que interactuaron en el período (Cosmos DB)
    - **total_conversations**: conversaciones en el período (Cosmos DB)
    - **total_agents**: agentes disponibles en catálogo (Cosmos DB)
    - **hours_saved**: horas ahorradas estimadas (conversaciones × 2h)
    - **monthly_activity**: actividad mensual de los últimos 6 meses (Cosmos DB)
    - **model_usage**: tokens y llamadas desde Azure Monitor / Azure AI Foundry
    """
    cache_key = f"stats_{days}"
    now = datetime.utcnow()

    # Retornar caché si es fresco
    if cache_key in _cache:
        cached_data, cached_ts = _cache[cache_key]
        if (now - cached_ts).total_seconds() < _CACHE_TTL_SECONDS:
            return cached_data

    # Ejecutar Cosmos DB y Azure Monitor en paralelo
    results = await asyncio.gather(
        asyncio.to_thread(cosmos_service.get_stats, days=days),
        asyncio.to_thread(azure_monitor_service.get_model_usage_stats, days=days),
        return_exceptions=True,
    )

    activity, usage = results

    activity_data: dict = _EMPTY_ACTIVITY if isinstance(activity, Exception) else activity  # type: ignore[assignment]
    usage_data: dict = _EMPTY_USAGE if isinstance(usage, Exception) else usage  # type: ignore[assignment]

    if isinstance(activity, Exception):
        logger.error(f"Error al calcular activity stats: {activity}")
    if isinstance(usage, Exception):
        logger.error(f"Error al obtener model usage desde Azure Monitor: {usage}")

    result = {
        **activity_data,
        "model_usage": usage_data,
        "engagement_score": _parse_optional_float(os.getenv("DASHBOARD_ENGAGEMENT_SCORE")),
        "roi_estimated_usd": _parse_optional_float(os.getenv("DASHBOARD_ROI_USD")),
    }
    _cache[cache_key] = (result, now)
    return result


def _parse_optional_float(value: str | None) -> float | None:
    """Convierte un string de env var a float, o retorna None si no es válido."""
    if value is None or value.strip() == "":
        return None
    try:
        return float(value)
    except ValueError:
        logger.warning(f"Valor no numérico en env var: {value!r}")
        return None


@router.post("/presence")
async def update_presence(payload: PresencePayload, _user: dict = Depends(require_user)):
    """
    Heartbeat de sesión. El frontend llama a este endpoint cada 30s mientras el
    usuario está logueado. Actualiza el timestamp de last_seen en memoria y limpia
    entradas caducadas.
    """
    email = payload.email.strip().lower()
    if email:
        now = datetime.utcnow()
        _active_sessions[email] = now
        cutoff = now - timedelta(seconds=_PRESENCE_TTL_SECONDS)
        stale = [e for e, t in list(_active_sessions.items()) if t < cutoff]
        for e in stale:
            del _active_sessions[e]
    return {"ok": True}


@router.get("/live")
async def get_live_metrics(_user: dict = Depends(require_user)):
    """
    Métricas ligeras en tiempo real. Lee solo de memoria — cero queries a BD.
    - logged_in_users: usuarios que hicieron heartbeat en los últimos 5 minutos
    - active_connections: usuarios con WebSocket de chat activo ahora mismo
    - total_agents: agentes en catálogo (cache en memoria de cosmos_service)
    """
    cutoff = datetime.utcnow() - timedelta(seconds=_PRESENCE_TTL_SECONDS)
    logged_in = sum(1 for t in _active_sessions.values() if t >= cutoff)
    return {
        "logged_in_users": logged_in,
        "active_connections": len(manager.active_connections),
        "total_agents": len(cosmos_service._get_cached_agents()),
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }
