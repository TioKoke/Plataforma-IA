"""
Router para endpoints del chat.
Define los endpoints WebSocket y REST para el chat conversacional.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File, Form, Depends
from fastapi.responses import FileResponse, Response, JSONResponse
from typing import List, Optional
from app.middleware.auth import require_reviewer_or_admin, require_user, decode_token_string
import json
import logging
import uuid
import os
from datetime import datetime
from pathlib import Path

from app.models.chat import ChatRequest, ChatResponse, FileAttachment, UserContext, AIErrorResponse
from app.services.assistant_service import assistant_service
from app.services.storage_service import storage_service
from app.utils.file_processor import file_processor
from app.config import config
from app.exceptions import AIError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


async def _refine_conversation_title(
    conversation_id: str,
    user_message: str,
    assistant_text: str,
) -> None:
    """Pide a Claude un título corto de 3-5 palabras para la conversación y
    actualiza el documento en MongoDB. Best-effort, fire-and-forget.

    Se ejecuta como tarea background tras la primera respuesta de una
    conversación nueva. Si falla, queda el título inicial (primer mensaje).
    """
    try:
        from app.services.azure_ai import azure_ai_service
        from app.services.cosmos_service import cosmos_service
        client = azure_ai_service._get_anthropic_client()
        # Acortar texto de assistant para mantener barato el prompt.
        assistant_snippet = (assistant_text or "")[:600]
        prompt = (
            "Generá un título de 3 a 5 palabras que resuma esta conversación.\n"
            "Solo el título, sin comillas, sin punto final, sin prefijos.\n\n"
            f"Usuario: {user_message}\n"
            f"Asistente: {assistant_snippet}"
        )
        resp = await client.messages.create(
            model=config.CHAT_MODEL,
            max_tokens=30,
            temperature=0.3,
            messages=[{"role": "user", "content": prompt}],
        )
        # Extraer texto de la respuesta
        blocks = resp.content or []
        title = "".join(
            getattr(b, "text", "") for b in blocks if getattr(b, "type", None) == "text"
        ).strip()
        # Sanitización: quitar comillas, salto de línea, longitud máx ~60 chars.
        title = title.strip().strip('"\'`').splitlines()[0].strip()
        if title.endswith('.'):
            title = title[:-1]
        if not title:
            return
        title = title[:60]
        cosmos_service.update_conversation_title(conversation_id, title)
        logger.info(f"Título refinado para {conversation_id}: {title!r}")
    except Exception as e:
        logger.warning(f"No se pudo refinar el título de {conversation_id}: {e}")


def detect_generated_files(response_text: str) -> List[FileAttachment]:
    """
    Detecta archivos mencionados en la respuesta del agente y los convierte en FileAttachment.
    Busca archivos en storage (blob o local) con prefijo 'generated/' y 'uploads/'.

    Args:
        response_text: Texto de respuesta del agente

    Returns:
        Lista de archivos detectados
    """
    import re

    files = []
    seen = set()

    # Buscar patrones de nombres de archivo (con extensiones comunes)
    file_pattern = r'([a-zA-Z0-9_\-]+\.(xlsx|xls|pdf|docx|doc|txt|csv|json|png|jpg|jpeg))'
    matches = re.findall(file_pattern, response_text, re.IGNORECASE)

    for match in matches:
        filename = match[0]
        if filename in seen:
            continue

        # Buscar en generated/ primero, luego en uploads/
        for prefix in ("generated", "uploads"):
            blob_path = f"{prefix}/{filename}"
            if storage_service.blob_exists(blob_path):
                files.append(FileAttachment(
                    name=filename,
                    size=0,
                    url=f"/chat/files/{filename}"
                ))
                seen.add(filename)
                logger.info(f"Archivo detectado en storage ({prefix}): {filename}")
                break

    return files


from app.services.connection_manager import manager


_WS_BEARER_MARKER = "plataforma-ia.bearer.v1"


@router.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """
    Endpoint WebSocket para chat en tiempo real.

    Args:
        websocket: Conexión WebSocket
        client_id: ID único del cliente

    Auth: el cliente pasa el token Azure AD por `Sec-WebSocket-Protocol`
    como segundo subprotocol después del marker `plataforma-ia.bearer.v1`.
    El primer subprotocol identifica el esquema, el segundo lleva el JWT.
    Esto evita que el token aparezca en URLs/Referer/historial del browser.
    Mantiene fallback temporal a query string `?token=...` para clientes
    legacy durante la transición.
    """
    # Validar token ANTES de aceptar el handshake. Si falta o es inválido,
    # cerramos sin completar el handshake.
    subprotocols: list[str] = list(websocket.scope.get("subprotocols") or [])
    accepted_subprotocol: str | None = None
    token: str | None = None
    if len(subprotocols) >= 2 and subprotocols[0] == _WS_BEARER_MARKER:
        token = subprotocols[1]
        accepted_subprotocol = _WS_BEARER_MARKER
    else:
        token = websocket.query_params.get("token")

    try:
        await decode_token_string(token)
    except HTTPException as e:
        await websocket.close(code=1008, reason=str(e.detail)[:120])
        return

    await manager.connect(websocket, client_id, subprotocol=accepted_subprotocol)

    # Enviar mensaje de bienvenida
    await manager.send_message(client_id, {
        "type": "connected",
        "data": {
            "message": "Conectado al chat de Plataforma IA",
            "client_id": client_id
        }
    })

    conversation_id = None

    try:
        while True:
            # Recibir mensaje del cliente
            data = await websocket.receive_text()

            try:
                message_data = json.loads(data)
                user_message = message_data.get("message", "")
                conversation_id = message_data.get("conversation_id", conversation_id)

                if not user_message:
                    await manager.send_message(client_id, {
                        "type": "error",
                        "error": "Mensaje vacío"
                    })
                    continue

                # Indicar que el agente está escribiendo
                await manager.send_message(client_id, {
                    "type": "typing",
                    "data": {"typing": True}
                })

                # Extraer user_context si viene en el mensaje
                user_context = None
                user_context_data = message_data.get("user_context")
                if user_context_data and isinstance(user_context_data, dict):
                    try:
                        user_context = UserContext(**user_context_data)
                    except Exception:
                        pass

                # Extraer agent_id si viene del catálogo (Probar un agente).
                agent_id = message_data.get("agent_id")
                if agent_id and not isinstance(agent_id, str):
                    agent_id = None

                # Callback que reenvía eventos del agente al cliente en tiempo real
                async def ws_event_callback(event: dict) -> None:
                    try:
                        await manager.send_message(client_id, event)
                    except Exception:
                        pass  # cliente desconectado durante el streaming

                # Procesar mensaje con streaming de eventos
                prev_conv_id = conversation_id
                response_text, conversation_id = await assistant_service.process_message(
                    message=user_message,
                    conversation_id=conversation_id,
                    user_context=user_context,
                    event_callback=ws_event_callback,
                    agent_id=agent_id,
                )

                # Persistir conversación nueva en Cosmos DB.
                # 1) Título inicial = primer mensaje del usuario truncado (instantáneo).
                # 2) Fire-and-forget: pedimos a Claude un summary de 3-5 palabras y
                #    actualizamos el título cuando llega — estilo Claude.ai.
                if not prev_conv_id:
                    try:
                        from app.services.cosmos_service import cosmos_service
                        first_msg = (user_message or "").strip()
                        title = first_msg[:80] if first_msg else None
                        if title and len(first_msg) > 80:
                            title = title.rsplit(" ", 1)[0] + "…"
                        cosmos_service.save_conversation(
                            conversation_id=conversation_id,
                            thread_id=None,
                            user_email=user_context.email if user_context else None,
                            division=user_context.division if user_context else None,
                            title=title,
                            agent_id=agent_id,
                        )
                        # Upgrade del título con LLM summary — async background.
                        import asyncio as _asyncio
                        _asyncio.create_task(_refine_conversation_title(
                            conversation_id, first_msg, response_text or ""
                        ))
                    except Exception as _e:
                        logger.warning(f"Error guardando conversación en Cosmos (WS): {_e}")

                # Detectar archivos generados para incluirlos en los eventos
                generated_files = detect_generated_files(response_text)
                files_payload = [
                    {"name": f.name, "size": f.size, "url": f.url}
                    for f in generated_files
                ] if generated_files else []

                # stream_end — indica al frontend que finalice el mensaje en progreso
                await manager.send_message(client_id, {
                    "type": "stream_end",
                    "data": {
                        "conversation_id": conversation_id,
                        "timestamp": datetime.now().isoformat(),
                        "files": files_payload,
                    }
                })

                # message_complete — compatibilidad con clientes legacy / REST
                await manager.send_message(client_id, {
                    "type": "message_complete",
                    "data": {
                        "message_id": f"msg_{uuid.uuid4().hex[:12]}",
                        "content": response_text,
                        "conversation_id": conversation_id,
                        "timestamp": datetime.now().isoformat(),
                        "files": files_payload,
                    }
                })

            except json.JSONDecodeError:
                await manager.send_message(client_id, {
                    "type": "error",
                    "error": "Formato de mensaje inválido"
                })
            except Exception as e:
                logger.error(f"Error procesando mensaje: {e}")
                await manager.send_message(client_id, {
                    "type": "error",
                    "error": str(e)
                })

    except WebSocketDisconnect:
        manager.disconnect(client_id)
        logger.info(f"Cliente {client_id} desconectado")
    except Exception as e:
        logger.error(f"Error en WebSocket: {e}")
        manager.disconnect(client_id)


@router.post("/message", response_model=ChatResponse)
async def send_message(request: ChatRequest, _user: dict = Depends(require_user)):
    """
    Endpoint REST para enviar un mensaje al chat.

    Args:
        request: Petición con el mensaje del usuario

    Returns:
        Respuesta del agente
    """
    try:
        # Procesar mensaje
        response_text, conversation_id = await assistant_service.process_message(
            message=request.message,
            conversation_id=request.conversation_id,
            user_context=request.user_context,
        )

        # Persistir conversación nueva en Cosmos DB
        if not request.conversation_id:
            try:
                from app.services.cosmos_service import cosmos_service
                cosmos_service.save_conversation(
                    conversation_id=conversation_id,
                    thread_id=None,
                    user_email=request.user_context.email if request.user_context else None,
                    division=request.user_context.division if request.user_context else None,
                )
            except Exception as _e:
                logger.warning(f"Error guardando conversación en Cosmos: {_e}")

        # Detectar archivos generados
        generated_files = detect_generated_files(response_text)

        # Crear respuesta
        return ChatResponse(
            message_id=f"msg_{uuid.uuid4().hex[:12]}",
            content=response_text,
            conversation_id=conversation_id,
            timestamp=datetime.now(),
            model_used=config.CHAT_MODEL,
            files=generated_files if generated_files else None
        )

    except AIError as e:
        logger.error(f"Error de IA en /message: {e.user_message}")
        error_response = AIErrorResponse(
            error_type=e.error_type,
            user_message=e.user_message,
            retry_after=e.retry_after,
            is_retryable=e.is_retryable,
        )
        return JSONResponse(
            status_code=e.http_status_code,
            content=error_response.model_dump(),
        )
    except Exception as e:
        logger.error(f"Error en /message: {e}")
        error_response = AIErrorResponse(
            error_type="unknown",
            user_message="Algo salió mal. Por favor intenta de nuevo en un momento.",
            retry_after=None,
            is_retryable=True,
        )
        return JSONResponse(
            status_code=500,
            content=error_response.model_dump(),
        )


@router.get("/health")
async def health_check():
    """
    Endpoint de health check.

    Returns:
        Estado del servicio
    """
    return {
        "status": "healthy",
        "service": "plataforma-ia-chat",
        "active_connections": len(manager.active_connections)
    }


@router.post("/conversation/new")
async def create_conversation(_user: dict = Depends(require_user)):
    """
    Crea una nueva conversación.

    Returns:
        ID de la conversación creada
    """
    conversation_id = assistant_service.create_conversation()
    return {
        "conversation_id": conversation_id,
        "created_at": datetime.now().isoformat()
    }


@router.get("/conversation/{conversation_id}/history")
async def get_conversation_history(conversation_id: str, limit: int = 50, _user: dict = Depends(require_user)):
    """
    Obtiene el historial de una conversación.

    Args:
        conversation_id: ID de la conversación
        limit: Número máximo de mensajes

    Returns:
        Historial de la conversación
    """
    return {
        "conversation_id": conversation_id,
        "message_count": 0,
        "messages": [],
        "note": "El historial de mensajes es gestionado por Azure OpenAI Assistants API threads.",
    }


@router.delete("/conversation/{conversation_id}/files")
async def delete_conversation_files(
    conversation_id: str,
    user: dict = Depends(require_user),
):
    """
    Elimina los archivos subidos asociados a una conversación.

    Pensado para el flujo de "Nuevo chat" en el cliente: libera blobs del chat
    previo sin tocar la metadata de Cosmos ni el historial en memoria.

    Autorización: el token debe pertenecer al usuario dueño de la conversación
    (o tener rol Admin/Reviewer).
    """
    from app.services.cosmos_service import cosmos_service

    doc = cosmos_service.get_conversation(conversation_id)
    if doc is not None:
        owner_email = (doc.get("user_email") or "").lower()
        caller_email = (user.get("upn") or user.get("preferred_username") or "").lower()
        roles = user.get("roles", [])
        is_privileged = bool({"Admin", "Reviewer"}.intersection(roles))
        if owner_email and caller_email != owner_email and not is_privileged:
            raise HTTPException(
                status_code=403,
                detail="No tienes permiso para eliminar archivos de esta conversación",
            )

    deleted_blobs = assistant_service.cleanup_conversation_files(conversation_id)
    return {"status": "ok", "deleted_files": len(deleted_blobs)}


# ── RUTAS DE USUARIO: gestión de sus propias conversaciones ───────────────────


@router.get("/my-conversations")
async def get_my_conversations(user: dict = Depends(require_user)):
    """Lista las conversaciones del usuario autenticado, más recientes primero."""
    from app.services.cosmos_service import cosmos_service
    user_email = (user.get("upn") or user.get("preferred_username") or "").lower()
    if not user_email:
        return {"total": 0, "items": []}
    items = cosmos_service.get_conversations_for_user(user_email)
    return {"total": len(items), "items": items}


@router.get("/my-conversation/{conversation_id}/messages")
async def get_my_conversation_messages(
    conversation_id: str,
    user: dict = Depends(require_user),
):
    """Devuelve los mensajes user/assistant persistidos de una conversación
    propia, listos para rehidratar el chat en el frontend."""
    from app.services.cosmos_service import cosmos_service

    doc = cosmos_service.get_conversation(conversation_id)
    if doc is None:
        raise HTTPException(status_code=404, detail=f"Conversación '{conversation_id}' no encontrada")

    owner_email = (doc.get("user_email") or "").lower()
    caller_email = (user.get("upn") or user.get("preferred_username") or "").lower()
    roles = user.get("roles", [])
    is_privileged = bool({"Admin", "Reviewer"}.intersection(roles))
    if owner_email and caller_email != owner_email and not is_privileged:
        raise HTTPException(
            status_code=403,
            detail="No tienes permiso para ver esta conversación",
        )

    items = assistant_service.get_persisted_messages(conversation_id)
    return {"conversation_id": conversation_id, "total": len(items), "items": items}


@router.delete("/my-conversation/{conversation_id}")
async def delete_my_conversation(conversation_id: str, user: dict = Depends(require_user)):
    """Elimina una conversación propia (con sus archivos asociados).

    Verifica ownership: solo el dueño (o Admin/Reviewer) puede borrar.
    """
    from app.services.cosmos_service import cosmos_service

    doc = cosmos_service.get_conversation(conversation_id)
    if doc is None:
        raise HTTPException(status_code=404, detail=f"Conversación '{conversation_id}' no encontrada")

    owner_email = (doc.get("user_email") or "").lower()
    caller_email = (user.get("upn") or user.get("preferred_username") or "").lower()
    roles = user.get("roles", [])
    is_privileged = bool({"Admin", "Reviewer"}.intersection(roles))
    if owner_email and caller_email != owner_email and not is_privileged:
        raise HTTPException(
            status_code=403,
            detail="No tienes permiso para eliminar esta conversación",
        )

    success = cosmos_service.delete_conversation(conversation_id)
    if not success:
        raise HTTPException(status_code=500, detail="No se pudo eliminar la conversación")
    deleted_blobs = assistant_service.cleanup_conversation(conversation_id)
    return {"status": "ok", "deleted_files": len(deleted_blobs)}


# ── RUTAS DE ADMINISTRADOR ────────────────────────────────────────────────────────


@router.get("/conversations")
async def get_all_conversations(_admin: dict = Depends(require_reviewer_or_admin)):
    """Obtiene todas las conversaciones guardadas (Admin)."""
    from app.services.cosmos_service import cosmos_service
    items = cosmos_service.get_all_conversations()
    return {"total": len(items), "items": items}


@router.delete("/conversation/{conversation_id}")
async def delete_conversation(conversation_id: str, _admin: dict = Depends(require_reviewer_or_admin)):
    """Elimina una conversación guardada y sus archivos asociados (Admin)."""
    from app.services.cosmos_service import cosmos_service
    success = cosmos_service.delete_conversation(conversation_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Conversación '{conversation_id}' no encontrada")
    # Cleanup archivos asociados en storage
    deleted_blobs = assistant_service.cleanup_conversation(conversation_id)
    return {"status": "ok", "deleted_files": len(deleted_blobs)}


@router.post("/upload")
async def upload_files(files: List[UploadFile] = File(...), _user: dict = Depends(require_user)):
    """
    Endpoint para subir archivos que serán procesados por el agente.

    Args:
        files: Lista de archivos subidos

    Returns:
        Información sobre los archivos procesados
    """
    try:
        processed_files = []

        for file in files:
            # Verificar si el archivo es soportado
            if not file_processor.is_supported(file.filename):
                processed_files.append({
                    'filename': file.filename,
                    'success': False,
                    'error': 'Tipo de archivo no soportado',
                    'message': f'El archivo {file.filename} no es soportado'
                })
                continue

            # Leer contenido del archivo
            file_content = await file.read()

            # Guardar archivo (retorna tupla: path temporal, nombre en storage)
            file_path, storage_name = file_processor.save_uploaded_file(file_content, file.filename)

            # Procesar archivo
            result = file_processor.process_file(file_path)

            processed_files.append({
                'filename': file.filename,
                'file_id': file_path.stem,
                **result
            })

            # Limpiar archivo temporal
            try:
                if file_path.exists():
                    file_path.unlink()
            except Exception as e:
                logger.warning(f"No se pudo eliminar temp file {file_path}: {e}")

            logger.info(f"Archivo procesado: {file.filename} - {result.get('message')}")

        return {
            'success': True,
            'files_count': len(files),
            'processed_files': processed_files,
            'message': f'{len(processed_files)} archivo(s) procesado(s)'
        }

    except Exception as e:
        logger.error(f"Error al procesar archivos: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/message-with-files", response_model=ChatResponse)
async def send_message_with_files(
    message: str = Form(default=""),
    conversation_id: Optional[str] = Form(None),
    user_context_json: Optional[str] = Form(None),
    files: Optional[List[UploadFile]] = File(None),
    _user: dict = Depends(require_user),
):
    """
    Endpoint para enviar un mensaje con archivos adjuntos.
    Los archivos son procesados y su contenido se incluye en el contexto del mensaje.

    Args:
        message: Mensaje del usuario
        conversation_id: ID de conversación (opcional)
        files: Archivos adjuntos (opcional)

    Returns:
        Respuesta del agente
    """
    try:
        # Parsear user_context si viene en el form
        user_context = None
        if user_context_json:
            try:
                user_context = UserContext(**json.loads(user_context_json))
            except Exception:
                pass

        # Procesar archivos si existen
        files_context = []
        temp_files = []

        MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

        if files:
            for file in files:
                if not file_processor.is_supported(file.filename):
                    continue

                # Leer y guardar archivo (retorna tupla: path temporal, nombre en storage)
                file_content = await file.read()

                # Protección de tamaño
                if len(file_content) > MAX_FILE_SIZE:
                    logger.warning(f"Archivo {file.filename} excede el límite de 50MB ({len(file_content)} bytes)")
                    continue
                file_path, storage_name = file_processor.save_uploaded_file(file_content, file.filename)
                temp_files.append(file_path)

                # Procesar archivo
                result = file_processor.process_file(file_path)

                if result['success']:
                    # Usar nombre en storage para que el agente pueda referenciarlo con read_from_excel
                    result['filename'] = storage_name
                    result['original_filename'] = file.filename
                    files_context.append(result)
                    logger.info(f"Archivo agregado al contexto: {file.filename} -> storage: {storage_name}")

            # Limpiar archivos temporales locales
            for tmp_path in temp_files:
                try:
                    if tmp_path.exists():
                        tmp_path.unlink()
                except Exception as e:
                    logger.warning(f"No se pudo eliminar temp file {tmp_path}: {e}")

        # Construir mensaje completo con contexto de archivos
        full_message = message

        if files_context:
            full_message += "\n\n--- Archivos adjuntos ---\n"
            for file_ctx in files_context:
                original_name = file_ctx.get('original_filename', file_ctx['filename'])
                storage_name = file_ctx['filename']
                full_message += f"\n**Archivo: {original_name}** (nombre en storage: `{storage_name}`)\n"

                if file_ctx['type'] == 'image':
                    # Para imágenes, agregar nota
                    full_message += f"[Imagen: {file_ctx.get('width')}x{file_ctx.get('height')} - {file_ctx.get('format')}]\n"
                    full_message += "(Nota: La imagen ha sido incluida en el contexto para análisis visual)\n"
                elif file_ctx['type'] == 'spreadsheet':
                    # Solo metadatos estructurales, CERO datos para evitar alucinaciones
                    full_message += f"\nMetadatos del archivo:\n{file_ctx.get('content', '')}\n"
                    sheets_meta = file_ctx.get('sheets_metadata', [])
                    if sheets_meta:
                        for sm in sheets_meta:
                            cols_preview = ', '.join(sm['columns'][:15])
                            extra = f" ... (+{len(sm['columns']) - 15} más)" if len(sm['columns']) > 15 else ""
                            full_message += f"  - Hoja '{sm['sheet_name']}': {sm['row_count']} filas, columnas: [{cols_preview}{extra}]\n"
                    full_message += (
                        f"\n**OBLIGATORIO**: Para responder CUALQUIER pregunta sobre datos de este archivo, "
                        f"DEBES ejecutar las herramientas en este orden:\n"
                        f"  1. `inspect_excel(\"{storage_name}\")` — ver estructura, tipos de datos y data_profile\n"
                        f"  2. `read_from_excel(\"{storage_name}\", sheet_name=..., columns=[...])` — leer datos REALES\n"
                        f"  Para estadísticas usa `summarize_data(\"{storage_name}\")`. Para buscar valores usa `search_in_file(\"{storage_name}\", ...)`.\n"
                        f"**PROHIBIDO**: Inventar, estimar o aproximar valores numéricos.\n"
                    )
                elif file_ctx['type'] == 'csv':
                    # Metadatos CSV sin datos
                    full_message += f"\nMetadatos del CSV:\n{file_ctx.get('content', '')}\n"
                    full_message += (
                        f"\n**OBLIGATORIO**: Para responder sobre datos de este CSV:\n"
                        f"  1. `inspect_csv(\"{storage_name}\")` — ver estructura, tipos y estadísticas\n"
                        f"  2. `read_from_csv(\"{storage_name}\", columns=[...])` — leer datos REALES\n"
                        f"  Para estadísticas usa `summarize_data(\"{storage_name}\")`. Para buscar valores usa `search_in_file(\"{storage_name}\", ...)`.\n"
                        f"**PROHIBIDO**: Inventar, estimar o aproximar valores numéricos.\n"
                    )
                else:
                    # Para texto/documentos, incluir contenido
                    content = file_ctx.get('content', '')
                    # Limitar tamaño si es muy grande
                    max_chars = 50000
                    if len(content) > max_chars:
                        content = content[:max_chars] + f"\n\n[... contenido truncado, mostrando primeros {max_chars} caracteres ...]"
                    full_message += f"\nContenido:\n{content}\n"

        # Procesar mensaje (con archivos en contexto si los hay)
        response_text, conv_id = await assistant_service.process_message_with_files(
            message=full_message,
            conversation_id=conversation_id,
            user_context=user_context,
            files_context=files_context,
        )

        # Persistir conversación nueva en Cosmos DB
        if not conversation_id:
            try:
                from app.services.cosmos_service import cosmos_service
                cosmos_service.save_conversation(
                    conversation_id=conv_id,
                    thread_id=None,
                    user_email=user_context.email if user_context else None,
                    division=user_context.division if user_context else None,
                )
            except Exception as _e:
                logger.warning(f"Error guardando conversación en Cosmos (files): {_e}")

        # Detectar archivos generados
        generated_files = detect_generated_files(response_text)

        return ChatResponse(
            message_id=f"msg_{uuid.uuid4().hex[:12]}",
            content=response_text,
            conversation_id=conv_id,
            timestamp=datetime.now(),
            model_used=config.CHAT_MODEL,
            files=generated_files if generated_files else None
        )

    except AIError as e:
        logger.error(f"Error de IA en /message-with-files: {e.user_message}")
        error_response = AIErrorResponse(
            error_type=e.error_type,
            user_message=e.user_message,
            retry_after=e.retry_after,
            is_retryable=e.is_retryable,
        )
        return JSONResponse(
            status_code=e.http_status_code,
            content=error_response.model_dump(),
        )
    except Exception as e:
        logger.error(f"Error en /message-with-files: {e}")
        error_response = AIErrorResponse(
            error_type="unknown",
            user_message="Algo salió mal. Por favor intenta de nuevo en un momento.",
            retry_after=None,
            is_retryable=True,
        )
        return JSONResponse(
            status_code=500,
            content=error_response.model_dump(),
        )


@router.get("/supported-formats")
async def get_supported_formats():
    """
    Retorna los formatos de archivo soportados.

    Returns:
        Dict con los formatos soportados por categoría
    """
    formats = file_processor.get_supported_formats()
    return {
        'supported_formats': formats,
        'all_formats': [
            ext for category in formats.values()
            for ext in category
        ],
        'message': 'Formatos soportados para upload'
    }


@router.get("/files/{filename}")
async def download_file(filename: str):
    """
    Descarga un archivo generado por el agente desde storage.

    Args:
        filename: Nombre del archivo a descargar

    Returns:
        Archivo para descargar
    """
    # Buscar en generated/ primero, luego en uploads/
    blob_path = None
    for prefix in ("generated", "uploads"):
        candidate = f"{prefix}/{filename}"
        if storage_service.blob_exists(candidate):
            blob_path = candidate
            break

    if not blob_path:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")

    # Determinar el tipo MIME
    mime_types = {
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.xls': 'application/vnd.ms-excel',
        '.pdf': 'application/pdf',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.doc': 'application/msword',
        '.txt': 'text/plain',
        '.csv': 'text/csv',
        '.json': 'application/json',
    }

    ext = Path(filename).suffix.lower()
    media_type = mime_types.get(ext, 'application/octet-stream')

    # Descargar desde storage y enviar como response
    file_bytes = storage_service.download_blob(blob_path)

    return Response(
        content=file_bytes,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
