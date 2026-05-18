"""Lakehouse-lite para Plataforma IA.

Tres operaciones sobre datasets tabulares (CSV/TSV/XLSX/JSON/Parquet):

- ``ingest_file`` — convierte cualquier formato soportado a Parquet canónico.
- ``query_dataset`` — corre SQL DuckDB sobre el Parquet, con sanitización.
- ``export_dataset`` — exporta a XLSX (con branding), CSV, TSV, JSON o Parquet.

Los datasets viven en ``generated/`` con prefijo ``wkspc_<conv_id>_<dataset_id>``,
manteniendo el path-jail de :mod:`app.services.storage_service`.
"""
from app.agents.datalake.catalog import DatasetCatalog, DatasetMeta, dataset_catalog
from app.agents.datalake.export import export_dataset
from app.agents.datalake.ingest import ingest_file
from app.agents.datalake.query import QueryRejectedError, query_dataset

__all__ = [
    "DatasetCatalog",
    "DatasetMeta",
    "dataset_catalog",
    "export_dataset",
    "ingest_file",
    "query_dataset",
    "QueryRejectedError",
]
