"""
Router de agentes.
Endpoints REST para consultar el catálogo de agentes desde Cosmos DB.
"""
from fastapi import APIRouter, HTTPException, Query, Depends, File, UploadFile, Response
from typing import Optional

from app.config import get_logger
from app.models.agent import AgentResponse, AgentListResponse, AgentCreate, AgentUpdate
from app.services.cosmos_service import cosmos_service
from app.services.storage_service import storage_service
from app.middleware.auth import require_reviewer_or_admin, require_user
import uuid

logger = get_logger("agents_router")

router = APIRouter(prefix="/agents", tags=["agents"])

# ── Validación de upload de íconos ────────────────────────────────────────────

_ALLOWED_ICON_TYPES = frozenset({"image/png", "image/jpeg", "image/webp", "image/svg+xml"})
_MAX_ICON_BYTES = 2 * 1024 * 1024  # 2 MB


def _detect_image_kind(content: bytes) -> str | None:
    """Detecta el tipo de imagen por magic bytes. Retorna None si no es reconocido."""
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if content[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    head = content[:200].lstrip()
    if head.startswith(b"<?xml") or head.startswith(b"<svg"):
        return "image/svg+xml"
    return None


def _validate_svg_safe(content: bytes) -> None:
    """
    Rechaza SVGs con `<script>` o event handlers (`on*`). Servir un SVG con
    scripts como `image/svg+xml` ejecuta JS en el origen del frontend → XSS.
    """
    from defusedxml.ElementTree import fromstring as defused_fromstring
    try:
        root = defused_fromstring(content)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"SVG inválido: {exc}")
    for elem in root.iter():
        tag = elem.tag.rsplit("}", 1)[-1].lower()  # strip namespace
        if tag == "script":
            raise HTTPException(status_code=400, detail="SVG con <script> no permitido")
        for attr_name in elem.attrib:
            if attr_name.lower().startswith("on"):
                raise HTTPException(status_code=400, detail="SVG con event handlers no permitido")


@router.post("/refresh")
def refresh_cache(_admin: dict = Depends(require_reviewer_or_admin)):
    """Recarga el catálogo de agentes desde Cosmos DB (Admin/Reviewer)."""
    agents = cosmos_service.load_cache()
    return {"status": "ok", "agents_loaded": len(agents)}


@router.get("/categories", response_model=list[str])
def list_categories():
    """Lista todas las categorías únicas de agentes."""
    return cosmos_service.get_categories()


@router.get("/divisions", response_model=list[str])
def list_divisions():
    """Lista todas las divisiones únicas de agentes."""
    return cosmos_service.get_divisions()


@router.get("/", response_model=AgentListResponse)
def list_agents(
    categoria: Optional[str] = Query(None, description="Filtrar por categoría"),
    division: Optional[str] = Query(None, description="Filtrar por división"),
    creador: Optional[str] = Query(None, description="Filtrar por creador"),
    search: Optional[str] = Query(None, description="Buscar por nombre o descripción"),
    _user: dict = Depends(require_user),
):
    """Lista agentes con filtros opcionales. Metadata siempre incluye todos los valores posibles."""
    agents = cosmos_service.get_agents_filtered(
        categoria=categoria,
        division=division,
        creador=creador,
        search=search,
    )

    return AgentListResponse(
        agents=[AgentResponse(**a) for a in agents],
        total=len(agents),
        categorias=cosmos_service.get_categories(),
        divisiones=cosmos_service.get_divisions(),
        creadores=cosmos_service.get_creators(),
    )


@router.post("/{agent_id}/icon", response_model=AgentResponse)
async def upload_agent_icon(
    agent_id: str,
    file: UploadFile = File(...),
    _admin: dict = Depends(require_reviewer_or_admin),
):
    """Sube un ícono para el agente y actualiza su icon_url (Admin)."""
    agent = cosmos_service.get_agent_by_id(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agente '{agent_id}' no encontrado")

    content = await file.read()
    if len(content) > _MAX_ICON_BYTES:
        raise HTTPException(status_code=413, detail="Ícono excede el tamaño máximo (2 MB)")

    detected = _detect_image_kind(content)
    if detected is None or detected not in _ALLOWED_ICON_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Tipo de archivo no soportado (solo PNG, JPEG, WEBP o SVG)",
        )
    if detected == "image/svg+xml":
        _validate_svg_safe(content)

    storage_service.upload_icon(content, agent_id)

    updated = cosmos_service.update_agent(
        agent_id, agent["categoria"], {"icon_url": f"/agents/{agent_id}/icon"}
    )
    return AgentResponse(**updated)


@router.get("/{agent_id}/icon")
def get_agent_icon(agent_id: str):
    """Sirve el ícono del agente desde el storage."""
    try:
        content = storage_service.download_icon(agent_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Ícono no encontrado")

    # Detectar content-type por magic bytes
    content_type = "image/png"
    if content[:2] == b"\xff\xd8":
        content_type = "image/jpeg"
    elif content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        content_type = "image/webp"
    elif content[:5] in (b"<?xml", b"<svg "):
        content_type = "image/svg+xml"

    return Response(content=content, media_type=content_type)


@router.get("/{agent_id}", response_model=AgentResponse)
def get_agent(agent_id: str, _user: dict = Depends(require_user)):
    """Obtiene un agente por su ID."""
    agent = cosmos_service.get_agent_by_id(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agente '{agent_id}' no encontrado")
    return AgentResponse(**agent)


# ── RUTAS DE ADMINISTRADOR ────────────────────────────────────────────────────────


@router.post("/", response_model=AgentResponse, status_code=201)
def create_agent(
    body: AgentCreate,
    _admin: dict = Depends(require_reviewer_or_admin),
):
    """Crea un nuevo agente (Admin)."""
    # Generar un ID simple en base a uuid si prefieres, o pasarlo en el body.
    agent_id = f"ag_{uuid.uuid4().hex[:12]}"
    item = body.model_dump()
    item["id"] = agent_id

    created = cosmos_service.create_agent(item)
    return AgentResponse(**created)


@router.put("/{agent_id}", response_model=AgentResponse)
def update_agent(
    agent_id: str,
    categoria: str,  # required for partition key
    body: AgentUpdate,
    _admin: dict = Depends(require_reviewer_or_admin),
):
    """Actualiza un agente (Admin)."""
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No se enviaron datos para actualizar")
    
    updated = cosmos_service.update_agent(agent_id, categoria, updates)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Agente '{agent_id}' no encontrado en la categoría '{categoria}'")
    return AgentResponse(**updated)


@router.delete("/{agent_id}")
def delete_agent(
    agent_id: str,
    categoria: str,  # required for partition key
    _admin: dict = Depends(require_reviewer_or_admin),
):
    """Elimina un agente (Admin)."""
    success = cosmos_service.delete_agent(agent_id, categoria)
    if not success:
        raise HTTPException(status_code=404, detail=f"Agente '{agent_id}' no encontrado en la categoría '{categoria}'")
    return {"status": "ok", "message": f"Agente '{agent_id}' eliminado"}

