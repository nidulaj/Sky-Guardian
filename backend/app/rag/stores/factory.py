from typing import Optional
from app.rag.stores.base import BaseKnowledgeStore
from app.rag.stores.memory import InMemoryVectorStore
from app.rag.stores.pgvector import PgVectorStore
from app.rag.embeddings.base import BaseEmbeddingProvider
from app.rag.chunking import DocumentChunker
from app.rag.trusted import TrustedDomainValidator

def get_knowledge_store(
    backend_type: str = "memory",
    db_url: Optional[str] = None,
    embedding_provider: Optional[BaseEmbeddingProvider] = None,
    chunker: Optional[DocumentChunker] = None,
    domain_validator: Optional[TrustedDomainValidator] = None
) -> BaseKnowledgeStore:
    """
    Factory to instantiate knowledge store based on configured backend type.
    """
    backend_lower = (backend_type or "memory").lower().strip()
    if backend_lower == "pgvector" and db_url:
        return PgVectorStore(
            db_url=db_url,
            embedding_provider=embedding_provider,
            chunker=chunker,
            domain_validator=domain_validator
        )
    return InMemoryVectorStore(
        embedding_provider=embedding_provider,
        chunker=chunker,
        domain_validator=domain_validator
    )
