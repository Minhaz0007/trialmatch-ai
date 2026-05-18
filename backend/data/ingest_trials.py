"""ChromaDB ingestion utilities."""

from pathlib import Path

import chromadb
from chromadb.utils.embedding_functions import DefaultEmbeddingFunction

CHROMA_PATH = Path(__file__).parent / "chroma_store"
COLLECTION_NAME = "clinical_trials"

# Shared embedding function — all-MiniLM-L6-v2 via ONNX, runs on the server, no API key
_ef = DefaultEmbeddingFunction()


def get_chroma_client() -> chromadb.PersistentClient:
    CHROMA_PATH.mkdir(parents=True, exist_ok=True)
    return chromadb.PersistentClient(path=str(CHROMA_PATH))


def get_or_create_collection(client: chromadb.PersistentClient):
    return client.get_or_create_collection(
        name=COLLECTION_NAME,
        embedding_function=_ef,
        metadata={"hnsw:space": "cosine"},
    )


def collection_count() -> int:
    try:
        client = get_chroma_client()
        col = get_or_create_collection(client)
        return col.count()
    except Exception:
        return 0
