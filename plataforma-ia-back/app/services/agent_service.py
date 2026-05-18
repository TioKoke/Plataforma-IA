"""
Servicio de gestión de agentes.
Coordina la lógica de los agentes y el flujo de conversación.
"""
from typing import Dict, List, Optional, Any
from datetime import datetime
import uuid
import logging

from app.services.azure_ai import azure_ai_service
from app.agents.tools import ALL_TOOLS, execute_tool

logger = logging.getLogger(__name__)


class AgentService:
    """Servicio para gestionar agentes y conversaciones"""

    def __init__(self):
        """Inicializa el servicio de agentes"""
        # Almacenamiento en memoria para conversaciones (en producción usar DB)
        self.conversations: Dict[str, List[dict]] = {}

    def _clean_messages_for_api(self, messages: List[dict]) -> List[dict]:
        """
        Limpia los mensajes para enviar a la API de Anthropic.
        Solo mantiene los campos 'role' y 'content'.

        Args:
            messages: Lista de mensajes con todos los campos

        Returns:
            Lista de mensajes solo con role y content
        """
        cleaned = []
        for msg in messages:
            cleaned.append({
                "role": msg["role"],
                "content": msg["content"]
            })
        return cleaned

    def create_conversation(self) -> str:
        """
        Crea una nueva conversación.

        Returns:
            ID de la conversación
        """
        conversation_id = f"conv_{uuid.uuid4().hex[:12]}"
        self.conversations[conversation_id] = []
        logger.info(f"Nueva conversación creada: {conversation_id}")
        return conversation_id

    def get_conversation_history(
        self,
        conversation_id: str,
        limit: Optional[int] = None
    ) -> List[dict]:
        """
        Obtiene el historial de una conversación.

        Args:
            conversation_id: ID de la conversación
            limit: Número máximo de mensajes a retornar

        Returns:
            Lista de mensajes de la conversación
        """
        history = self.conversations.get(conversation_id, [])

        if limit:
            return history[-limit:]

        return history

    def add_message_to_history(
        self,
        conversation_id: str,
        role: str,
        content: str
    ) -> None:
        """
        Agrega un mensaje al historial de conversación.

        Args:
            conversation_id: ID de la conversación
            role: Rol del mensaje ('user' o 'assistant')
            content: Contenido del mensaje
        """
        if conversation_id not in self.conversations:
            self.conversations[conversation_id] = []

        self.conversations[conversation_id].append({
            "role": role,
            "content": content,
            "timestamp": datetime.now().isoformat()
        })

    async def process_message(
        self,
        message: str,
        conversation_id: Optional[str] = None
    ) -> tuple[str, str]:
        """
        Procesa un mensaje del usuario y genera una respuesta.

        Args:
            message: Mensaje del usuario
            conversation_id: ID de conversación (opcional)

        Returns:
            Tuple con (respuesta, conversation_id)
        """
        try:
            # Crear conversación si no existe
            if not conversation_id:
                conversation_id = self.create_conversation()

            # Agregar mensaje del usuario al historial
            self.add_message_to_history(
                conversation_id=conversation_id,
                role="user",
                content=message
            )

            # Obtener historial para contexto
            history = self.get_conversation_history(
                conversation_id=conversation_id,
                limit=10  # Últimos 10 mensajes para contexto
            )

            # Limpiar historial para API (solo role y content)
            clean_history = self._clean_messages_for_api(history[:-1])  # Excluir el último

            # Enviar a Azure AI con herramientas
            response = await azure_ai_service.send_message(
                user_message=message,
                conversation_history=clean_history,
                tools=ALL_TOOLS,  # Herramientas de Excel disponibles
                tool_executor=execute_tool  # Función para ejecutar herramientas
            )

            # Agregar respuesta al historial
            self.add_message_to_history(
                conversation_id=conversation_id,
                role="assistant",
                content=response
            )

            logger.info(f"Mensaje procesado en conversación {conversation_id}")
            return response, conversation_id

        except Exception as e:
            logger.error(f"Error al procesar mensaje: {e}")
            raise

    async def stream_message(
        self,
        message: str,
        conversation_id: Optional[str] = None
    ):
        """
        Procesa un mensaje con streaming de respuesta.

        Args:
            message: Mensaje del usuario
            conversation_id: ID de conversación (opcional)

        Yields:
            Fragmentos de la respuesta
        """
        try:
            # Crear conversación si no existe
            if not conversation_id:
                conversation_id = self.create_conversation()

            # Agregar mensaje del usuario al historial
            self.add_message_to_history(
                conversation_id=conversation_id,
                role="user",
                content=message
            )

            # Obtener historial
            history = self.get_conversation_history(
                conversation_id=conversation_id,
                limit=10
            )

            # Limpiar historial para API
            clean_history = self._clean_messages_for_api(history[:-1])

            # Stream desde Azure AI
            full_response = ""
            async for chunk in azure_ai_service.stream_message(
                user_message=message,
                conversation_history=clean_history
            ):
                full_response += chunk
                yield chunk

            # Agregar respuesta completa al historial
            self.add_message_to_history(
                conversation_id=conversation_id,
                role="assistant",
                content=full_response
            )

            logger.info(f"Stream completado en conversación {conversation_id}")

        except Exception as e:
            logger.error(f"Error en streaming: {e}")
            yield f"[ERROR] {str(e)}"

    async def process_message_with_files(
        self,
        message: str,
        conversation_id: Optional[str] = None,
        files_context: Optional[List[Dict[str, Any]]] = None
    ) -> tuple[str, str]:
        """
        Procesa un mensaje con archivos adjuntos (incluyendo imágenes).

        Args:
            message: Mensaje del usuario (puede incluir contexto de archivos)
            conversation_id: ID de conversación (opcional)
            files_context: Lista de archivos procesados con su contenido

        Returns:
            Tuple con (respuesta, conversation_id)
        """
        try:
            # Crear conversación si no existe
            if not conversation_id:
                conversation_id = self.create_conversation()

            # Obtener historial
            history = self.get_conversation_history(
                conversation_id=conversation_id,
                limit=10
            )

            # Limpiar historial para API
            clean_history = self._clean_messages_for_api(history)

            # Construir mensaje con soporte para imágenes
            message_content = []

            # Si hay archivos con imágenes, construir contenido multimodal
            has_images = False
            if files_context:
                for file_ctx in files_context:
                    if file_ctx.get('type') == 'image' and file_ctx.get('image_data'):
                        has_images = True
                        break

            if has_images:
                # Mensaje multimodal (texto + imágenes)
                message_content.append({
                    "type": "text",
                    "text": message
                })

                # Agregar imágenes
                for file_ctx in files_context:
                    if file_ctx.get('type') == 'image' and file_ctx.get('image_data'):
                        message_content.append({
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": file_ctx.get('media_type', 'image/jpeg'),
                                "data": file_ctx['image_data']
                            }
                        })
                        logger.info(f"Imagen agregada al mensaje: {file_ctx.get('filename')}")
            else:
                # Mensaje de solo texto
                message_content = message

            # Agregar mensaje del usuario al historial
            self.add_message_to_history(
                conversation_id=conversation_id,
                role="user",
                content=message if isinstance(message_content, str) else message  # Guardar solo el texto
            )

            # Enviar a Azure AI con herramientas
            response = await azure_ai_service.send_message(
                user_message=message_content,  # Puede ser string o list con imágenes
                conversation_history=clean_history,
                tools=ALL_TOOLS,
                tool_executor=execute_tool
            )

            # Agregar respuesta al historial
            self.add_message_to_history(
                conversation_id=conversation_id,
                role="assistant",
                content=response
            )

            logger.info(f"Mensaje con archivos procesado en conversación {conversation_id}")
            return response, conversation_id

        except Exception as e:
            logger.error(f"Error al procesar mensaje con archivos: {e}")
            raise


# Instancia global del servicio
agent_service = AgentService()
