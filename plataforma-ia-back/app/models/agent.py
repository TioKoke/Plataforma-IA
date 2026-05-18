"""
Modelos Pydantic para agentes.
Define la estructura de datos para el catálogo de agentes en Cosmos DB.
"""
from pydantic import BaseModel, Field
from typing import List, Optional


class AgentBase(BaseModel):
    """Modelo base de un agente"""
    nombre: str
    tipo: str
    descripcion: str
    creador: str
    modelo: str
    estado: str
    enlace: str
    categoria: str
    division: str
    casos_uso: List[str] = []
    beneficios: List[str] = []
    icon_url: Optional[str] = None


class AgentCreate(AgentBase):
    """Modelo para crear un agente"""
    pass


class AgentUpdate(BaseModel):
    """Modelo para actualizar un agente"""
    nombre: Optional[str] = None
    tipo: Optional[str] = None
    descripcion: Optional[str] = None
    creador: Optional[str] = None
    modelo: Optional[str] = None
    estado: Optional[str] = None
    enlace: Optional[str] = None
    categoria: Optional[str] = None
    division: Optional[str] = None
    casos_uso: Optional[List[str]] = None
    beneficios: Optional[List[str]] = None
    icon_url: Optional[str] = None


class AgentInDB(AgentBase):
    """Modelo de agente tal como se almacena en Cosmos DB"""
    id: str


class AgentResponse(AgentBase):
    """Modelo de respuesta individual de un agente"""
    id: str


class AgentListResponse(BaseModel):
    """Respuesta con lista de agentes y metadata de filtrado"""
    agents: List[AgentResponse]
    total: int
    categorias: List[str]
    divisiones: List[str]
    creadores: List[str]
