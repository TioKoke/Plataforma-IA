"""
Script de seed para cargar videos desde videos_catalog.json a Cosmos DB.

Uso:
    cd plataforma-ia-back

    # Seed básico (usa .env por defecto)
    python scripts/seed_videos.py

    # Especificar env file
    python scripts/seed_videos.py --env-file .env.dev

    # Limpiar todos los videos existentes antes de insertar
    python scripts/seed_videos.py --env-file .env.prod --clear

Entornos disponibles:
    .env.dev   → Cosmos DB Development
    .env.test  → Cosmos DB Test
    .env.prod  → Cosmos DB Production
"""
import argparse
import json
import os
import re
import sys
import unicodedata
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv


def slugify(text: str, max_len: int = 40) -> str:
    """Convierte texto a un slug válido."""
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"-+", "-", text)
    return text.strip("-")[:max_len]


def clear_collection(collection) -> int:
    """Elimina todos los documentos de la colección."""
    print("  Eliminando videos existentes...")
    result = collection.delete_many({})
    print(f"    Eliminados: {result.deleted_count}")
    return result.deleted_count


def main():
    parser = argparse.ArgumentParser(description="Seed videos en MongoDB")
    parser.add_argument(
        "--env-file",
        default=".env",
        help="Archivo .env a cargar (default: .env). Ej: .env.dev, .env.test, .env.prod",
    )
    parser.add_argument(
        "--clear",
        action="store_true",
        help="Eliminar todos los videos existentes antes de insertar",
    )
    args = parser.parse_args()

    env_path = Path(__file__).resolve().parent.parent / args.env_file
    if not env_path.exists():
        print(f"Error: No se encontró el archivo de entorno: {env_path}")
        sys.exit(1)

    load_dotenv(env_path, override=True)
    print(f"Entorno cargado desde: {env_path.name}")

    mongodb_uri = os.getenv("MONGODB_URI")
    database_name = os.getenv("MONGODB_DB_NAME", "plataformaia")

    if not mongodb_uri:
        print(f"Error: MONGODB_URI debe estar configurado en {args.env_file}")
        sys.exit(1)

    print(f"MongoDB database: {database_name}")

    catalog_path = Path(__file__).resolve().parent.parent / "app" / "data" / "videos_catalog.json"
    if not catalog_path.exists():
        print(f"Error: No se encontró {catalog_path}")
        sys.exit(1)

    with open(catalog_path, "r", encoding="utf-8") as f:
        videos = json.load(f)

    print(f"Videos encontrados en catálogo: {len(videos)}")

    from pymongo import MongoClient

    client = MongoClient(mongodb_uri)
    collection = client[database_name]["videos"]
    print(f"Colección 'videos' lista en database '{database_name}'")

    if args.clear:
        deleted = clear_collection(collection)
        print(f"  Eliminados {deleted} videos existentes\n")

    inserted = 0
    categories = set()
    levels = set()

    for video in videos:
        slug = slugify(video["title"])
        # Sufijo corto para evitar colisiones de slug.
        video_id = f"vid_{slug}-{uuid.uuid4().hex[:6]}" if slug else f"vid_{uuid.uuid4().hex[:12]}"
        video["id"] = video_id
        video["_id"] = video_id
        collection.replace_one({"_id": video_id}, video, upsert=True)
        inserted += 1
        categories.add(video.get("category", ""))
        levels.add(video.get("level", ""))
        print(f"  [{inserted}/{len(videos)}] {video_id} -> {video['title'][:60]}")

    print(f"\n{'='*50}")
    print(f"Seed completado exitosamente!")
    print(f"  Videos insertados/actualizados: {inserted}")
    print(f"  Categorías ({len(categories)}):")
    for c in sorted(categories):
        print(f"    - {c}")
    print(f"  Niveles ({len(levels)}):")
    for lv in sorted(levels):
        print(f"    - {lv}")


if __name__ == "__main__":
    main()
