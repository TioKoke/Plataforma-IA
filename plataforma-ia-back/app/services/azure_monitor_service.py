"""
Servicio para leer métricas de uso del modelo directamente desde Azure Monitor.

Reemplaza el tracking manual en Cosmos DB (`model_usage`) con datos oficiales
registrados automáticamente por Azure AI Foundry en Azure Monitor.

Usa la Azure Monitor REST API (management.azure.com) con httpx + DefaultAzureCredential,
sin dependencia de azure-monitor-query (v2.x eliminó MetricsQueryClient).

Métricas consumidas (todas soportan dimensión ModelDeploymentName):
  - ProcessedPromptTokens  → prompt_tokens
  - GeneratedTokens        → completion_tokens
  - TokenTransaction       → total_tokens
  - ModelRequests          → calls

Prerequisito: Managed Identity (id-plataformaia-dev) con rol "Monitoring Reader"
en your-foundry-rg.
"""
from __future__ import annotations

import os
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from app.config import get_logger

logger = get_logger("azure_monitor_service")

_SUBSCRIPTION_ID = "00000000-0000-0000-0000-000000000000"
# Configurables por entorno — por defecto apuntan a DEV
_RESOURCE_GROUP = os.getenv("AZURE_MONITOR_FOUNDRY_RG", "your-foundry-rg")
_ACCOUNT_NAME   = os.getenv("AZURE_MONITOR_FOUNDRY_ACCOUNT", "your-foundry-resource")
_RESOURCE_ID = (
    f"/subscriptions/{_SUBSCRIPTION_ID}"
    f"/resourceGroups/{_RESOURCE_GROUP}"
    f"/providers/Microsoft.CognitiveServices/accounts/{_ACCOUNT_NAME}"
)
_METRICS_URL = f"https://management.azure.com{_RESOURCE_ID}/providers/microsoft.insights/metrics"
_API_VERSION = "2024-02-01"
_MGMT_SCOPE = "https://management.azure.com/.default"

# Cuántos días atrás consultar como "historial total"
_HISTORY_DAYS = 365

# Azure Monitor solo funciona corriendo dentro de Azure con una Managed Identity
# con rol "Monitoring Reader". En el demo (Cloud Run / local) se desactiva:
# las funciones retornan estructuras vacías y el dashboard muestra "sin dato".
_ENABLED = os.getenv("AZURE_MONITOR_ENABLED", "false").lower() in ("true", "1", "yes")


def _get_token() -> str:
    """Obtiene un bearer token para management.azure.com.

    Usa ManagedIdentityCredential con el client_id de la MI de usuario si está
    configurado (AZURE_MI_CLIENT_ID), o el sistema-assigned si no.
    Evita usar DefaultAzureCredential para no conflictuar con AZURE_CLIENT_ID
    que apunta al App Registration (JWT auth).
    """
    from azure.identity import ManagedIdentityCredential
    mi_client_id = os.getenv("AZURE_MI_CLIENT_ID")
    credential = (
        ManagedIdentityCredential(client_id=mi_client_id)
        if mi_client_id
        else ManagedIdentityCredential()
    )
    return credential.get_token(_MGMT_SCOPE).token


def _query_metrics(
    token: str,
    metric_names: list[str],
    start: datetime,
    end: datetime,
) -> dict[str, dict[str, Any]]:
    """
    Llama a la REST API de Azure Monitor y retorna los datos por métrica y deployment.

    Retorna:
        {
          "MetricName": {
            "deployment_name": {
              "YYYY-MM-DD": float,
              "__total__": float,
            }
          }
        }
    """
    result: dict[str, dict] = {m: defaultdict(lambda: defaultdict(float)) for m in metric_names}

    timespan = f"{start.strftime('%Y-%m-%dT%H:%M:%SZ')}/{end.strftime('%Y-%m-%dT%H:%M:%SZ')}"

    params = {
        "metricnames": ",".join(metric_names),
        "aggregation": "Total",
        "interval": "P1D",
        "timespan": timespan,
        "$filter": "ModelDeploymentName ne ''",
        "api-version": _API_VERSION,
    }

    try:
        response = httpx.get(
            _METRICS_URL,
            params=params,
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()
    except Exception as e:
        logger.warning(f"Azure Monitor REST API falló: {e}")
        return result

    for metric in data.get("value", []):
        name = metric.get("name", {}).get("value", "")
        if name not in result:
            continue
        for ts in metric.get("timeseries", []):
            # Extraer deployment de los metadatos
            deployment = "unknown"
            for mv in ts.get("metadatavalues", []):
                if mv.get("name", {}).get("value", "").lower() == "modeldeploymentname":
                    deployment = mv.get("value", "unknown")
                    break
            total = 0.0
            for point in ts.get("data", []):
                value = point.get("total") or 0.0
                if value:
                    # timeStamp viene como "2026-03-10T00:00:00Z"
                    date_str = point.get("timeStamp", "")[:10]
                    result[name][deployment][date_str] += value
                    total += value
            result[name][deployment]["__total__"] += total

    return result


def get_model_usage_stats(days: int = 30) -> dict:
    """
    Agrega estadísticas de uso del modelo desde Azure Monitor.

    Retorna el mismo formato que el anterior cosmos_service.get_model_usage_stats()
    para que el frontend y el router no requieran cambios.

    Returns:
        {
          "period": {total_tokens, prompt_tokens, completion_tokens, calls, tool_calls},
          "total":  {total_tokens, prompt_tokens, completion_tokens, calls, tool_calls},
          "daily_series": [{date, dia, total_tokens, prompt_tokens, completion_tokens, calls}],
          "by_model": [{model, total_tokens, prompt_tokens, completion_tokens, calls, tool_calls}],
        }
    """
    _empty = lambda: {
        "total_tokens": 0, "prompt_tokens": 0,
        "completion_tokens": 0, "calls": 0, "tool_calls": 0,
    }

    # Modo demo / fuera de Azure: degradado elegante, sin intentar conectarse.
    if not _ENABLED:
        return {"period": _empty(), "total": _empty(), "daily_series": [], "by_model": []}

    try:
        token = _get_token()
    except Exception as e:
        logger.warning(f"No se pudo obtener token Azure Monitor: {e}")
        return {"period": _empty(), "total": _empty(), "daily_series": [], "by_model": []}

    now = datetime.now(timezone.utc)
    period_start = now - timedelta(days=days)
    history_start = now - timedelta(days=_HISTORY_DAYS)

    _metrics = ["ProcessedPromptTokens", "GeneratedTokens", "TokenTransaction", "ModelRequests"]

    period_data = _query_metrics(token, _metrics, start=period_start, end=now)
    total_data  = _query_metrics(token, _metrics, start=history_start, end=now)

    def _sum_deployments(data: dict, metric: str) -> int:
        return int(sum(v.get("__total__", 0.0) for v in data.get(metric, {}).values()))

    period = {
        "prompt_tokens":     _sum_deployments(period_data, "ProcessedPromptTokens"),
        "completion_tokens": _sum_deployments(period_data, "GeneratedTokens"),
        "total_tokens":      _sum_deployments(period_data, "TokenTransaction"),
        "calls":             _sum_deployments(period_data, "ModelRequests"),
        "tool_calls": 0,
    }

    total = {
        "prompt_tokens":     _sum_deployments(total_data, "ProcessedPromptTokens"),
        "completion_tokens": _sum_deployments(total_data, "GeneratedTokens"),
        "total_tokens":      _sum_deployments(total_data, "TokenTransaction"),
        "calls":             _sum_deployments(total_data, "ModelRequests"),
        "tool_calls": 0,
    }

    # ── Serie diaria ──────────────────────────────────────────────────
    daily_agg: dict[str, dict] = defaultdict(
        lambda: {"total_tokens": 0, "prompt_tokens": 0, "completion_tokens": 0, "calls": 0}
    )
    _daily_map = {
        "TokenTransaction":      "total_tokens",
        "ProcessedPromptTokens": "prompt_tokens",
        "GeneratedTokens":       "completion_tokens",
        "ModelRequests":         "calls",
    }
    for metric_name, field in _daily_map.items():
        for dep_data in period_data.get(metric_name, {}).values():
            for date_str, val in dep_data.items():
                if date_str != "__total__":
                    daily_agg[date_str][field] += int(val)

    date_labels = [
        (now - timedelta(days=i)).strftime("%Y-%m-%d")
        for i in range(days - 1, -1, -1)
    ]
    daily_series = [
        {
            "date": d,
            "dia": d[8:],
            **daily_agg.get(d, {"total_tokens": 0, "prompt_tokens": 0, "completion_tokens": 0, "calls": 0}),
        }
        for d in date_labels
    ]

    # ── Desglose por deployment ───────────────────────────────────────
    all_deployments: set[str] = set()
    for metric_data in total_data.values():
        all_deployments.update(metric_data.keys())
    all_deployments.discard("__total__")

    by_model = []
    for dep in sorted(all_deployments):
        def _dep_total(metric: str, _dep: str = dep) -> int:
            return int(total_data.get(metric, {}).get(_dep, {}).get("__total__", 0))

        by_model.append({
            "model":             dep,
            "prompt_tokens":     _dep_total("ProcessedPromptTokens"),
            "completion_tokens": _dep_total("GeneratedTokens"),
            "total_tokens":      _dep_total("TokenTransaction"),
            "calls":             _dep_total("ModelRequests"),
            "tool_calls": 0,
        })

    return {
        "period":       period,
        "total":        total,
        "daily_series": daily_series,
        "by_model":     by_model,
    }
