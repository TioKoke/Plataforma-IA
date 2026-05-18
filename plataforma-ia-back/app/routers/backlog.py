"""
Router de backlog de requerimientos.
Endpoints REST para gestionar el backlog de propuestas de nuevos agentes IA.
"""
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.config import config, get_logger
from app.middleware.auth import require_reviewer_or_admin, require_user
from app.models.backlog import (
    BacklogCreate,
    BacklogResponse,
    BacklogListResponse,
    BacklogEstadoUpdate,
    BacklogUpdateFull,
)
from app.services.cosmos_service import cosmos_service

logger = get_logger("backlog_router")

router = APIRouter(prefix="/backlogs", tags=["backlogs"])


def _to_response(item: dict) -> BacklogResponse:
    return BacklogResponse(**item)


@router.get("/", response_model=BacklogListResponse)
def list_backlogs(
    division: Optional[str] = Query(None, description="Filtrar por división"),
    estado: Optional[str] = Query(None, description="Filtrar por estado"),
    prioridad: Optional[str] = Query(None, description="Filtrar por prioridad"),
    mi_email: Optional[str] = Query(None, description="Solo requerimientos de este email"),
    _user: dict = Depends(require_user),
):
    """Lista requerimientos con filtros opcionales."""
    items = cosmos_service.get_backlogs_filtered(
        division=division,
        estado=estado,
        prioridad=prioridad,
        solicitante_email=mi_email,
    )
    return BacklogListResponse(
        items=[_to_response(i) for i in items],
        total=len(items),
    )


@router.post("/", response_model=BacklogResponse, status_code=201)
def create_backlog(body: BacklogCreate, _user: dict = Depends(require_user)):
    """Crea un nuevo requerimiento desde formulario web."""
    backlog_id = f"bl_{uuid.uuid4().hex[:12]}"
    now = datetime.utcnow().isoformat()

    item = {
        "id": backlog_id,
        "titulo": body.titulo,
        "descripcion": body.descripcion,
        "problema_a_resolver": body.problema_a_resolver,
        "usuarios_objetivo": body.usuarios_objetivo,
        "funcionalidades_clave": body.funcionalidades_clave,
        "datos_fuentes": body.datos_fuentes,
        "beneficio_esperado": body.beneficio_esperado,
        "estado": "pendiente",
        "prioridad": body.prioridad,
        "division": body.division,
        "solicitante_nombre": body.solicitante_nombre,
        "solicitante_email": body.solicitante_email,
        "origen": body.origen,
        "conversation_id": body.conversation_id,
        "created_at": now,
        "updated_at": now,
        "votos": 0,
    }

    created = cosmos_service.create_backlog(item)
    return _to_response(created)


@router.get("/{backlog_id}", response_model=BacklogResponse)
def get_backlog(backlog_id: str, division: str = Query(..., description="División (partition key)"), _user: dict = Depends(require_user)):
    """Obtiene un requerimiento por ID."""
    item = cosmos_service.get_backlog_by_id(backlog_id, division)
    if not item:
        raise HTTPException(status_code=404, detail=f"Requerimiento '{backlog_id}' no encontrado")
    return _to_response(item)


@router.patch("/{backlog_id}/estado", response_model=BacklogResponse)
async def update_estado(
    backlog_id: str,
    body: BacklogEstadoUpdate,
    division: str = Query(..., description="División (partition key)"),
    _admin: dict = Depends(require_reviewer_or_admin),
):
    """Cambia el estado de un requerimiento. Requiere rol Reviewer o Admin en Azure AD."""
    item = cosmos_service.update_backlog_estado(backlog_id, division, body.estado)
    if not item:
        raise HTTPException(status_code=404, detail=f"Requerimiento '{backlog_id}' no encontrado")
    return _to_response(item)


@router.post("/{backlog_id}/votar", response_model=BacklogResponse)
def votar(
    backlog_id: str,
    division: str = Query(..., description="División (partition key)"),
    voter_email: str = Query(..., description="Email del usuario que vota"),
    _user: dict = Depends(require_user),
):
    """Agrega un voto (+1) a un requerimiento. Máximo 1 voto por usuario."""
    item = cosmos_service.get_backlog_by_id(backlog_id, division)
    if not item:
        raise HTTPException(status_code=404, detail=f"Requerimiento '{backlog_id}' no encontrado")

    votos_usuarios = item.get("votos_usuarios", [])
    if voter_email in votos_usuarios:
        raise HTTPException(status_code=409, detail="Ya votaste por este requerimiento")

    updated = cosmos_service.upvote_backlog(backlog_id, division, voter_email)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Requerimiento '{backlog_id}' no encontrado")
    return _to_response(updated)


# ── RUTAS DE ADMINISTRADOR ────────────────────────────────────────────────────────


@router.put("/{backlog_id}", response_model=BacklogResponse)
def update_backlog_full(
    backlog_id: str,
    division: str,
    body: BacklogUpdateFull,
    _admin: dict = Depends(require_reviewer_or_admin),
):
    """Actualiza de forma completa un requerimiento (Admin)."""
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No hay datos para actualizar")
    
    updated = cosmos_service.update_backlog_full(backlog_id, division, updates)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Requerimiento '{backlog_id}' no encontrado")
    return _to_response(updated)


@router.delete("/{backlog_id}")
def delete_backlog(
    backlog_id: str,
    division: str,
    _admin: dict = Depends(require_reviewer_or_admin),
):
    """Elimina un requerimiento (Admin)."""
    success = cosmos_service.delete_backlog(backlog_id, division)
    if not success:
        raise HTTPException(status_code=404, detail=f"Requerimiento '{backlog_id}' no encontrado")
    return {"status": "ok", "message": f"Requerimiento '{backlog_id}' eliminado"}
