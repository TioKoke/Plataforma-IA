"""
Aplicación principal de FastAPI.
Punto de entrada del backend de Plataforma IA.
Usa el SDK de OpenAI con Azure AI Foundry.
"""
import asyncio
import time
from collections import defaultdict
from typing import Deque
from collections import deque

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import config, get_logger
from app.routers import (
    chat_router,
    agents_router,
    backlog_router,
    stats_router,
    integrations_router,
    user_progress_router,
    videos_router,
)
from app.agents.file_security import apply_defused_xml


# ── Rate limiting (M-1 pentest) ──────────────────────────────────────────────
# Implementación simple in-memory. Una sola replica por entorno en Container
# Apps, así que no necesitamos storage compartido (Redis). Si en el futuro
# hay autoscale > 1 replica, migrar a `redis-py` + `limits.aio`.
_RATE_LIMIT_PER_MIN = 120
_RATE_LIMIT_WINDOW_S = 60.0
_request_log: dict[str, Deque[float]] = defaultdict(deque)


def _rate_limit_key(request: Request) -> str:
    """
    Identifica al cliente: por `oid` del JWT si está disponible, sino por IP.
    Ata el límite al usuario, no a la IP — la VPN corporativa hace que muchos
    compartan IP de salida.
    """
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        token = auth.split(" ", 1)[1]
        try:
            import base64, json as _json
            parts = token.split(".")
            if len(parts) >= 2:
                payload_b64 = parts[1] + "=" * (-len(parts[1]) % 4)
                payload = _json.loads(base64.urlsafe_b64decode(payload_b64))
                oid = payload.get("oid") or payload.get("sub")
                if oid:
                    return f"user:{oid}"
        except Exception:
            pass
    # Container Apps inyecta X-Forwarded-For; preferir el primer salto real.
    xff = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    return f"ip:{xff or (request.client.host if request.client else 'unknown')}"

logger = get_logger("main")

# Hardening anti-XXE para parseo XML compartido (openpyxl, lxml, terceros).
apply_defused_xml()

# Crear aplicación FastAPI
app = FastAPI(
    title="Plataforma IA - Backend",
    description="API para el chat conversacional de la Plataforma IA de Plataforma IA",
    version="1.0.0",
    docs_url="/docs" if config.is_development else None,
    redoc_url="/redoc" if config.is_development else None,
)

# Rate limiting (M-1 pentest) - aplica a TODAS las rutas
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    """120 req/min por usuario (oid del JWT) o por IP. Excluye /health."""
    if request.url.path == "/health":
        return await call_next(request)
    key = _rate_limit_key(request)
    now = time.time()
    log = _request_log[key]
    # Purgar timestamps fuera de la ventana de 60s
    while log and now - log[0] > _RATE_LIMIT_WINDOW_S:
        log.popleft()
    if len(log) >= _RATE_LIMIT_PER_MIN:
        retry_after = int(_RATE_LIMIT_WINDOW_S - (now - log[0])) + 1
        return JSONResponse(
            {"detail": f"Rate limit exceeded: {_RATE_LIMIT_PER_MIN} req/min"},
            status_code=429,
            headers={"Retry-After": str(retry_after)},
        )
    log.append(now)
    return await call_next(request)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    """
    Inyecta headers de seguridad en cada response. Esta API sirve mayormente
    JSON y archivos binarios, así que se usa una CSP estricta. /docs y /redoc
    cargan CSS/JS de CDNs (jsdelivr, fastapi.tiangolo.com), por lo que no
    aplicamos CSP en esas rutas para que Swagger UI funcione.
    """
    response = await call_next(request)
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    path = request.url.path
    if not (path.startswith("/docs") or path.startswith("/redoc") or path.startswith("/openapi")):
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
    return response


# Incluir routers
app.include_router(chat_router)
app.include_router(agents_router)
app.include_router(backlog_router)
app.include_router(stats_router)
app.include_router(integrations_router)
app.include_router(user_progress_router)
app.include_router(videos_router)


# Referencia a la tarea de cleanup para cancelarla en shutdown
_cleanup_task = None

# TTL de archivos huérfanos en horas (uploads y generated sin conversación activa)
FILE_TTL_HOURS = 4


async def _periodic_file_cleanup():
    """Elimina archivos huérfanos de uploads/ y generated/ más antiguos que FILE_TTL_HOURS."""
    import time
    from app.services.storage_service import storage_service

    ttl_seconds = FILE_TTL_HOURS * 3600

    while True:
        await asyncio.sleep(3600)  # Ejecutar cada hora
        try:
            deleted = 0
            now = time.time()
            for prefix in ("generated", "uploads"):
                blobs = storage_service.list_blobs(prefix)
                for blob_path in blobs:
                    try:
                        mtime = storage_service.get_blob_mtime(blob_path)
                        # mtime == 0.0 → no se pudo determinar; no se borra.
                        if mtime and (now - mtime) > ttl_seconds:
                            storage_service.delete_blob(blob_path)
                            deleted += 1
                    except Exception as e:
                        logger.warning(f"Error evaluando TTL para {blob_path}: {e}")
            if deleted:
                logger.info(f"Cleanup periódico: {deleted} archivo(s) huérfano(s) eliminado(s)")
        except Exception as e:
            logger.warning(f"Error en cleanup periódico de archivos: {e}")


@app.on_event("startup")
async def startup_event():
    """Evento de inicio de la aplicación"""
    global _cleanup_task

    logger.info("=" * 70)
    logger.info("Plataforma IA PLATAFORMA IA - BACKEND")
    logger.info("=" * 70)
    logger.info(f"Ambiente: {config.ENVIRONMENT}")
    logger.info(f"Modelo de chat: {config.CHAT_MODEL}")
    logger.info(f"Puerto: {config.API_PORT}")
    logger.info("=" * 70)

    from app.services.assistant_service import assistant_service
    try:
        assistant_id = await assistant_service.ensure_assistant()
        logger.info(f"Assistant ready: {assistant_id}")
    except Exception as e:
        logger.error(f"Error al inicializar Assistant: {e}")

    # Iniciar tarea periódica de cleanup de archivos huérfanos
    _cleanup_task = asyncio.create_task(_periodic_file_cleanup())
    logger.info(f"Cleanup periódico de archivos activado (TTL: {FILE_TTL_HOURS}h)")


@app.on_event("shutdown")
async def shutdown_event():
    """Evento de cierre de la aplicación"""
    global _cleanup_task
    if _cleanup_task:
        _cleanup_task.cancel()
        logger.info("Cleanup periódico de archivos detenido")


@app.get("/")
async def root():
    """Endpoint raíz"""
    return {
        "service": "Plataforma IA - Backend",
        "version": "1.0.0",
        "status": "running",
        "sdk": "OpenAI",
        "docs": "/docs" if config.is_development else "disabled",
    }


@app.get("/health")
async def health():
    """Health check endpoint"""
    try:
        # Intentar validar la conexión
        config.validate()

        return {
            "status": "healthy",
            "environment": config.ENVIRONMENT,
            "chat_model": config.CHAT_MODEL,
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "error": str(e)
            }
        )


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Manejador global de excepciones"""
    logger.error(f"Error no manejado: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": str(exc) if config.is_development else "An error occurred"
        }
    )


if __name__ == "__main__":
    import uvicorn

    logger.info(f"Iniciando servidor en {config.API_HOST}:{config.API_PORT}")

    uvicorn.run(
        "app.main:app",
        host=config.API_HOST,
        port=config.API_PORT,
        reload=config.is_development,
    )
