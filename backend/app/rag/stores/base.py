from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from app.rag.schemas import (
    KnowledgeDocument,
    DocumentChunk,
    RetrievalQuery,
    ScoredChunk,
    IngestionResult
)

class BaseKnowledgeStore(ABC):
    """
    Abstract interface for Knowledge and Vector Storage backends.
    """
    @abstractmethod
    async def add_documents(self, documents: List[KnowledgeDocument]) -> List[IngestionResult]:
        """Ingests, chunks, embeds, and stores documents."""
        pass

    @abstractmethod
    async def add_chunks(self, chunks: List[DocumentChunk]) -> int:
        """Stores pre-embedded chunks directly."""
        pass

    @abstractmethod
    async def search(self, query_embedding: List[float], query: RetrievalQuery) -> List[ScoredChunk]:
        """Performs vector similarity search with metadata filtering."""
        pass

    @abstractmethod
    async def get_document(self, doc_id: str) -> Optional[KnowledgeDocument]:
        """Retrieves a document by its ID."""
        pass

    @abstractmethod
    async def list_documents(self) -> List[Dict[str, Any]]:
        """Lists summaries of all stored documents."""
        pass

    @abstractmethod
    async def delete_document(self, doc_id: str) -> bool:
        """Deletes a document and all its corresponding chunks."""
        pass

    @abstractmethod
    async def count(self) -> Dict[str, int]:
        """Returns counts of documents and chunks."""
        pass

    @abstractmethod
    async def clear(self) -> None:
        """Clears all stored knowledge."""
        pass
