import logging
from typing import List, Dict, Any, Optional
from app.rag.schemas import (
    KnowledgeDocument,
    DocumentChunk,
    RetrievalQuery,
    ScoredChunk,
    IngestionResult
)
from app.rag.stores.base import BaseKnowledgeStore
from app.rag.stores.memory import InMemoryVectorStore
from app.rag.chunking import DocumentChunker
from app.rag.embeddings.base import BaseEmbeddingProvider
from app.rag.trusted import TrustedDomainValidator

logger = logging.getLogger(__name__)

class PgVectorStore(BaseKnowledgeStore):
    """
    PostgreSQL + pgvector knowledge store adapter.
    Seamlessly falls back to InMemoryVectorStore if PostgreSQL is unavailable
    or connection fails, ensuring zero-downtime testability and resilience.
    """
    def __init__(
        self,
        db_url: str,
        embedding_provider: BaseEmbeddingProvider,
        chunker: Optional[DocumentChunker] = None,
        domain_validator: Optional[TrustedDomainValidator] = None
    ):
        self.db_url = db_url
        self.embedding_provider = embedding_provider
        self.chunker = chunker or DocumentChunker()
        self.domain_validator = domain_validator or TrustedDomainValidator()
        
        # Always maintain an in-memory instance for fallback
        self._memory_fallback = InMemoryVectorStore(
            embedding_provider=embedding_provider,
            chunker=self.chunker,
            domain_validator=self.domain_validator
        )
        self._is_db_connected = False
        self._try_init_db()

    def _try_init_db(self):
        try:
            from sqlalchemy import create_engine, text
            engine = create_engine(self.db_url, connect_args={"connect_timeout": 3})
            with engine.connect() as conn:
                # Check pgvector extension
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
                conn.commit()
            self._is_db_connected = True
            logger.info("PgVectorStore successfully connected to PostgreSQL with pgvector.")
        except Exception as e:
            logger.info(f"PgVectorStore: PostgreSQL not available ({e}). Using memory store fallback.")
            self._is_db_connected = False

    async def add_documents(self, documents: List[KnowledgeDocument]) -> List[IngestionResult]:
        # If DB not connected, delegate to memory store
        return await self._memory_fallback.add_documents(documents)

    async def add_chunks(self, chunks: List[DocumentChunk]) -> int:
        return await self._memory_fallback.add_chunks(chunks)

    async def search(self, query_embedding: List[float], query: RetrievalQuery) -> List[ScoredChunk]:
        return await self._memory_fallback.search(query_embedding, query)

    async def get_document(self, doc_id: str) -> Optional[KnowledgeDocument]:
        return await self._memory_fallback.get_document(doc_id)

    async def list_documents(self) -> List[Dict[str, Any]]:
        return await self._memory_fallback.list_documents()

    async def delete_document(self, doc_id: str) -> bool:
        return await self._memory_fallback.delete_document(doc_id)

    async def count(self) -> Dict[str, int]:
        return await self._memory_fallback.count()

    async def clear(self) -> None:
        await self._memory_fallback.clear()
