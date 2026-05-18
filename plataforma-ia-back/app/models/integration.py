"""
Modelos Pydantic para integraciones OAuth (Outlook, Jira).
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class IntegrationStatus(BaseModel):
    """Estado de conexión de una integración (respuesta al frontend)."""
    service: str
    status: str  # "connected" | "disconnected" | "expired"
    connected_at: Optional[datetime] = None
    scopes: list[str] = []


class IntegrationStatusResponse(BaseModel):
    """Lista de estados de integraciones."""
    integrations: list[IntegrationStatus]


class OAuthStateRequest(BaseModel):
    """Estado OAuth almacenado temporalmente para validar callbacks."""
    user_email: str
    service: str
    code_verifier: Optional[str] = None  # Solo para PKCE (Jira)
    created_at: datetime
