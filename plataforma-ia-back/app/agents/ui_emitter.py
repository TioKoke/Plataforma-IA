"""
Emisor de eventos `ui-component` vía WebSocket.

Las tools UI (generate_chart_data, generate_dashboard_data, etc.) llaman
`emit_ui_component(kind, spec, event_callback=..., message_id=...)` para que el
frontend reciba el spec ya validado por un canal dedicado, sin depender del
"copia markdown verbatim".

Diseño: el `event_callback` y `message_id` se pasan EXPLÍCITAMENTE como kwargs
desde `azure_ai.send_message` → `execute_tool` → tool. Esto reemplaza a un
patrón previo basado en ContextVars que perdía el callback cuando el dispatch
de tools cruzaba límites de Task (`asyncio.gather` / `asyncio.wait_for`) y
dejaba la tool retornando `rendered=False` silenciosamente, cayendo al fallback
markdown que el frontend no parsea.
"""
from __future__ import annotations

from typing import Awaitable, Callable, Optional


async def emit_ui_component(
    kind: str,
    spec: dict,
    *,
    event_callback: Optional[Callable[[dict], Awaitable[None]]] = None,
    message_id: Optional[str] = None,
) -> bool:
    """Emite un evento `ui-component` si hay callback y message_id provistos.

    Retorna True si se emitió, False si no (ej. request sin WebSocket o tool
    invocada fuera del flujo de chat — tests, scripts, etc.).
    """
    if event_callback is None or message_id is None:
        return False
    await event_callback(
        {
            "type": "ui-component",
            "data": {
                "message_id": message_id,
                "kind": kind,
                "spec": spec,
            },
        }
    )
    return True
