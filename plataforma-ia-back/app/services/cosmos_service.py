"""
Servicio de acceso a datos sobre MongoDB (Atlas M0 en el demo).

Mantiene el nombre `cosmos_service` por compatibilidad histórica — ya no usa
Azure Cosmos DB. Las firmas públicas se conservan idénticas para no tocar los
routers; los parámetros que antes eran partition keys de Cosmos (categoria,
division) se aceptan pero se ignoran internamente (Mongo filtra solo por id).

Estrategia de cache (sin cambios respecto a la versión Cosmos):
- Se carga una sola vez al primer request (lazy) o al llamar load_cache().
- Se recarga solo cuando se escribe (upsert) o se pide explícitamente.
- Para ~39 agentes, todo se filtra en memoria sin volver a la base.
"""
from app.config import config, get_logger
from typing import List, Optional
from datetime import datetime
from pymongo import MongoClient, ASCENDING

logger = get_logger("cosmos")


class CosmosService:
    """Servicio de acceso a datos (MongoDB) con cache en memoria."""

    def __init__(self):
        self._client: Optional[MongoClient] = None
        self._db = None
        self._agents_cache: Optional[List[dict]] = None
        self._videos_cache: Optional[List[dict]] = None
        # Versión monotónica del cache de agentes — se incrementa en cada
        # load/create/update/delete. Otros servicios la leen para invalidar
        # sus propios caches derivados (p.ej. el system prompt con catálogo).
        self._agents_cache_version: int = 0

    # ── Conexión ─────────────────────────────────────────────────────

    def _get_client(self) -> MongoClient:
        if self._client is None:
            if not config.MONGODB_URI:
                raise RuntimeError("MONGODB_URI no está configurado")
            self._client = MongoClient(config.MONGODB_URI)
            logger.info("MongoDB client inicializado")
        return self._client

    def _get_db(self):
        if self._db is None:
            self._db = self._get_client()[config.MONGODB_DB_NAME]
        return self._db

    def _coll(self, name: str):
        return self._get_db()[name]

    @staticmethod
    def _persist(collection, item: dict) -> None:
        """Upsert de un documento usando su campo `id` de negocio como `_id`."""
        doc = {**item, "_id": item["id"]}
        collection.replace_one({"_id": item["id"]}, doc, upsert=True)

    @staticmethod
    def _clean_item(item: dict) -> dict:
        """Descarta campos internos (`_id`, `_ts`, etc.)."""
        return {k: v for k, v in item.items() if not k.startswith("_")}

    # ── Cache ────────────────────────────────────────────────────────

    def load_cache(self) -> List[dict]:
        """Carga todos los agentes desde la base al cache."""
        items = list(self._coll("agents").find().sort("nombre", ASCENDING))
        self._agents_cache = [self._clean_item(item) for item in items]
        self._agents_cache_version += 1
        logger.info(f"Cache de agentes cargado: {len(self._agents_cache)} agentes")
        return self._agents_cache

    def _get_cached_agents(self) -> List[dict]:
        """Retorna agentes desde cache. Carga lazy si es la primera vez."""
        if self._agents_cache is None:
            self.load_cache()
        return self._agents_cache

    def get_all_agents(self) -> List[dict]:
        """Retorna el catálogo completo de agentes (todas las divisiones, todos los estados)."""
        return self._get_cached_agents()

    def get_cache_version(self) -> int:
        """Versión del cache; cambia en cada load/create/update/delete."""
        return self._agents_cache_version

    # ── Queries (todas desde cache) ──────────────────────────────────

    def get_agent_by_id(self, agent_id: str) -> Optional[dict]:
        for agent in self._get_cached_agents():
            if agent.get("id") == agent_id:
                return agent
        return None

    def get_categories(self) -> List[str]:
        return sorted(set(a["categoria"] for a in self._get_cached_agents()))

    def get_divisions(self) -> List[str]:
        return sorted(set(a["division"] for a in self._get_cached_agents()))

    def get_creators(self) -> List[str]:
        return sorted(set(a["creador"] for a in self._get_cached_agents()))

    def get_agents_filtered(
        self,
        categoria: Optional[str] = None,
        division: Optional[str] = None,
        creador: Optional[str] = None,
        search: Optional[str] = None,
    ) -> List[dict]:
        """Filtra agentes en memoria."""
        agents = self._get_cached_agents()

        if categoria:
            agents = [a for a in agents if a["categoria"] == categoria]
        if division:
            agents = [a for a in agents if a["division"] == division]
        if creador:
            agents = [a for a in agents if a["creador"] == creador]
        if search:
            q = search.lower()
            agents = [
                a for a in agents
                if q in a["nombre"].lower() or q in a["descripcion"].lower()
            ]

        return agents

    def create_agent(self, item: dict) -> dict:
        """Crea un nuevo agente."""
        try:
            self._persist(self._coll("agents"), item)
            logger.info(f"Agente creado: {item['id']}")
            self._agents_cache = None  # invalidar cache
            self._agents_cache_version += 1
            return self._clean_item(item)
        except Exception as e:
            logger.error(f"Error al crear agente: {e}")
            raise

    def update_agent(self, agent_id: str, categoria: str, item_updates: dict) -> Optional[dict]:
        """Actualiza un agente. `categoria` se acepta por compatibilidad pero se ignora."""
        try:
            collection = self._coll("agents")
            item = collection.find_one({"_id": agent_id})
            if item is None:
                return None
            item.update(item_updates)
            item["updated_at"] = datetime.utcnow().isoformat()
            self._persist(collection, item)
            logger.info(f"Agente {agent_id} actualizado.")
            self._agents_cache = None  # invalidar cache
            self._agents_cache_version += 1
            return self._clean_item(item)
        except Exception as e:
            logger.error(f"Error al actualizar agente {agent_id}: {e}")
            raise

    def delete_agent(self, agent_id: str, categoria: str) -> bool:
        """Elimina un agente. `categoria` se acepta por compatibilidad pero se ignora."""
        try:
            result = self._coll("agents").delete_one({"_id": agent_id})
            if result.deleted_count == 0:
                return False
            logger.info(f"Agente {agent_id} eliminado.")
            self._agents_cache = None  # invalidar cache
            self._agents_cache_version += 1
            return True
        except Exception as e:
            logger.error(f"Error al eliminar agente {agent_id}: {e}")
            raise

    # ── Videos ───────────────────────────────────────────────────────

    def load_videos_cache(self) -> List[dict]:
        """Carga todos los videos desde la base al cache."""
        try:
            items = list(self._coll("videos").find().sort("title", ASCENDING))
            self._videos_cache = [self._clean_item(item) for item in items]
            logger.info(f"Cache de videos cargado: {len(self._videos_cache)} videos")
        except Exception as e:
            logger.warning(f"No se pudo cargar el cache de videos — cache vacío: {e}")
            self._videos_cache = []
        return self._videos_cache

    def _get_cached_videos(self) -> List[dict]:
        if self._videos_cache is None:
            self.load_videos_cache()
        return self._videos_cache

    def get_all_videos(self) -> List[dict]:
        return self._get_cached_videos()

    def get_video_by_id(self, video_id: str) -> Optional[dict]:
        for v in self._get_cached_videos():
            if v.get("id") == video_id:
                return v
        return None

    def get_video_categories(self) -> List[str]:
        return sorted({v["category"] for v in self._get_cached_videos() if v.get("category")})

    def get_video_levels(self) -> List[str]:
        return sorted({v["level"] for v in self._get_cached_videos() if v.get("level")})

    def get_videos_filtered(
        self,
        level: Optional[str] = None,
        category: Optional[str] = None,
        search: Optional[str] = None,
    ) -> List[dict]:
        """Filtra videos en memoria."""
        videos = self._get_cached_videos()
        if level:
            videos = [v for v in videos if v.get("level") == level]
        if category:
            videos = [v for v in videos if v.get("category") == category]
        if search:
            q = search.lower()
            videos = [
                v for v in videos
                if q in v.get("title", "").lower() or q in v.get("description", "").lower()
            ]
        return videos

    def create_video(self, item: dict) -> dict:
        """Crea un nuevo video."""
        try:
            self._persist(self._coll("videos"), item)
            logger.info(f"Video creado: {item['id']}")
            self._videos_cache = None
            return self._clean_item(item)
        except Exception as e:
            logger.error(f"Error al crear video: {e}")
            raise

    def update_video(self, video_id: str, item_updates: dict) -> Optional[dict]:
        """Actualiza un video."""
        try:
            collection = self._coll("videos")
            item = collection.find_one({"_id": video_id})
            if item is None:
                return None
            item.update(item_updates)
            item["updated_at"] = datetime.utcnow().isoformat()
            self._persist(collection, item)
            logger.info(f"Video {video_id} actualizado.")
            self._videos_cache = None
            return self._clean_item(item)
        except Exception as e:
            logger.error(f"Error al actualizar video {video_id}: {e}")
            raise

    def delete_video(self, video_id: str) -> bool:
        """Elimina un video."""
        try:
            result = self._coll("videos").delete_one({"_id": video_id})
            if result.deleted_count == 0:
                return False
            logger.info(f"Video {video_id} eliminado.")
            self._videos_cache = None
            return True
        except Exception as e:
            logger.error(f"Error al eliminar video {video_id}: {e}")
            raise

    # ── Conversations ────────────────────────────────────────────────

    def get_thread_id(self, conversation_id: str) -> Optional[str]:
        """Retorna el thread_id asociado a la conversación, o None si no existe."""
        try:
            item = self._coll("conversations").find_one({"_id": conversation_id})
            return item.get("thread_id") if item else None
        except Exception as e:
            logger.warning(f"Error al obtener thread_id para {conversation_id}: {e}")
            return None

    def get_conversation(self, conversation_id: str) -> Optional[dict]:
        """Retorna el documento completo de la conversación, o None si no existe."""
        try:
            return self._coll("conversations").find_one({"_id": conversation_id})
        except Exception as e:
            logger.warning(f"Error al obtener conversación {conversation_id}: {e}")
            return None

    def save_conversation(self, conversation_id: str, thread_id: str,
                          user_email: Optional[str] = None,
                          division: Optional[str] = None,
                          title: Optional[str] = None) -> None:
        """Guarda o actualiza la asociación conversation_id → thread_id.

        Si se provee `title` (típicamente las primeras palabras del primer
        mensaje del usuario), se almacena para mostrarlo en el sidebar de
        historial — UX estilo Claude.ai.
        """
        try:
            doc = {
                "id": conversation_id,
                "thread_id": thread_id,
                "user_email": user_email,
                "division": division,
                "title": title,
                "created_at": datetime.utcnow().isoformat(),
            }
            self._persist(self._coll("conversations"), doc)
            logger.info(f"Conversación guardada: {conversation_id} (división: {division})")
        except Exception as e:
            logger.error(f"Error al guardar conversación {conversation_id}: {e}")
            raise

    def update_conversation_title(self, conversation_id: str, title: str) -> bool:
        """Actualiza solo el título de una conversación existente. No falla si
        no existe (no-op).
        """
        try:
            result = self._coll("conversations").update_one(
                {"_id": conversation_id},
                {"$set": {"title": title}},
            )
            return result.matched_count > 0
        except Exception as e:
            logger.warning(f"Error al actualizar título de conversación {conversation_id}: {e}")
            return False

    def save_message_metadata(self, message_id: str, conversation_id: str,
                               message_length: int,
                               user_email: Optional[str] = None,
                               division: Optional[str] = None,
                               role: Optional[str] = None,
                               content: Optional[str] = None) -> None:
        """Guarda metadata y (opcionalmente) contenido completo de un mensaje.

        Si se provee `role` y `content`, el mensaje queda recuperable como
        parte del historial de la conversación. Non-fatal: errores se loguean
        pero no rompen el chat.
        """
        try:
            doc = {
                "id": message_id,
                "conversation_id": conversation_id,
                "user_email": user_email,
                "division": division,
                "message_length": message_length,
                "timestamp": datetime.utcnow().isoformat(),
            }
            if role:
                doc["role"] = role
            if content is not None:
                doc["content"] = content
            self._persist(self._coll("messages"), doc)
        except Exception as e:
            logger.warning(f"Error al guardar mensaje {message_id}: {e}")

    def get_messages_for_conversation(self, conversation_id: str) -> List[dict]:
        """Devuelve los mensajes (user + assistant) de una conversación,
        en orden cronológico, listos para rehidratar el chat."""
        try:
            items = list(
                self._coll("messages")
                .find({"conversation_id": conversation_id})
                .sort("timestamp", 1)
            )
            return [self._clean_item(i) for i in items]
        except Exception as e:
            logger.error(f"Error al obtener mensajes de {conversation_id}: {e}")
            return []

    def get_all_conversations(self) -> List[dict]:
        """Obtiene una lista de todas las conversaciones (Admin)."""
        try:
            items = list(
                self._coll("conversations").find().sort("created_at", -1)
            )
            return [self._clean_item(i) for i in items]
        except Exception as e:
            logger.error(f"Error al obtener conversaciones: {e}")
            raise

    def get_conversations_for_user(self, user_email: str) -> List[dict]:
        """Lista las conversaciones de un usuario, más recientes primero."""
        try:
            items = list(
                self._coll("conversations")
                .find({"user_email": user_email})
                .sort("created_at", -1)
            )
            return [self._clean_item(i) for i in items]
        except Exception as e:
            logger.error(f"Error al listar conversaciones de {user_email}: {e}")
            return []

    def delete_conversation(self, conversation_id: str) -> bool:
        """Elimina una conversación."""
        try:
            self._coll("conversations").delete_one({"_id": conversation_id})
            # Cascade: eliminar también los mensajes persistidos de esa conversación
            try:
                msg_result = self._coll("messages").delete_many(
                    {"conversation_id": conversation_id}
                )
                if msg_result.deleted_count:
                    logger.info(
                        f"Eliminados {msg_result.deleted_count} mensajes de {conversation_id}"
                    )
            except Exception as _e:
                logger.warning(f"Error eliminando mensajes de {conversation_id}: {_e}")
            logger.info(f"Conversación {conversation_id} eliminada.")
            return True
        except Exception as e:
            logger.error(f"Error al eliminar conversación {conversation_id}: {e}")
            return False

    # ── Backlogs ─────────────────────────────────────────────────────

    def create_backlog(self, item: dict) -> dict:
        """Crea un nuevo requerimiento en la colección backlogs."""
        try:
            self._persist(self._coll("backlogs"), item)
            logger.info(f"Backlog creado: {item['id']}")
            return self._clean_item(item)
        except Exception as e:
            logger.error(f"Error al crear backlog: {e}")
            raise

    def get_backlogs_filtered(
        self,
        division: Optional[str] = None,
        estado: Optional[str] = None,
        prioridad: Optional[str] = None,
        solicitante_email: Optional[str] = None,
    ) -> List[dict]:
        """Obtiene requerimientos con filtros opcionales."""
        try:
            query: dict = {}
            if division:
                query["division"] = division
            if estado:
                query["estado"] = estado
            if prioridad:
                query["prioridad"] = prioridad
            if solicitante_email:
                query["solicitante_email"] = solicitante_email

            items = list(
                self._coll("backlogs").find(query).sort("created_at", -1)
            )
            return [self._clean_item(i) for i in items]
        except Exception as e:
            logger.error(f"Error al obtener backlogs: {e}")
            raise

    def get_backlog_by_id(self, backlog_id: str, division: str) -> Optional[dict]:
        """Obtiene un requerimiento por ID. `division` se acepta por compatibilidad."""
        try:
            item = self._coll("backlogs").find_one({"_id": backlog_id})
            return self._clean_item(item) if item else None
        except Exception as e:
            logger.error(f"Error al obtener backlog {backlog_id}: {e}")
            raise

    def update_backlog_estado(self, backlog_id: str, division: str, estado: str) -> Optional[dict]:
        """Actualiza el estado de un requerimiento."""
        try:
            collection = self._coll("backlogs")
            item = collection.find_one({"_id": backlog_id})
            if item is None:
                return None
            item["estado"] = estado
            item["updated_at"] = datetime.utcnow().isoformat()
            self._persist(collection, item)
            logger.info(f"Backlog {backlog_id} estado actualizado a {estado}")
            return self._clean_item(item)
        except Exception as e:
            logger.error(f"Error al actualizar estado backlog {backlog_id}: {e}")
            raise

    def update_backlog_full(self, backlog_id: str, division: str, updates: dict) -> Optional[dict]:
        """Actualiza un requerimiento completo."""
        try:
            collection = self._coll("backlogs")
            item = collection.find_one({"_id": backlog_id})
            if item is None:
                return None
            item.update(updates)
            item["updated_at"] = datetime.utcnow().isoformat()
            self._persist(collection, item)
            logger.info(f"Backlog {backlog_id} editado completamente.")
            return self._clean_item(item)
        except Exception as e:
            logger.error(f"Error al editar backlog {backlog_id}: {e}")
            raise

    def delete_backlog(self, backlog_id: str, division: str) -> bool:
        """Elimina un requerimiento."""
        try:
            result = self._coll("backlogs").delete_one({"_id": backlog_id})
            if result.deleted_count == 0:
                return False
            logger.info(f"Backlog {backlog_id} eliminado.")
            return True
        except Exception as e:
            logger.error(f"Error al eliminar backlog {backlog_id}: {e}")
            raise

    def upvote_backlog(self, backlog_id: str, division: str, voter_email: str) -> Optional[dict]:
        """Incrementa el contador de votos (1 voto por usuario).
        Retorna None si el usuario ya votó o el item no existe."""
        try:
            collection = self._coll("backlogs")
            item = collection.find_one({"_id": backlog_id})
            if item is None:
                return None
            votos_usuarios: list = item.get("votos_usuarios", [])
            if voter_email in votos_usuarios:
                return None  # ya votó — no se modifica nada
            votos_usuarios.append(voter_email)
            item["votos_usuarios"] = votos_usuarios
            item["votos"] = len(votos_usuarios)
            item["updated_at"] = datetime.utcnow().isoformat()
            self._persist(collection, item)
            logger.info(f"Backlog {backlog_id} votos: {item['votos']}")
            return self._clean_item(item)
        except Exception as e:
            logger.error(f"Error al votar backlog {backlog_id}: {e}")
            raise

    # ── Course Progress ──────────────────────────────────────────────

    def get_user_course_progress(self, user_id: str) -> Optional[dict]:
        """Lee el documento de progreso de cursos del usuario; None si no existe."""
        try:
            item = self._coll("course_progress").find_one({"_id": user_id})
            return self._clean_item(item) if item else None
        except Exception as e:
            logger.warning(f"Error al leer progreso de cursos {user_id}: {e}")
            return None

    def upsert_user_course_progress(
        self,
        user_id: str,
        upn: Optional[str],
        progress: dict,
        updated_at: str,
    ) -> dict:
        """Inserta o actualiza el progreso de cursos del usuario.

        Last-write-wins por timestamp: si el documento existente tiene un
        updated_at más reciente que el entrante, se conserva el existente.
        """
        try:
            existing = self.get_user_course_progress(user_id)
            if existing and existing.get("updatedAt") and existing["updatedAt"] > updated_at:
                return existing

            doc = {
                "id": user_id,
                "userId": user_id,
                "upn": upn,
                "progress": progress,
                "updatedAt": updated_at,
            }
            self._persist(self._coll("course_progress"), doc)
            logger.info(f"Progreso de cursos guardado: {user_id}")
            return self._clean_item(doc)
        except Exception as e:
            logger.error(f"Error al guardar progreso de cursos {user_id}: {e}")
            raise

    # ── Stats ─────────────────────────────────────────────────────────

    def get_stats(self, days: int = 30) -> dict:
        """Calcula métricas reales desde la base de datos.

        Args:
            days: Ventana de tiempo en días para las métricas del período actual.

        Returns:
            Dict con KPIs y series temporales mensuales.
        """
        from datetime import timezone, timedelta
        from collections import defaultdict

        HOURS_PER_CONVERSATION = 2.0  # horas ahorradas estimadas por conversación

        try:
            all_convs = list(self._coll("conversations").find(
                {}, {"user_email": 1, "division": 1, "created_at": 1}
            ))
        except Exception as e:
            logger.error(f"Error al obtener conversaciones para stats: {e}")
            all_convs = []

        try:
            # Solo mensajes de usuario (rol "user") — son los únicos usados en métricas
            all_messages = list(self._coll("messages").find(
                {"role": "user"},
                {"user_email": 1, "conversation_id": 1, "division": 1, "timestamp": 1},
            ))
        except Exception as e:
            logger.error(f"Error al obtener mensajes para stats: {e}")
            all_messages = []

        now = datetime.now(timezone.utc)
        period_start = now - timedelta(days=days)

        # ── KPIs del período ──
        period_convs = [
            c for c in all_convs
            if c.get("created_at") and self._parse_dt(c["created_at"]) >= period_start
        ]

        total_convs_period = len(period_convs)
        hours_saved = round(total_convs_period * HOURS_PER_CONVERSATION)

        # Usuarios activos = únicos con mensajes en el período (todos son "user" por la query)
        user_msgs_period = [
            m for m in all_messages
            if m.get("timestamp") and self._parse_dt(m["timestamp"]) >= period_start
        ]
        unique_users_period = len(set(m["user_email"] for m in user_msgs_period if m.get("user_email")))

        # Avg mensajes por conversación (mensajes de usuario en el período)
        from collections import Counter as _Counter
        conv_msg_counts: dict = {}
        for m in user_msgs_period:
            cid = m.get("conversation_id")
            if cid:
                conv_msg_counts[cid] = conv_msg_counts.get(cid, 0) + 1
        avg_msgs_per_conv = (
            round(sum(conv_msg_counts.values()) / len(conv_msg_counts), 1)
            if conv_msg_counts else 0.0
        )

        # División breakdown desde conversaciones del período
        division_counts = _Counter(c.get("division") for c in period_convs if c.get("division"))
        division_breakdown = [
            {"nombre": div, "value": cnt}
            for div, cnt in division_counts.most_common()
        ]

        # ── Total histórico ──
        unique_users_total = len(set(
            c["user_email"] for c in all_convs if c.get("user_email")
        ))
        total_convs_all = len(all_convs)
        hours_saved_total = round(total_convs_all * HOURS_PER_CONVERSATION)

        # ── Agentes y backlogs ──
        total_agents = len(self._get_cached_agents())
        try:
            total_backlogs = self._coll("backlogs").count_documents({})
        except Exception:
            total_backlogs = 0

        # ── Serie mensual (últimos 6 meses) ──
        monthly: dict = defaultdict(lambda: {"conversations": 0, "users": set()})
        first_seen: dict = {}  # user_email → mes de primera aparición

        sorted_convs = sorted(
            [c for c in all_convs if c.get("created_at")],
            key=lambda c: c["created_at"],
        )
        for c in sorted_convs:
            email = c.get("user_email", "unknown")
            month_key = c["created_at"][:7]  # "YYYY-MM"
            if email not in first_seen:
                first_seen[email] = month_key

        # Construir etiquetas de los últimos 6 meses
        month_labels = []
        for i in range(5, -1, -1):
            dt = now - timedelta(days=30 * i)
            month_labels.append(dt.strftime("%Y-%m"))

        MONTH_ES = {
            "01": "Ene", "02": "Feb", "03": "Mar", "04": "Abr",
            "05": "May", "06": "Jun", "07": "Jul", "08": "Ago",
            "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dic",
        }

        for c in all_convs:
            if not c.get("created_at"):
                continue
            month_key = c["created_at"][:7]
            if month_key in month_labels:
                email = c.get("user_email", "unknown")
                monthly[month_key]["conversations"] += 1
                monthly[month_key]["users"].add(email)

        monthly_activity = []
        for mk in month_labels:
            data = monthly[mk]
            users_set: set = data["users"]
            new_users = sum(1 for u in users_set if first_seen.get(u) == mk)
            returning_users = len(users_set) - new_users
            month_num = mk.split("-")[1]
            monthly_activity.append({
                "month": mk,
                "mes": MONTH_ES.get(month_num, month_num),
                "conversations": data["conversations"],
                "unique_users": len(users_set),
                "new_users": new_users,
                "returning_users": returning_users,
            })

        return {
            "kpis": {
                "unique_users": unique_users_period,
                "unique_users_total": unique_users_total,
                "total_conversations": total_convs_period,
                "total_conversations_all": total_convs_all,
                "total_agents": total_agents,
                "total_backlogs": total_backlogs,
                "hours_saved": hours_saved,
                "hours_saved_total": hours_saved_total,
                "avg_msgs_per_conv": avg_msgs_per_conv,
            },
            "monthly_activity": monthly_activity,
            "division_breakdown": division_breakdown,
        }

    @staticmethod
    def _parse_dt(value: str):
        """Parsea una fecha ISO 8601 a datetime aware (UTC)."""
        from datetime import timezone
        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except Exception:
            return datetime.min.replace(tzinfo=timezone.utc)


cosmos_service = CosmosService()
