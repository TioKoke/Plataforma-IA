"""Catálogo de datasets del lakehouse-lite.

Cada dataset se persiste como dos blobs en el container ``generated``:

- ``wkspc_<conv_id>_<dataset_id>.parquet`` — datos columnares.
- ``wkspc_<conv_id>_<dataset_id>.meta.json`` — metadata (schema, source, fechas).

El prefijo ``wkspc_`` permite listar/filtrar por conversación sin tocar
``storage_service``: convive con el path-jail existente sin necesidad de
cambiar el whitelist de prefijos.
"""
from __future__ import annotations

import json
import logging
import re
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

from app.services.storage_service import storage_service

logger = logging.getLogger(__name__)

WORKSPACE_PREFIX = "wkspc"
META_SUFFIX = ".meta.json"
DATA_SUFFIX = ".parquet"
_SAFE_TOKEN = re.compile(r"^[A-Za-z0-9_\-]{1,64}$")


@dataclass
class DatasetMeta:
    dataset_id: str
    conversation_id: str
    source_filename: str
    sheet_name: Optional[str]
    row_count: int
    column_count: int
    schema: dict[str, str]  # {col_name: dtype}
    created_at: str
    size_bytes: int = 0
    extra: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "DatasetMeta":
        known = {f.name for f in cls.__dataclass_fields__.values()}
        return cls(**{k: v for k, v in data.items() if k in known})


def _ensure_safe_token(value: str, *, label: str) -> str:
    if not _SAFE_TOKEN.match(value or ""):
        raise ValueError(f"{label} inválido: {value!r}")
    return value


class DatasetCatalog:
    """API de alto nivel sobre el catálogo de datasets."""

    @staticmethod
    def new_dataset_id() -> str:
        return uuid.uuid4().hex[:12]

    @staticmethod
    def _filename(conv_id: str, dataset_id: str, suffix: str) -> str:
        _ensure_safe_token(conv_id, label="conversation_id")
        _ensure_safe_token(dataset_id, label="dataset_id")
        return f"generated/{WORKSPACE_PREFIX}_{conv_id}_{dataset_id}{suffix}"

    @classmethod
    def data_path(cls, conv_id: str, dataset_id: str) -> str:
        return cls._filename(conv_id, dataset_id, DATA_SUFFIX)

    @classmethod
    def meta_path(cls, conv_id: str, dataset_id: str) -> str:
        return cls._filename(conv_id, dataset_id, META_SUFFIX)

    @classmethod
    def register(cls, content: bytes, meta: DatasetMeta) -> DatasetMeta:
        data_path = cls.data_path(meta.conversation_id, meta.dataset_id)
        meta_path = cls.meta_path(meta.conversation_id, meta.dataset_id)
        meta.size_bytes = len(content)
        storage_service.upload_blob(content, data_path)
        storage_service.upload_blob(
            json.dumps(meta.to_dict(), ensure_ascii=False, indent=2).encode("utf-8"),
            meta_path,
        )
        logger.info(
            "dataset registrado: %s (rows=%d, size=%d B)",
            meta.dataset_id, meta.row_count, meta.size_bytes,
        )
        return meta

    @classmethod
    def get_meta(cls, conv_id: str, dataset_id: str) -> Optional[DatasetMeta]:
        meta_path = cls.meta_path(conv_id, dataset_id)
        if not storage_service.blob_exists(meta_path):
            return None
        raw = storage_service.download_blob(meta_path)
        return DatasetMeta.from_dict(json.loads(raw.decode("utf-8")))

    @classmethod
    def get_data_bytes(cls, conv_id: str, dataset_id: str) -> bytes:
        return storage_service.download_blob(cls.data_path(conv_id, dataset_id))

    @classmethod
    def list_for_conversation(cls, conv_id: str) -> list[DatasetMeta]:
        _ensure_safe_token(conv_id, label="conversation_id")
        prefix_pat = f"{WORKSPACE_PREFIX}_{conv_id}_"
        results: list[DatasetMeta] = []
        for blob_path in storage_service.list_blobs("generated"):
            name = blob_path.split("/", 1)[-1]
            if not (name.startswith(prefix_pat) and name.endswith(META_SUFFIX)):
                continue
            try:
                raw = storage_service.download_blob(blob_path)
                results.append(DatasetMeta.from_dict(json.loads(raw.decode("utf-8"))))
            except Exception as exc:
                logger.warning("meta corrupto en %s: %s", blob_path, exc)
        return results

    @classmethod
    def delete(cls, conv_id: str, dataset_id: str) -> None:
        for path in (cls.data_path(conv_id, dataset_id),
                     cls.meta_path(conv_id, dataset_id)):
            try:
                storage_service.delete_blob(path)
            except Exception as exc:
                logger.warning("error eliminando %s: %s", path, exc)


def now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


# Singleton ergonómico
dataset_catalog = DatasetCatalog()
