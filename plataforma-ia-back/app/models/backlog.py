"""
Modelos Pydantic para el backlog de requerimientos de agentes IA.
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime


BacklogEstado = Literal["pendiente", "en_revision", "aprobado", "rechazado", "en_desarrollo"]
BacklogPrioridad = Literal["baja", "media", "alta", "critica"]


class BacklogCreate(BaseModel):
    """Formulario de creación de requerimiento (REST o chat)."""
    titulo: str
    descripcion: str
    problema_a_resolver: str
    usuarios_objetivo: str
    funcionalidades_clave: List[str] = []
    datos_fuentes: str = ""
    beneficio_esperado: str = ""
    prioridad: BacklogPrioridad = "media"
    division: str
    solicitante_nombre: str
    solicitante_email: str
    origen: Literal["chat", "formulario"] = "formulario"
    conversation_id: Optional[str] = None


class BacklogResponse(BaseModel):
    """Respuesta de un requerimiento individual."""
    id: str
    titulo: str
    descripcion: str
    problema_a_resolver: str
    usuarios_objetivo: str
    funcionalidades_clave: List[str] = []
    datos_fuentes: str = ""
    beneficio_esperado: str = ""
    estado: BacklogEstado
    prioridad: BacklogPrioridad
    division: str
    solicitante_nombre: str
    solicitante_email: str
    origen: str
    conversation_id: Optional[str] = None
    created_at: str
    updated_at: str
    votos: int = 0
    votos_usuarios: List[str] = []


class BacklogListResponse(BaseModel):
    """Respuesta con lista de requerimientos."""
    items: List[BacklogResponse]
    total: int


class BacklogEstadoUpdate(BaseModel):
    """Payload para cambiar el estado de un requerimiento."""
    estado: BacklogEstado


class BacklogUpdateFull(BaseModel):
    """Payload para actualizar completamente un requerimiento (Admin)."""
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    problema_a_resolver: Optional[str] = None
    usuarios_objetivo: Optional[str] = None
    funcionalidades_clave: Optional[List[str]] = None
    datos_fuentes: Optional[str] = None
    beneficio_esperado: Optional[str] = None
    prioridad: Optional[BacklogPrioridad] = None
    estado: Optional[BacklogEstado] = None
    division: Optional[str] = None
    solicitante_nombre: Optional[str] = None
    solicitante_email: Optional[str] = None
