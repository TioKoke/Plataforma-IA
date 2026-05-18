"""
Servicio de chat usando Chat Completions API con historial en memoria.
El modelo gpt-5.2-chat en Azure AI Foundry no soporta la Assistants API
(beta.threads/runs), por lo que usamos chat.completions.create directamente.
"""
import uuid
import logging
from typing import Optional, Tuple, Dict, List

from app.services.azure_ai import AzureAIService, SYSTEM_INSTRUCTIONS

logger = logging.getLogger(__name__)


class AssistantService:
    """
    Servicio de chat usando Chat Completions API.
    Mantiene historial de conversación en memoria (sin Assistants API).
    """

    def __init__(self):
        self._azure_ai = AzureAIService()
        # conversation_id → lista de mensajes {role, content} (sin system prompt)
        self._conversations: Dict[str, List[dict]] = {}
        # conversation_id → lista de metadatos de archivos subidos
        self._file_registries: Dict[str, List[dict]] = {}
        # conversation_id → set de blob_paths (uploads + generated) para cleanup
        self._conversation_blobs: Dict[str, set] = {}

    # ── Compatibilidad con startup_event ─────────────────────────────

    async def ensure_assistant(self) -> str:
        """No se necesita crear un assistant. Compatible con startup_event."""
        logger.info("Chat Completions API listo (sin Assistants API)")
        return "chat-completions-mode"

    # ── Gestión de conversaciones ─────────────────────────────────────

    def create_conversation(self) -> str:
        """Genera un nuevo conversation_id y lo inicializa en memoria."""
        conv_id = f"conv_{uuid.uuid4().hex[:12]}"
        self._conversations[conv_id] = []
        return conv_id

    def _get_history(self, conversation_id: str) -> List[dict]:
        """Retorna el historial de la conversación (lista mutable).

        Lazy-rehydrate: si no está en memoria pero hay mensajes persistidos en
        MongoDB para esta conversación, los carga. Permite que el contexto
        sobreviva a reinicios del backend o al reabrir una conversación vieja
        desde el sidebar de historial.
        """
        if conversation_id not in self._conversations:
            self._conversations[conversation_id] = []
            try:
                from app.services.cosmos_service import cosmos_service
                docs = cosmos_service.get_messages_for_conversation(conversation_id)
                rehydrated = [
                    {"role": d.get("role"), "content": d.get("content", "")}
                    for d in docs
                    if d.get("role") in ("user", "assistant") and d.get("content")
                ]
                if rehydrated:
                    self._conversations[conversation_id] = rehydrated[-100:]
                    logger.info(
                        f"Rehidratado historial de {conversation_id} desde Mongo: "
                        f"{len(rehydrated)} mensajes"
                    )
            except Exception as e:
                logger.warning(f"No se pudo rehidratar historial de {conversation_id}: {e}")
        return self._conversations[conversation_id]

    def get_persisted_messages(self, conversation_id: str) -> List[dict]:
        """Devuelve los mensajes user/assistant persistidos de una conversación
        en formato listo para el frontend (con timestamps).
        """
        try:
            from app.services.cosmos_service import cosmos_service
            docs = cosmos_service.get_messages_for_conversation(conversation_id)
            return [
                {
                    "id": d.get("id"),
                    "role": d.get("role"),
                    "content": d.get("content", ""),
                    "timestamp": d.get("timestamp"),
                }
                for d in docs
                if d.get("role") in ("user", "assistant") and d.get("content")
            ]
        except Exception as e:
            logger.warning(f"No se pudo cargar mensajes persistidos de {conversation_id}: {e}")
            return []

    def _append_to_history(self, conversation_id: str, role: str, content: str) -> None:
        """Agrega un mensaje al historial; mantiene máx. 100 mensajes."""
        history = self._get_history(conversation_id)
        history.append({"role": role, "content": content})
        if len(history) > 100:
            self._conversations[conversation_id] = history[-100:]

    @staticmethod
    def _build_user_context_str(user_context) -> Optional[str]:
        """Construye el string de contexto del usuario para inyectar en el system prompt."""
        if user_context is None:
            return None
        parts = []
        if getattr(user_context, "name", None):
            parts.append(f"Nombre: {user_context.name}")
        email = getattr(user_context, "email", None)
        if email:
            parts.append(f"Email: {email}")
        if getattr(user_context, "division", None):
            parts.append(f"División: {user_context.division}")
        base = " | ".join(parts) if parts else None

        # Append connected integrations so the model knows which tools can be called.
        if email:
            try:
                from app.services.integration_service import integration_service
                statuses = integration_service.get_all_statuses(email)
                connected = [s["service"] for s in statuses if s.get("status") == "connected"]
                if connected:
                    line = f"Integraciones conectadas: {', '.join(connected)}"
                    base = f"{base}\n{line}" if base else line
            except Exception as e:
                logger.warning(f"No se pudo consultar estado de integraciones: {e}")

        return base

    # ── Registro de archivos por conversación ────────────────────────

    def register_files_for_conversation(
        self, conversation_id: str, files_context: List[dict]
    ) -> None:
        """Registra metadatos de archivos subidos para una conversación."""
        if conversation_id not in self._file_registries:
            self._file_registries[conversation_id] = []
        for fc in files_context:
            ftype = fc.get("type", "")
            if ftype == "spreadsheet":
                entry = {
                    "filename": fc.get("filename", ""),
                    "original_filename": fc.get("original_filename", fc.get("filename", "")),
                    "type": "spreadsheet",
                    "num_sheets": fc.get("num_sheets", "?"),
                    "total_rows": fc.get("total_rows", "?"),
                    "sheets_metadata": fc.get("sheets_metadata", []),
                }
                self._file_registries[conversation_id].append(entry)
                logger.info(
                    f"Archivo Excel registrado para {conversation_id}: {entry['filename']}"
                )
            elif ftype == "csv":
                entry = {
                    "filename": fc.get("filename", ""),
                    "original_filename": fc.get("original_filename", fc.get("filename", "")),
                    "type": "csv",
                    "total_rows": fc.get("total_rows", "?"),
                    "columns": fc.get("columns", []),
                    "delimiter": fc.get("delimiter", ","),
                }
                self._file_registries[conversation_id].append(entry)
                logger.info(
                    f"Archivo CSV registrado para {conversation_id}: {entry['filename']}"
                )
            elif ftype in ("pdf", "docx"):
                entry = {
                    "filename": fc.get("filename", ""),
                    "original_filename": fc.get("original_filename", fc.get("filename", "")),
                    "type": ftype,
                    "size": fc.get("size", "?"),
                }
                if ftype == "pdf":
                    entry["num_pages"] = fc.get("num_pages", "?")
                self._file_registries[conversation_id].append(entry)
                logger.info(
                    f"Archivo {ftype} registrado para {conversation_id}: {entry['filename']}"
                )
            # Trackear blob_path para cleanup posterior
            filename = fc.get("filename", "")
            if filename:
                self.track_blob(conversation_id, f"uploads/{filename}")

    # ── Tracking de blobs por conversación (para cleanup) ────────────

    def track_blob(self, conversation_id: str, blob_path: str) -> None:
        """Registra un blob_path asociado a una conversación para cleanup posterior."""
        if conversation_id not in self._conversation_blobs:
            self._conversation_blobs[conversation_id] = set()
        self._conversation_blobs[conversation_id].add(blob_path)

    def get_conversation_blobs(self, conversation_id: str) -> set:
        """Retorna los blob_paths asociados a una conversación."""
        return self._conversation_blobs.get(conversation_id, set())

    def cleanup_conversation(self, conversation_id: str) -> List[str]:
        """
        Elimina todos los archivos asociados a una conversación del storage.
        Retorna lista de blobs eliminados.
        """
        from app.services.storage_service import storage_service
        blobs = self._conversation_blobs.pop(conversation_id, set())
        deleted = []
        for blob_path in blobs:
            try:
                if storage_service.blob_exists(blob_path):
                    storage_service.delete_blob(blob_path)
                    deleted.append(blob_path)
                    logger.info(f"Blob eliminado (cleanup conv {conversation_id}): {blob_path}")
            except Exception as e:
                logger.warning(f"Error eliminando blob {blob_path}: {e}")
        # Limpiar registros en memoria
        self._conversations.pop(conversation_id, None)
        self._file_registries.pop(conversation_id, None)
        return deleted

    def cleanup_conversation_files(self, conversation_id: str) -> List[str]:
        """
        Elimina sólo los blobs y el registro de archivos de una conversación.
        No toca ``_conversations`` (historial en memoria) ni Cosmos.
        Pensado para el cleanup al iniciar un nuevo chat desde el cliente.
        """
        from app.services.storage_service import storage_service
        blobs = self._conversation_blobs.pop(conversation_id, set())
        deleted = []
        for blob_path in blobs:
            try:
                if storage_service.blob_exists(blob_path):
                    storage_service.delete_blob(blob_path)
                    deleted.append(blob_path)
                    logger.info(f"Blob eliminado (cleanup files conv {conversation_id}): {blob_path}")
            except Exception as e:
                logger.warning(f"Error eliminando blob {blob_path}: {e}")
        self._file_registries.pop(conversation_id, None)
        return deleted

    def _build_file_context_reminder(self, conversation_id: str) -> str:
        """Construye un recordatorio de archivos disponibles para inyectar en mensajes de seguimiento."""
        registry = self._file_registries.get(conversation_id, [])
        if not registry:
            return ""

        lines = ["[Archivos de datos disponibles en esta conversación:]"]
        for f in registry:
            ftype = f.get("type", "")
            if ftype == "spreadsheet":
                lines.append(
                    f"  - EXCEL `{f['filename']}` (original: {f['original_filename']}): "
                    f"{f['num_sheets']} hojas, ~{f['total_rows']} filas"
                )
            elif ftype == "csv":
                cols_preview = ", ".join(f['columns'][:8]) if f.get('columns') else "?"
                lines.append(
                    f"  - CSV `{f['filename']}` (original: {f['original_filename']}): "
                    f"~{f['total_rows']} filas, columnas: {cols_preview}"
                )
            elif ftype == "pdf":
                lines.append(
                    f"  - PDF `{f['filename']}` (original: {f['original_filename']}): "
                    f"{f.get('num_pages', '?')} páginas"
                )
            elif ftype == "docx":
                lines.append(
                    f"  - DOCX `{f['filename']}` (original: {f['original_filename']})"
                )

        lines.append(
            "OBLIGATORIO: Para archivos Excel usa inspect_excel + read_from_excel. "
            "Para archivos CSV usa inspect_csv + read_from_csv. "
            "Para análisis estadísticos usa summarize_data o aggregate_data. "
            "Para buscar valores específicos usa search_in_file. "
            "Para comparar archivos usa compare_files. "
            "NUNCA respondas con datos numéricos sin haberlos leído con las herramientas."
        )
        return "\n".join(lines)

    # ── API pública ───────────────────────────────────────────────────

    async def process_message(
        self,
        message: str,
        conversation_id: Optional[str] = None,
        user_context=None,
        event_callback=None,
    ) -> Tuple[str, str]:
        """
        Procesa un mensaje usando Chat Completions con historial en memoria.

        Args:
            message: Texto del usuario.
            conversation_id: ID de conversación (se genera si es None).
            user_context: Instancia de UserContext (nombre, email, división).

        Returns:
            Tuple (response_text, conversation_id).
        """
        if not conversation_id:
            conversation_id = self.create_conversation()

        # Historial previo (sin el mensaje actual)
        history = self._get_history(conversation_id)
        user_context_str = self._build_user_context_str(user_context)
        if user_context_str:
            logger.info(f"user_context: {user_context_str}")

        # Inyectar recordatorio de archivos disponibles en mensajes de seguimiento
        file_reminder = self._build_file_context_reminder(conversation_id)
        enriched_message = message
        if file_reminder:
            enriched_message = f"{file_reminder}\n\n{message}"

        # Llamar al servicio de Azure AI (Chat Completions con tool calling)
        from app.agents.tools import ALL_TOOLS, execute_tool
        user_email = getattr(user_context, "email", None) if user_context else None
        response_text = await self._azure_ai.send_message(
            user_message=enriched_message,
            conversation_history=list(history),  # copia para evitar mutación
            tools=ALL_TOOLS,
            tool_executor=execute_tool,
            user_context_str=user_context_str,
            conversation_id=conversation_id,
            user_email=user_email,
            event_callback=event_callback,
        )

        # Guardar en historial solo si la respuesta es válida
        if response_text:
            self._append_to_history(conversation_id, "user", message)
            self._append_to_history(conversation_id, "assistant", response_text)

            # Persistencia: guardamos user + assistant con contenido completo
            # para que el sidebar pueda restaurar la conversación al hacer click.
            try:
                from app.services.cosmos_service import cosmos_service
                _email = getattr(user_context, "email", None)
                _div = getattr(user_context, "division", None)
                cosmos_service.save_message_metadata(
                    message_id=f"msg_{uuid.uuid4().hex[:12]}",
                    conversation_id=conversation_id,
                    message_length=len(message),
                    user_email=_email,
                    division=_div,
                    role="user",
                    content=message,
                )
                cosmos_service.save_message_metadata(
                    message_id=f"msg_{uuid.uuid4().hex[:12]}",
                    conversation_id=conversation_id,
                    message_length=len(response_text),
                    user_email=_email,
                    division=_div,
                    role="assistant",
                    content=response_text,
                )
            except Exception as _e:
                logger.warning(f"Error persistiendo mensajes: {_e}")

        logger.info(
            f"Respuesta obtenida para {conversation_id}: {len(response_text)} caracteres"
        )
        return response_text, conversation_id

    async def process_message_with_files(
        self,
        message: str,
        conversation_id: Optional[str] = None,
        user_context=None,
        files_context=None,
        event_callback=None,
    ) -> Tuple[str, str]:
        """
        Procesa un mensaje que puede incluir archivos (imágenes, documentos, etc.).
        Si hay imágenes, construye un mensaje multimodal para enviar al modelo.
        """
        # Registrar archivos Excel para esta conversación (persistencia entre mensajes)
        if not conversation_id:
            conversation_id = self.create_conversation()

        if files_context:
            self.register_files_for_conversation(conversation_id, files_context)

        # Detectar imágenes en files_context: imágenes directas y páginas
        # rasterizadas desde PDFs cortos (process_pdf retorna `images_base64`
        # cuando PDF_MULTIMODAL_ENABLED y pages ≤ PDF_MULTIMODAL_MAX_PAGES).
        multimodal_parts: list = []  # cada item: {"data", "media_type", "source_label"}
        if files_context:
            for fc in files_context:
                if not isinstance(fc, dict):
                    continue
                if fc.get("type") == "image" and fc.get("image_data"):
                    multimodal_parts.append({
                        "data": fc["image_data"],
                        "media_type": fc["media_type"],
                        "source_label": fc.get("filename", "imagen"),
                    })
                elif fc.get("type") == "pdf" and fc.get("images_base64"):
                    for idx, page_img in enumerate(fc["images_base64"], 1):
                        multimodal_parts.append({
                            "data": page_img["data"],
                            "media_type": page_img["media_type"],
                            "source_label": f"{fc.get('filename', 'pdf')}#p{idx}",
                        })

        if not multimodal_parts:
            # Sin contenido visual: delegar al flujo normal (texto ya embebido por el router)
            return await self.process_message(message, conversation_id, user_context, event_callback)

        # Con contenido visual: construir mensaje multimodal
        history = self._get_history(conversation_id)
        user_context_str = self._build_user_context_str(user_context)

        # Construir contenido multimodal (texto + imágenes + páginas PDF)
        multimodal_content: list = [{"type": "text", "text": message}]
        for part in multimodal_parts:
            multimodal_content.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:{part['media_type']};base64,{part['data']}"
                },
            })
            logger.info(f"Imagen adjuntada: {part['source_label']} ({part['media_type']})")

        from app.agents.tools import ALL_TOOLS, execute_tool
        user_email = getattr(user_context, "email", None) if user_context else None
        response_text = await self._azure_ai.send_message(
            user_message=multimodal_content,
            conversation_history=list(history),
            tools=ALL_TOOLS,
            tool_executor=execute_tool,
            user_context_str=user_context_str,
            conversation_id=conversation_id,
            user_email=user_email,
            event_callback=event_callback,
        )

        # Guardar solo el texto en el historial (imágenes base64 son muy grandes)
        if response_text:
            self._append_to_history(conversation_id, "user", message)
            self._append_to_history(conversation_id, "assistant", response_text)

            try:
                from app.services.cosmos_service import cosmos_service
                _email = getattr(user_context, "email", None)
                _div = getattr(user_context, "division", None)
                cosmos_service.save_message_metadata(
                    message_id=f"msg_{uuid.uuid4().hex[:12]}",
                    conversation_id=conversation_id,
                    message_length=len(message),
                    user_email=_email,
                    division=_div,
                    role="user",
                    content=message,
                )
                cosmos_service.save_message_metadata(
                    message_id=f"msg_{uuid.uuid4().hex[:12]}",
                    conversation_id=conversation_id,
                    message_length=len(response_text),
                    user_email=_email,
                    division=_div,
                    role="assistant",
                    content=response_text,
                )
            except Exception as _e:
                logger.warning(f"Error persistiendo mensajes (multimodal): {_e}")

        logger.info(f"Respuesta multimodal para {conversation_id}: {len(response_text)} caracteres")
        return response_text, conversation_id


# Instancia global
assistant_service = AssistantService()