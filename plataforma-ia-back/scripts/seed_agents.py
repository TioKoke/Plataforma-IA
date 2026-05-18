"""
Script de seed para cargar agentes desde agents_catalog.json a Cosmos DB.

Uso:
    cd plataforma-ia-back

    # Seed básico (usa .env por defecto)
    python scripts/seed_agents.py

    # Especificar env file
    python scripts/seed_agents.py --env-file .env.dev

    # Limpiar todos los agentes existentes antes de insertar (recomendado al cambiar categorías)
    python scripts/seed_agents.py --env-file .env.prod --clear

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
from pathlib import Path

# Agregar el directorio raíz del backend al path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv


def slugify(text: str) -> str:
    """Convierte texto a un slug válido como ID de Cosmos DB."""
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"-+", "-", text)
    return text.strip("-")


def clear_collection(collection) -> int:
    """Elimina todos los documentos de la colección. Retorna la cantidad eliminada."""
    print("  Eliminando agentes existentes...")
    result = collection.delete_many({})
    print(f"    Eliminados: {result.deleted_count}")
    return result.deleted_count


def main():
    parser = argparse.ArgumentParser(description="Seed agentes en MongoDB")
    parser.add_argument(
        "--env-file",
        default=".env",
        help="Archivo .env a cargar (default: .env). Ej: .env.dev, .env.test, .env.prod",
    )
    parser.add_argument(
        "--clear",
        action="store_true",
        help="Eliminar todos los agentes existentes antes de insertar (necesario al cambiar categorías)",
    )
    args = parser.parse_args()

    # Cargar variables de entorno desde el archivo especificado
    env_path = Path(__file__).resolve().parent.parent / args.env_file
    if not env_path.exists():
        print(f"Error: No se encontró el archivo de entorno: {env_path}")
        print("  Opciones disponibles: .env, .env.dev, .env.test, .env.prod")
        sys.exit(1)

    load_dotenv(env_path, override=True)
    print(f"Entorno cargado desde: {env_path.name}")

    mongodb_uri = os.getenv("MONGODB_URI")
    database_name = os.getenv("MONGODB_DB_NAME", "plataformaia")

    if not mongodb_uri:
        print(f"Error: MONGODB_URI debe estar configurado en {args.env_file}")
        sys.exit(1)

    print(f"MongoDB database: {database_name}")

    # Leer catálogo de agentes
    catalog_path = Path(__file__).resolve().parent.parent / "app" / "data" / "agents_catalog.json"
    if not catalog_path.exists():
        print(f"Error: No se encontró {catalog_path}")
        sys.exit(1)

    with open(catalog_path, "r", encoding="utf-8") as f:
        agents = json.load(f)

    print(f"Agentes encontrados en catálogo: {len(agents)}")

    # Conectar a MongoDB
    from pymongo import MongoClient

    client = MongoClient(mongodb_uri)
    collection = client[database_name]["agents"]
    print(f"Colección 'agents' lista en database '{database_name}'")

    # Limpiar si se solicita
    if args.clear:
        deleted = clear_collection(collection)
        print(f"  Eliminados {deleted} agentes existentes\n")

    # Upsert cada agente
    inserted = 0
    categorias = set()
    divisiones = set()

    for agent in agents:
        agent_id = slugify(agent["nombre"])
        agent["id"] = agent_id
        agent["_id"] = agent_id
        collection.replace_one({"_id": agent_id}, agent, upsert=True)
        inserted += 1
        categorias.add(agent.get("categoria", ""))
        divisiones.add(agent.get("division", ""))
        print(f"  [{inserted}/{len(agents)}] {agent_id} -> {agent['nombre']}")

    print(f"\n{'='*50}")
    print(f"Seed completado exitosamente!")
    print(f"  Agentes insertados/actualizados: {inserted}")
    print(f"  Categorías ({len(categorias)}):")
    for cat in sorted(categorias):
        print(f"    - {cat}")
    print(f"  Divisiones ({len(divisiones)}):")
    for div in sorted(divisiones):
        print(f"    - {div}")


if __name__ == "__main__":
    main()
