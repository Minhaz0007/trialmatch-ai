"""ChromaDB ingestion utilities — called by scripts/seed_trials.py."""

import os
from pathlib import Path

import chromadb
from chromadb.config import Settings

CHROMA_PATH = Path(__file__).parent / "chroma_store"
COLLECTION_NAME = "clinical_trials"


def get_chroma_client() -> chromadb.PersistentClient:
    CHROMA_PATH.mkdir(parents=True, exist_ok=True)
    return chromadb.PersistentClient(path=str(CHROMA_PATH))


def get_or_create_collection(client: chromadb.PersistentClient):
    return client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )


def collection_count() -> int:
    try:
        client = get_chroma_client()
        col = client.get_or_create_collection(COLLECTION_NAME)
        return col.count()
    except Exception:
        return 0
