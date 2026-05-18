"""
Modelos Pydantic para el chat.
Define la estructura de datos para mensajes, peticiones y respuestas.
"""
from pydantic import BaseModel, Field
from typing import Literal, Optional, List
from datetime import datetime


class ChatMessage(BaseModel):
    """Modelo para un mensaje individual del chat"""
    id: str
    content: str
    sender: Literal["user", "ai"] = Field(
        description="Quien envió el mensaje: 'user' o 'ai'"
    )
    timestamp: datetime = Field(default_factory=datetime.now)

    class Config:
        json_schema_extra = {
            "example": {
                "id": "msg_123",
                "content": "¿Qué agente me ayuda con análisis de producción?",
                "sender": "user",
                "timestamp": "2025-01-24T10:30:00"
            }
        }


class UserContext(BaseModel):
    """Contexto del usuario autenticado"""
    email: Optional[str] = None
    name: Optional[str] = None
    division: Optional[str] = None


class ChatRequest(BaseModel):
    """Petición para enviar un mensaje al chat"""
    message: str = Field(
        min_length=1,
        max_length=8000,
        description="Mensaje del usuario"
    )
    conversation_id: Optional[str] = Field(
        default=None,
        description="ID de la conversación para mantener contexto"
    )
    user_context: Optional[UserContext] = Field(
        default=None,
        description="Contexto del usuario autenticado"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "message": "¿Qué agente me ayuda con análisis de producción?",
                "conversation_id": "conv_abc123",
                "user_context": {"email": "usuario@plataforma-ia.example"}
            }
        }


class FileAttachment(BaseModel):
    """Archivo adjunto en la respuesta"""
    name: str
    size: int
    url: Optional[str] = None
    data: Optional[str] = None


class ChatResponse(BaseModel):
    """Respuesta del chat"""
    message_id: str
    content: str
    conversation_id: str
    timestamp: datetime = Field(default_factory=datetime.now)
    model_used: Optional[str] = None
    files: Optional[List[FileAttachment]] = Field(
        default=None,
        description="Archivos generados por el agente"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "message_id": "msg_456",
                "content": "Para análisis de producción, te recomiendo CopperData AI...",
                "conversation_id": "conv_abc123",
                "timestamp": "2025-01-24T10:30:05",
                "model_used": "gpt-5.2-chat",
                "files": [
                    {
                        "name": "reporte.xlsx",
                        "size": 45678,
                        "url": "http://localhost:8000/files/reporte.xlsx"
                    }
                ]
            }
        }


class WebSocketMessage(BaseModel):
    """Mensaje para comunicación WebSocket"""
    type: Literal["message", "typing", "error", "connected"]
    data: Optional[dict] = None
    error: Optional[str] = None


class AIErrorResponse(BaseModel):
    """Respuesta de error estandarizada del servicio de IA"""
    error_type: Literal["rate_limit", "connection", "model", "overload", "unknown"]
    user_message: str = Field(
        description="Mensaje amigable para el usuario (ya traducido al español)"
    )
    retry_after: Optional[int] = Field(
        default=None,
        description="Segundos sugeridos antes de reintentar (solo si aplica)"
    )
    is_retryable: bool = Field(
        default=True,
        description="Si el usuario puede reintentar la solicitud"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "error_type": "rate_limit",
                "user_message": "Estamos recibiendo muchas solicitudes. Espera un momento e intenta de nuevo.",
                "retry_after": 60,
                "is_retryable": True
            }
        }
