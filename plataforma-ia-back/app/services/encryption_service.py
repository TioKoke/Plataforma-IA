"""
Servicio de cifrado de tokens OAuth.
Usa AES-256-GCM con clave almacenada en Azure Key Vault.
"""
import os
import base64
import secrets
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.config import get_logger, config

logger = get_logger("encryption")


class EncryptionService:
    """AES-256-GCM encryption for OAuth tokens. Key sourced from Key Vault."""

    def __init__(self):
        self._key: bytes | None = None

    def _get_key(self) -> bytes:
        """Get or generate the AES-256 encryption key."""
        if self._key is not None:
            return self._key

        # In production: key comes from Key Vault via config
        # In dev: from INTEGRATION_ENCRYPTION_KEY env var
        key_hex = config.INTEGRATION_ENCRYPTION_KEY
        if key_hex:
            self._key = bytes.fromhex(key_hex)
        else:
            # Auto-generate for dev (logged as warning)
            logger.warning(
                "INTEGRATION_ENCRYPTION_KEY no configurada. "
                "Generando clave efímera (tokens no sobreviven reinicios)."
            )
            self._key = AESGCM.generate_key(bit_length=256)

        if len(self._key) != 32:
            raise ValueError("La clave de cifrado debe ser de 32 bytes (256 bits)")

        return self._key

    def encrypt(self, plaintext: str) -> tuple[str, str]:
        """
        Encrypt a string using AES-256-GCM.

        Returns:
            Tuple of (encrypted_base64, iv_base64)
        """
        key = self._get_key()
        iv = secrets.token_bytes(12)  # 96-bit nonce for GCM
        aesgcm = AESGCM(key)
        ciphertext = aesgcm.encrypt(iv, plaintext.encode("utf-8"), None)
        return (
            base64.b64encode(ciphertext).decode("ascii"),
            base64.b64encode(iv).decode("ascii"),
        )

    def decrypt(self, encrypted_b64: str, iv_b64: str) -> str:
        """
        Decrypt a base64-encoded AES-256-GCM ciphertext.

        Returns:
            Decrypted plaintext string
        """
        key = self._get_key()
        ciphertext = base64.b64decode(encrypted_b64)
        iv = base64.b64decode(iv_b64)
        aesgcm = AESGCM(key)
        plaintext = aesgcm.decrypt(iv, ciphertext, None)
        return plaintext.decode("utf-8")


encryption_service = EncryptionService()
