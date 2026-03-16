"""Qdrant vector database adapter."""

from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

from qdrant_client import QdrantClient
from qdrant_client.http import models

from app.infrastructure.config import settings


class QdrantAdapter:
    """Adapter for interacting with Qdrant vector database."""

    def __init__(self):
        # Use localhost as default URL
        self.client = QdrantClient(url=os.getenv("QDRANT_URL", "http://localhost:6333"))

    async def create_collection(self, collection_name: str, vector_size: int = 1536):
        """Create a new collection with the specified vector size."""
        self.client.recreate_collection(
            collection_name=collection_name,
            vectors_config=models.VectorParams(size=vector_size, distance=models.Distance.COSINE),
        )

    async def upsert_points(self, collection_name: str, points: List[Dict[str, Any]]):
        """Upsert points (embeddings + metadata) into a collection."""
        self.client.upsert(
            collection_name=collection_name,
            points=points
        )

    async def search(self,
        collection_name: str,
        query_vector: List[float],
        limit: int = 5,
        query_filter: Optional[Any] = None
    ) -> List[Any]:
        """Search for similar vectors in a collection."""
        return self.client.search(
            collection_name=collection_name,
            query_vector=query_vector,
            query_filter=query_filter,
            limit=limit
        )

qdrant_adapter = QdrantAdapter()
