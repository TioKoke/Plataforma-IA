"""
Modelos Pydantic para videos educativos.
Define la estructura de datos para el catálogo de videos en Cosmos DB.
"""
from typing import List, Literal, Optional

from pydantic import BaseModel


VideoLevel = Literal["Básico", "Intermedio", "Avanzado"]


class VideoBase(BaseModel):
    """Modelo base de un video"""
    title: str
    duration: Optional[str] = None  # Ej: "5 min". Autogenerado desde YouTube si falta.
    level: VideoLevel
    category: str
    youtube_id: str
    description: str
    company: str


class VideoCreate(VideoBase):
    """Modelo para crear un video"""
    pass


class VideoUpdate(BaseModel):
    """Modelo para actualizar un video"""
    title: Optional[str] = None
    duration: Optional[str] = None
    level: Optional[VideoLevel] = None
    category: Optional[str] = None
    youtube_id: Optional[str] = None
    description: Optional[str] = None
    company: Optional[str] = None


class VideoResponse(VideoBase):
    """Modelo de respuesta individual de un video"""
    id: str
    thumbnail: str  # Computado desde youtube_id


class VideoListResponse(BaseModel):
    """Respuesta con lista de videos y metadata de filtrado"""
    videos: List[VideoResponse]
    total: int
    categories: List[str]
    levels: List[str]
