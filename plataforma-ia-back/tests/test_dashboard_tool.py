"""Tests para la validación de `generate_dashboard_data`.

Foco: que los paneles chart/table con data vacía o con `x_key` /
`table_columns[].key` desalineados respecto a las claves del primer row sean
rechazados con `error: "empty_panels"` y un mensaje accionable para el modelo.
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import pytest

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.agents import tools


@pytest.fixture(autouse=True)
def stub_emit(monkeypatch):
    """Evita abrir WebSocket durante los tests — la validación ocurre antes del emit."""
    async def _fake_emit(_kind, _spec, *, event_callback=None, message_id=None):
        return True

    monkeypatch.setattr("app.agents.ui_emitter.emit_ui_component", _fake_emit)


def _run(coro):
    return asyncio.run(coro)


def test_rejects_table_panel_with_mismatched_case_key():
    """`table_columns[].key='fecha'` cuando el row tiene `'Fecha'` → empty_panels."""
    panels = [
        {
            "id": "tabla",
            "type": "table",
            "title": "Histórico",
            "table_columns": [
                {"key": "fecha", "label": "Fecha"},
                {"key": "lme_cu", "label": "LME CU"},
            ],
            "data": [
                {"Fecha": "2025-01-01", "LME_CU": 4.12},
                {"Fecha": "2025-01-02", "LME_CU": 4.15},
            ],
        }
    ]

    result = _run(tools.generate_dashboard_data(
        dashboard_id="d1",
        title="Histórico del cobre",
        panels=panels,
    ))

    assert result["success"] is False
    assert result["error"] == "empty_panels"
    # El mensaje debe mencionar las claves reales del row para que el modelo corrija
    assert "Fecha" in result["message"]
    assert "case-sensitive" in result["message"]


def test_rejects_chart_panel_with_empty_data():
    """Chart con `data=[]` → empty_panels (aunque x_key y y_keys estén definidos)."""
    panels = [
        {
            "id": "serie",
            "type": "line",
            "title": "Evolución",
            "x_key": "fecha",
            "y_keys": [{"key": "lme_cu", "label": "LME CU", "color": "#0072B1"}],
            "data": [],
        }
    ]

    result = _run(tools.generate_dashboard_data(
        dashboard_id="d2",
        title="Evolución del cobre",
        panels=panels,
    ))

    assert result["success"] is False
    assert result["error"] == "empty_panels"
    assert "data vacía" in result["message"]


def test_rejects_chart_panel_with_x_key_not_in_rows():
    """Chart con `x_key='fecha'` que no existe en rows (tienen `'Fecha'`) → empty_panels.

    El normalizador filtra rows sin x_key (tools.py:2452-2453) → data queda vacía →
    la validación debe dispararse.
    """
    panels = [
        {
            "id": "serie",
            "type": "line",
            "title": "Evolución",
            "x_key": "fecha",
            "y_keys": [{"key": "LME_CU", "label": "LME CU", "color": "#0072B1"}],
            "data": [
                {"Fecha": "2025-01-01", "LME_CU": 4.12},
                {"Fecha": "2025-01-02", "LME_CU": 4.15},
            ],
        }
    ]

    result = _run(tools.generate_dashboard_data(
        dashboard_id="d3",
        title="Evolución del cobre",
        panels=panels,
    ))

    assert result["success"] is False
    assert result["error"] == "empty_panels"


def test_emits_ui_component_through_gather_wait_for(monkeypatch):
    """Regression: el `event_callback` debe sobrevivir al cruce de Tasks
    (`asyncio.gather` + `asyncio.wait_for`) que usa el dispatcher real en
    `azure_ai._dispatch_bounded`.

    El bug original (rendered=False, fallback markdown que el front no
    renderiza) se producía porque el callback se propagaba vía ContextVars
    y se perdía al cruzar el límite de Task. Ahora viaja como kwarg
    explícito a través de `execute_tool` y de la firma de la tool.
    """
    from app.agents.tools import execute_tool

    # Capturador que sobrescribe el stub autouse para verificar end-to-end
    # que el callback y message_id llegan hasta `emit_ui_component`.
    captured_emit: list[dict] = []
    captured_ws: list[dict] = []

    async def capture_emit(kind, spec, *, event_callback=None, message_id=None):
        captured_emit.append({
            "kind": kind,
            "event_callback_is_none": event_callback is None,
            "message_id": message_id,
        })
        if event_callback is None or message_id is None:
            return False
        await event_callback({
            "type": "ui-component",
            "data": {"message_id": message_id, "kind": kind, "spec": spec},
        })
        return True

    monkeypatch.setattr(
        "app.agents.ui_emitter.emit_ui_component", capture_emit
    )

    async def ws_callback(event: dict) -> None:
        captured_ws.append(event)

    panels = [
        {
            "id": "kpi1",
            "type": "kpi",
            "title": "Precio último",
            "span": 1,
            "kpi": {"value": 4.12, "label": "USD/lb", "format": "number"},
        }
    ]

    async def _scenario():
        # Reproduce el patrón exacto del dispatcher: wait_for + gather
        async def _one():
            return await execute_tool(
                "generate_dashboard_data",
                {
                    "dashboard_id": "regression",
                    "title": "Regression",
                    "panels": panels,
                },
                event_callback=ws_callback,
                message_id="msg_test_123",
            )

        results = await asyncio.gather(
            asyncio.wait_for(_one(), timeout=10),
        )
        return results[0]

    result = _run(_scenario())

    # 1. La tool reportó render exitoso
    assert result["success"] is True
    assert result["rendered"] is True, (
        "El dashboard debe emitirse al WebSocket. Si esto falla, el callback "
        "se está perdiendo en la cadena send_message → execute_tool → tool."
    )
    # 2. emit_ui_component recibió el callback (no None) y el message_id correcto
    assert len(captured_emit) == 1
    assert captured_emit[0]["kind"] == "dashboard"
    assert captured_emit[0]["event_callback_is_none"] is False
    assert captured_emit[0]["message_id"] == "msg_test_123"
    # 3. El callback fue invocado con el evento correcto
    assert len(captured_ws) == 1
    evt = captured_ws[0]
    assert evt["type"] == "ui-component"
    assert evt["data"]["kind"] == "dashboard"
    assert evt["data"]["message_id"] == "msg_test_123"
    assert evt["data"]["spec"]["id"] == "regression"


def test_accepts_valid_dashboard_with_kpi_and_aligned_keys():
    """KPIs no requieren data; table/chart con claves alineadas pasan."""
    panels = [
        {
            "id": "kpi1",
            "type": "kpi",
            "title": "Precio último",
            "span": 1,
            "kpi": {"value": 4.12, "label": "USD/lb", "format": "number"},
        },
        {
            "id": "serie",
            "type": "line",
            "title": "Evolución",
            "x_key": "fecha",
            "y_keys": [{"key": "lme_cu", "label": "LME CU", "color": "#0072B1"}],
            "data": [
                {"fecha": "2025-01-01", "lme_cu": 4.12},
                {"fecha": "2025-01-02", "lme_cu": 4.15},
            ],
        },
    ]

    result = _run(tools.generate_dashboard_data(
        dashboard_id="d4",
        title="Histórico del cobre",
        panels=panels,
    ))

    assert result["success"] is True
    assert result["dashboard_spec"]["id"] == "d4"
    assert len(result["dashboard_spec"]["panels"]) == 2
