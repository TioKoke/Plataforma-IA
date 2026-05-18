"""
Router de videos educativos.
Endpoints REST para el catálogo de videos servido desde Cosmos DB.
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.config import get_logger
from app.middleware.auth import require_reviewer_or_admin
from app.models.video import (
    VideoCreate,
    VideoListResponse,
    VideoResponse,
    VideoUpdate,
)
from app.services.cosmos_service import cosmos_service
from app.services.youtube_metadata import get_duration_minutes

logger = get_logger("videos_router")

router = APIRouter(prefix="/videos", tags=["videos"])


def _to_response(item: dict) -> VideoResponse:
    """Convierte un doc de Cosmos a VideoResponse con thumbnail computado."""
    youtube_id = item.get("youtube_id", "")
    return VideoResponse(
        id=item["id"],
        title=item.get("title", ""),
        duration=item.get("duration"),
        level=item.get("level", "Básico"),
        category=item.get("category", ""),
        youtube_id=youtube_id,
        description=item.get("description", ""),
        company=item.get("company", ""),
        thumbnail=f"https://img.youtube.com/vi/{youtube_id}/maxresdefault.jpg",
    )


@router.post("/refresh")
def refresh_cache():
    """Recarga el catálogo de videos desde Cosmos DB."""
    videos = cosmos_service.load_videos_cache()
    return {"status": "ok", "videos_loaded": len(videos)}


@router.get("/categories", response_model=list[str])
def list_categories():
    """Lista todas las categorías únicas de videos."""
    return cosmos_service.get_video_categories()


@router.get("/levels", response_model=list[str])
def list_levels():
    """Lista todos los niveles únicos de videos."""
    return cosmos_service.get_video_levels()


@router.get("/", response_model=VideoListResponse)
def list_videos(
    level: Optional[str] = Query(None, description="Filtrar por nivel"),
    category: Optional[str] = Query(None, description="Filtrar por categoría"),
    search: Optional[str] = Query(None, description="Buscar por título o descripción"),
):
    """Lista videos con filtros opcionales."""
    videos = cosmos_service.get_videos_filtered(level=level, category=category, search=search)
    return VideoListResponse(
        videos=[_to_response(v) for v in videos],
        total=len(videos),
        categories=cosmos_service.get_video_categories(),
        levels=cosmos_service.get_video_levels(),
    )


@router.get("/{video_id}", response_model=VideoResponse)
def get_video(video_id: str):
    """Obtiene un video por su ID."""
    video = cosmos_service.get_video_by_id(video_id)
    if not video:
        raise HTTPException(status_code=404, detail=f"Video '{video_id}' no encontrado")
    return _to_response(video)


# ── RUTAS DE ADMINISTRADOR ────────────────────────────────────────────────────────


@router.post("/", response_model=VideoResponse, status_code=201)
def create_video(
    body: VideoCreate,
    _admin: dict = Depends(require_reviewer_or_admin),
):
    """Crea un nuevo video (Reviewer/Admin). Auto-completa duración si falta."""
    item = body.model_dump()
    if not item.get("duration"):
        item["duration"] = get_duration_minutes(item["youtube_id"])

    video_id = f"vid_{uuid.uuid4().hex[:12]}"
    item["id"] = video_id

    created = cosmos_service.create_video(item)
    return _to_response(created)


@router.put("/{video_id}", response_model=VideoResponse)
def update_video(
    video_id: str,
    body: VideoUpdate,
    _admin: dict = Depends(require_reviewer_or_admin),
):
    """Actualiza un video (Reviewer/Admin). Si cambia youtube_id y duration está vacío, re-consulta duración."""
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No se enviaron datos para actualizar")

    # Si el admin actualizó el youtube_id y no dio una duration explícita, la refrescamos.
    if "youtube_id" in updates and not updates.get("duration"):
        fresh = get_duration_minutes(updates["youtube_id"])
        if fresh:
            updates["duration"] = fresh

    updated = cosmos_service.update_video(video_id, updates)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Video '{video_id}' no encontrado")
    return _to_response(updated)


@router.delete("/{video_id}")
def delete_video(
    video_id: str,
    _admin: dict = Depends(require_reviewer_or_admin),
):
    """Elimina un video (Reviewer/Admin)."""
    success = cosmos_service.delete_video(video_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Video '{video_id}' no encontrado")
    return {"status": "ok", "message": f"Video '{video_id}' eliminado"}
