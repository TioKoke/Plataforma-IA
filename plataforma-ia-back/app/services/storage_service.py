"""
Servicio de almacenamiento con Google Cloud Storage y fallback a disco local.

- En Cloud Run: usa GCS con Application Default Credentials — la service
  account asignada a Cloud Run hace la auth, sin archivo de credenciales.
- En local sin `GCS_BUCKET_NAME`: cae a disco local automáticamente.
  Para probar GCS desde local, setear `GOOGLE_APPLICATION_CREDENTIALS` a un JSON
  de service account además de `GCS_BUCKET_NAME`.

Estructura lógica de prefijos dentro del bucket:
  - uploads/    → archivos subidos por usuarios
  - generated/  → archivos generados por agentes
  - icons/      → íconos de agentes
"""
import logging
from pathlib import Path
from typing import List

from app.config import config

logger = logging.getLogger(__name__)

# Directorios locales para fallback
LOCAL_UPLOADS_DIR = Path("uploads")
LOCAL_GENERATED_DIR = Path("generated_files")
LOCAL_ICONS_DIR = Path("agent_icons")

# Prefijo lógico → directorio local de fallback
_PREFIX_MAP = {
    "uploads": LOCAL_UPLOADS_DIR,
    "generated": LOCAL_GENERATED_DIR,
    "icons": LOCAL_ICONS_DIR,
}


class StorageService:
    """Almacenamiento de archivos con Google Cloud Storage o disco local."""

    def __init__(self):
        self._bucket = None

        if config.use_gcs_storage:
            self._init_gcs_storage()
        else:
            for local_dir in _PREFIX_MAP.values():
                local_dir.mkdir(exist_ok=True)
            logger.info("StorageService: modo disco local (GCS_BUCKET_NAME no configurado)")

    def _init_gcs_storage(self):
        """Inicializa el bucket de GCS usando Application Default Credentials.

        En Cloud Run, ADC usa la service account asignada al servicio.
        En local, ADC usa `GOOGLE_APPLICATION_CREDENTIALS` o las credenciales
        de `gcloud auth application-default login`.
        """
        try:
            from google.cloud import storage as gcs_storage

            client = gcs_storage.Client()
            self._bucket = client.bucket(config.GCS_BUCKET_NAME)
            logger.info(
                f"StorageService: GCS (bucket='{config.GCS_BUCKET_NAME}', "
                f"project='{client.project}')"
            )
        except Exception as e:
            logger.error(f"Error inicializando GCS, usando disco local: {e}")
            self._bucket = None
            for local_dir in _PREFIX_MAP.values():
                local_dir.mkdir(exist_ok=True)

    @property
    def _use_remote(self) -> bool:
        return self._bucket is not None

    def _resolve(self, blob_path: str):
        """
        Resuelve un blob_path lógico (e.g. 'generated/datos.xlsx') a
        `(prefix, filename, local_dir)`.

        Aplica sanitización contra path traversal: rechaza `..`, separadores
        de path y nombres absolutos en la parte del filename. El prefijo debe
        pertenecer al conjunto permitido (`uploads`, `generated`, `icons`).
        """
        if "/" in blob_path:
            prefix, filename = blob_path.split("/", 1)
        else:
            prefix, filename = "generated", blob_path

        if prefix not in _PREFIX_MAP:
            raise ValueError(f"Prefijo de storage no permitido: {prefix!r}")

        # Sanitización estricta del filename (previene ../ , \\ , rutas absolutas).
        safe_name = Path(filename).name
        if not safe_name or safe_name != filename or ".." in safe_name:
            raise ValueError(f"Nombre de archivo inseguro: {filename!r}")

        return prefix, safe_name, _PREFIX_MAP[prefix]

    # ── Operaciones públicas ──────────────────────────────────────────────

    def upload_icon(self, content: bytes, agent_id: str) -> None:
        """Sube un ícono de agente. Se sirve siempre via proxy en GET /agents/{agent_id}/icon."""
        self.upload_blob(content, f"icons/icon-{agent_id}")
        logger.info(f"Ícono subido: icon-{agent_id}")

    def download_icon(self, agent_id: str) -> bytes:
        """Descarga un ícono de agente."""
        return self.download_blob(f"icons/icon-{agent_id}")

    def upload_blob(self, content: bytes, blob_path: str) -> str:
        """
        Sube un archivo al storage.

        Args:
            content: Contenido del archivo en bytes
            blob_path: Ruta lógica (ej: 'uploads/archivo.pdf', 'generated/datos.xlsx')

        Returns:
            URL o ruta del archivo guardado
        """
        prefix, filename, local_dir = self._resolve(blob_path)

        if self._use_remote:
            blob = self._bucket.blob(f"{prefix}/{filename}")
            blob.upload_from_string(content)
            logger.info(f"Blob subido: {prefix}/{filename}")
            return blob.public_url
        else:
            local_dir.mkdir(exist_ok=True)
            file_path = local_dir / filename
            file_path.write_bytes(content)
            logger.info(f"Archivo local guardado: {file_path}")
            return str(file_path)

    def download_blob(self, blob_path: str) -> bytes:
        """Descarga un archivo del storage."""
        prefix, filename, local_dir = self._resolve(blob_path)

        if self._use_remote:
            blob = self._bucket.blob(f"{prefix}/{filename}")
            return blob.download_as_bytes()
        else:
            return (local_dir / filename).read_bytes()

    def delete_blob(self, blob_path: str) -> None:
        """Elimina un archivo del storage."""
        prefix, filename, local_dir = self._resolve(blob_path)

        if self._use_remote:
            blob = self._bucket.blob(f"{prefix}/{filename}")
            try:
                blob.delete()
                logger.info(f"Blob eliminado: {prefix}/{filename}")
            except Exception as e:
                logger.warning(f"No se pudo eliminar el blob {prefix}/{filename}: {e}")
        else:
            file_path = local_dir / filename
            if file_path.exists():
                file_path.unlink()
                logger.info(f"Archivo local eliminado: {file_path}")

    def blob_exists(self, blob_path: str) -> bool:
        """Verifica si un archivo existe en el storage."""
        prefix, filename, local_dir = self._resolve(blob_path)

        if self._use_remote:
            try:
                return self._bucket.blob(f"{prefix}/{filename}").exists()
            except Exception:
                return False
        else:
            return (local_dir / filename).exists()

    def get_blob_size(self, blob_path: str) -> int:
        """Returns the byte size of a blob, or 0 if unavailable."""
        prefix, filename, local_dir = self._resolve(blob_path)

        if self._use_remote:
            try:
                blob = self._bucket.blob(f"{prefix}/{filename}")
                blob.reload()
                return blob.size or 0
            except Exception:
                return 0
        else:
            local_path = local_dir / filename
            return local_path.stat().st_size if local_path.exists() else 0

    def get_blob_mtime(self, blob_path: str) -> float:
        """
        Retorna el timestamp Unix de última modificación del blob, o 0.0 si
        no se puede determinar. Usado por el cleanup periódico de huérfanos.
        """
        prefix, filename, local_dir = self._resolve(blob_path)

        if self._use_remote:
            try:
                blob = self._bucket.blob(f"{prefix}/{filename}")
                blob.reload()
                return blob.updated.timestamp() if blob.updated else 0.0
            except Exception:
                return 0.0
        else:
            local_path = local_dir / filename
            return local_path.stat().st_mtime if local_path.exists() else 0.0

    def list_blobs(self, prefix: str) -> List[str]:
        """
        Lista archivos por prefijo lógico.

        Args:
            prefix: Prefijo para filtrar (ej: 'generated/', 'uploads/')

        Returns:
            Lista de blob_paths lógicos (ej: 'generated/datos.xlsx')
        """
        clean_prefix = prefix.rstrip("/")
        if clean_prefix not in _PREFIX_MAP:
            clean_prefix = "generated"

        if self._use_remote:
            try:
                blobs = self._bucket.list_blobs(prefix=f"{clean_prefix}/")
                result = []
                for blob in blobs:
                    name = blob.name.split("/", 1)[1] if "/" in blob.name else blob.name
                    if name:
                        result.append(f"{clean_prefix}/{name}")
                return result
            except Exception as e:
                logger.warning(f"Error listando blobs de {clean_prefix}: {e}")
                return []
        else:
            local_dir = _PREFIX_MAP[clean_prefix]
            if not local_dir.exists():
                return []
            return [
                f"{clean_prefix}/{f.name}"
                for f in local_dir.iterdir()
                if f.is_file()
            ]


# Instancia global
storage_service = StorageService()
