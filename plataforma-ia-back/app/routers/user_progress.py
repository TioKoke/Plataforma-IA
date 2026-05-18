"""
Router de progreso de cursos interactivos por usuario.
Persiste el avance de cada usuario (lecciones y pasos completados) en Cosmos DB
bajo la clave `oid` del token JWT de Azure AD, que es estable e inmutable.
"""
from fastapi import APIRouter, Depends, HTTPException

from app.config import get_logger
from app.middleware.auth import require_user
from app.models.course_progress import CourseProgressResponse, CourseProgressUpdate
from app.services.cosmos_service import cosmos_service

logger = get_logger("user_progress_router")

router = APIRouter(prefix="/me", tags=["user_progress"])


def _user_key(payload: dict) -> str:
    """Extrae el identificador estable del usuario desde el token JWT."""
    oid = payload.get("oid") or payload.get("sub")
    if not oid:
        raise HTTPException(status_code=401, detail="Token sin identificador de usuario")
    return oid


@router.get("/course-progress", response_model=CourseProgressResponse)
def get_my_course_progress(payload: dict = Depends(require_user)):
    """Retorna el progreso de cursos del usuario autenticado."""
    user_id = _user_key(payload)
    doc = cosmos_service.get_user_course_progress(user_id)
    if not doc:
        return CourseProgressResponse(progress={}, updatedAt=None)
    return CourseProgressResponse(
        progress=doc.get("progress", {}),
        updatedAt=doc.get("updatedAt"),
    )


@router.put("/course-progress", response_model=CourseProgressResponse)
def put_my_course_progress(
    body: CourseProgressUpdate,
    payload: dict = Depends(require_user),
):
    """Upsert del progreso de cursos del usuario autenticado.
    Last-write-wins por `updatedAt`.
    """
    user_id = _user_key(payload)
    upn = payload.get("upn") or payload.get("preferred_username")

    progress_dict = {k: v.model_dump() for k, v in body.progress.items()}
    saved = cosmos_service.upsert_user_course_progress(
        user_id=user_id,
        upn=upn,
        progress=progress_dict,
        updated_at=body.updatedAt,
    )
    return CourseProgressResponse(
        progress=saved.get("progress", {}),
        updatedAt=saved.get("updatedAt"),
    )
