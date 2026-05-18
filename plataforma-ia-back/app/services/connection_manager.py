"""
Gestor de conexiones WebSocket activas.
Módulo separado para permitir importación desde múltiples routers sin dependencias cruzadas.
"""
from typing import Dict
from fastapi import WebSocket
from app.config import get_logger

logger = get_logger("connection_manager")


class ConnectionManager:
    """Gestiona las conexiones WebSocket activas"""

    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, client_id: str, subprotocol: str | None = None):
        """Conecta un nuevo cliente. `subprotocol` se eco al cliente cuando se autentica vía Sec-WebSocket-Protocol."""
        await websocket.accept(subprotocol=subprotocol)
        self.active_connections[client_id] = websocket
        logger.info(f"Cliente {client_id} conectado. Total: {len(self.active_connections)}")

    def disconnect(self, client_id: str):
        """Desconecta un cliente"""
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            logger.info(f"Cliente {client_id} desconectado. Total: {len(self.active_connections)}")

    async def send_message(self, client_id: str, message: dict):
        """Envía un mensaje a un cliente específico"""
        if client_id in self.active_connections:
            await self.active_connections[client_id].send_json(message)


manager = ConnectionManager()
