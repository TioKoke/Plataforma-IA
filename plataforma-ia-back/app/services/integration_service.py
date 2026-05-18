"""
Servicio de almacenamiento seguro de tokens OAuth en MongoDB.
Cifra tokens con AES-256-GCM antes de persistirlos.

Mantiene las firmas públicas de la versión anterior (Cosmos DB) para no tocar
los routers. El TTL de los OAuth states se implementa con un índice TTL de Mongo.
"""
from datetime import datetime, timezone
from typing import Optional

from pymongo import MongoClient

from app.config import config, get_logger
from app.services.encryption_service import encryption_service

logger = get_logger("integration")

# Servicios soportados
SUPPORTED_SERVICES = {"outlook", "jira"}

# TTL de los OAuth states en segundos (CSRF protection, un solo uso)
_OAUTH_STATE_TTL_SECONDS = 600


class IntegrationService:
    """Gestión de tokens OAuth cifrados en MongoDB."""

    COLLECTION_NAME = "user_integrations"
    OAUTH_STATES_COLLECTION = "oauth_states"

    def __init__(self):
        self._client: Optional[MongoClient] = None
        self._db = None
        self._states_index_ready = False

    # ── Lazy init (mismo patrón que cosmos_service.py) ───────────

    def _get_client(self) -> MongoClient:
        if self._client is None:
            if not config.MONGODB_URI:
                raise RuntimeError("MONGODB_URI no está configurado")
            self._client = MongoClient(config.MONGODB_URI)
        return self._client

    def _get_db(self):
        if self._db is None:
            self._db = self._get_client()[config.MONGODB_DB_NAME]
        return self._db

    def _get_collection(self):
        return self._get_db()[self.COLLECTION_NAME]

    def _get_states_collection(self):
        coll = self._get_db()[self.OAUTH_STATES_COLLECTION]
        if not self._states_index_ready:
            # Índice TTL: Mongo expira los documentos automáticamente
            # _OAUTH_STATE_TTL_SECONDS después de `created_at`.
            coll.create_index("created_at", expireAfterSeconds=_OAUTH_STATE_TTL_SECONDS)
            self._states_index_ready = True
        return coll

    # ── Token storage ────────────────────────────────────────────

    def store_tokens(
        self,
        user_email: str,
        service: str,
        access_token: str,
        refresh_token: str,
        expires_at: datetime,
        scopes: list[str],
        metadata: Optional[dict] = None,
    ) -> dict:
        """Encrypt and store OAuth tokens for a user+service pair."""
        if service not in SUPPORTED_SERVICES:
            raise ValueError(f"Servicio no soportado: {service}")

        # Encrypt tokens
        enc_access, iv_access = encryption_service.encrypt(access_token)
        enc_refresh, iv_refresh = encryption_service.encrypt(refresh_token)

        now = datetime.now(timezone.utc).isoformat()
        doc_id = f"{user_email}_{service}"

        document = {
            "_id": doc_id,
            "id": doc_id,
            "user_email": user_email,
            "service": service,
            "status": "connected",
            "encrypted_access_token": enc_access,
            "access_token_iv": iv_access,
            "encrypted_refresh_token": enc_refresh,
            "refresh_token_iv": iv_refresh,
            "token_expires_at": expires_at.isoformat(),
            "scopes": scopes,
            "service_metadata": metadata or {},
            "connected_at": now,
            "updated_at": now,
        }

        self._get_collection().replace_one({"_id": doc_id}, document, upsert=True)
        logger.info(f"Tokens almacenados para {user_email} / {service}")
        return {"service": service, "status": "connected"}

    def get_integration(self, user_email: str, service: str) -> Optional[dict]:
        """Get raw integration document."""
        doc_id = f"{user_email}_{service}"
        return self._get_collection().find_one({"_id": doc_id})

    def get_decrypted_access_token(self, user_email: str, service: str) -> Optional[str]:
        """Get decrypted access token. Returns None if not connected or expired."""
        doc = self.get_integration(user_email, service)
        if not doc or doc.get("status") != "connected":
            return None

        # Check expiry
        expires_at = datetime.fromisoformat(doc["token_expires_at"])
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        if datetime.now(timezone.utc) >= expires_at:
            # Token expired — caller should refresh
            return None

        return encryption_service.decrypt(
            doc["encrypted_access_token"], doc["access_token_iv"]
        )

    def get_decrypted_refresh_token(self, user_email: str, service: str) -> Optional[str]:
        """Get decrypted refresh token for token renewal."""
        doc = self.get_integration(user_email, service)
        if not doc:
            return None
        return encryption_service.decrypt(
            doc["encrypted_refresh_token"], doc["refresh_token_iv"]
        )

    def update_tokens(
        self,
        user_email: str,
        service: str,
        access_token: str,
        refresh_token: str,
        expires_at: datetime,
    ) -> None:
        """Update tokens after a refresh (re-encrypts)."""
        doc = self.get_integration(user_email, service)
        if not doc:
            raise ValueError(f"No integration found for {user_email}/{service}")

        enc_access, iv_access = encryption_service.encrypt(access_token)
        enc_refresh, iv_refresh = encryption_service.encrypt(refresh_token)

        doc["encrypted_access_token"] = enc_access
        doc["access_token_iv"] = iv_access
        doc["encrypted_refresh_token"] = enc_refresh
        doc["refresh_token_iv"] = iv_refresh
        doc["token_expires_at"] = expires_at.isoformat()
        doc["updated_at"] = datetime.now(timezone.utc).isoformat()
        doc["status"] = "connected"

        self._get_collection().replace_one({"_id": doc["_id"]}, doc, upsert=True)
        logger.info(f"Tokens renovados para {user_email} / {service}")

    def get_all_statuses(self, user_email: str) -> list[dict]:
        """Get connection status for all services (no tokens exposed)."""
        statuses = []
        for service in SUPPORTED_SERVICES:
            doc = self.get_integration(user_email, service)
            if doc and doc.get("status") == "connected":
                # Check if token is expired
                expires_at = datetime.fromisoformat(doc["token_expires_at"])
                if expires_at.tzinfo is None:
                    expires_at = expires_at.replace(tzinfo=timezone.utc)

                status = "connected"
                if datetime.now(timezone.utc) >= expires_at:
                    status = "expired"

                statuses.append({
                    "service": service,
                    "status": status,
                    "connected_at": doc.get("connected_at"),
                    "scopes": doc.get("scopes", []),
                })
            else:
                statuses.append({
                    "service": service,
                    "status": "disconnected",
                    "connected_at": None,
                    "scopes": [],
                })
        return statuses

    def disconnect(self, user_email: str, service: str) -> bool:
        """Remove stored tokens and mark as disconnected."""
        doc_id = f"{user_email}_{service}"
        result = self._get_collection().delete_one({"_id": doc_id})
        if result.deleted_count:
            logger.info(f"Integración desconectada: {user_email} / {service}")
            return True
        return False

    # ── OAuth state management (CSRF protection) ─────────────────

    def store_oauth_state(
        self,
        state: str,
        user_email: str,
        service: str,
        code_verifier: Optional[str] = None,
    ) -> None:
        """Store OAuth state for CSRF validation. Auto-expires via TTL index."""
        document = {
            "_id": state,
            "state": state,
            "user_email": user_email,
            "service": service,
            "code_verifier": code_verifier,
            # Fecha BSON real — requerida por el índice TTL de Mongo.
            "created_at": datetime.now(timezone.utc),
        }
        self._get_states_collection().replace_one({"_id": state}, document, upsert=True)

    def consume_oauth_state(self, state: str) -> Optional[dict]:
        """Validate and consume an OAuth state (one-time use)."""
        coll = self._get_states_collection()
        doc = coll.find_one({"_id": state})
        if doc is None:
            return None
        # Delete after reading (one-time use)
        coll.delete_one({"_id": state})
        return doc


integration_service = IntegrationService()
