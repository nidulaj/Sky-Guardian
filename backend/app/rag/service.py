import time
import logging
from typing import List, Dict, Any, Optional
from collections import OrderedDict

from app.config import settings
from app.rag.schemas import (
    KnowledgeDocument,
    RetrievalQuery,
    RetrievalResponse,
    ScoredChunk,
    IngestionResult,
    RAGContext
)
from app.rag.chunking import DocumentChunker
from app.rag.embeddings.factory import get_embedding_provider
from app.rag.stores.factory import get_knowledge_store
from app.rag.trusted import TrustedDomainValidator
from app.rag.context import ContextBuilder
from app.rag.default_knowledge import get_default_aviation_documents

logger = logging.getLogger(__name__)

class RAGService:
    """
    Central RAG (Retrieval-Augmented Generation) Service.
    Orchestrates knowledge ingestion, document chunking, embedding generation,
    vector retrieval with metadata filtering, caching, and grounded context construction.
    """
    def __init__(
        self,
        embedding_provider=None,
        knowledge_store=None,
        chunker=None,
        domain_validator=None,
        context_builder=None
    ):
        self.chunker = chunker or DocumentChunker(
            chunk_size=settings.RAG_CHUNK_SIZE,
            chunk_overlap=settings.RAG_CHUNK_OVERLAP
        )
        self.domain_validator = domain_validator or TrustedDomainValidator()
        self.embedding_provider = embedding_provider or get_embedding_provider(
            provider_name=settings.EMBEDDING_PROVIDER,
            api_key=settings.LLM_API_KEY,
            model=settings.EMBEDDING_MODEL
        )
        self.store = knowledge_store or get_knowledge_store(
            backend_type=settings.KNOWLEDGE_STORE_BACKEND,
            db_url=settings.DATABASE_URL,
            embedding_provider=self.embedding_provider,
            chunker=self.chunker,
            domain_validator=self.domain_validator
        )
        self.context_builder = context_builder or ContextBuilder(
            max_context_chars=settings.RAG_MAX_CONTEXT_LENGTH
        )
        
        # Simple LRU Query Cache (query_cache_key -> List[ScoredChunk])
        self._query_cache: OrderedDict = OrderedDict()
        self._cache_capacity = settings.KNOWLEDGE_CACHE_SIZE
        self._cache_hits = 0
        self._cache_misses = 0
        self._initialized = False

    async def initialize(self):
        """Pre-populates verified default aviation documents if knowledge store is empty."""
        if self._initialized:
            return
        try:
            counts = await self.store.count()
            if counts.get("documents", 0) == 0:
                logger.info("Initializing RAG knowledge base with default aviation disruption policies...")
                default_docs = get_default_aviation_documents()
                await self.store.add_documents(default_docs)
                logger.info(f"RAG knowledge base initialized with {len(default_docs)} documents.")
            self._initialized = True
        except Exception as e:
            logger.error(f"Error during RAG initialization: {e}")

    def _make_cache_key(self, query: RetrievalQuery) -> str:
        return f"{query.query.strip().lower()}|{query.airline}|{query.airline_code}|{query.airport}|{query.policy_type}|{query.top_k}|{query.similarity_threshold}|{query.verified_only}"

    async def retrieve(self, query: RetrievalQuery) -> RetrievalResponse:
        start_time = time.perf_counter()
        
        if not settings.RAG_ENABLED:
            logger.info("RAG is disabled in configuration. Returning empty retrieval response.")
            return RetrievalResponse(
                query=query.query,
                results=[],
                total_results=0,
                latency_ms=round((time.perf_counter() - start_time) * 1000, 2),
                status="FALLBACK_APPLIED",
                warnings=["RAG retrieval is disabled in application settings."],
                trace_id=query.trace_id
            )

        # Ensure initialized
        if not self._initialized:
            await self.initialize()

        cache_key = self._make_cache_key(query)
        if cache_key in self._query_cache:
            self._cache_hits += 1
            # Move to end (most recently used)
            self._query_cache.move_to_end(cache_key)
            cached_results = self._query_cache[cache_key]
            latency = round((time.perf_counter() - start_time) * 1000, 2)
            return RetrievalResponse(
                query=query.query,
                results=cached_results,
                total_results=len(cached_results),
                latency_ms=latency,
                status="SUCCESS" if cached_results else "NO_RELEVANT_DOCUMENTS",
                trace_id=query.trace_id
            )

        self._cache_misses += 1

        try:
            # Generate query embedding
            query_embedding = await self.embedding_provider.embed_text(query.query)
            
            # Primary search with provided filters
            results = await self.store.search(query_embedding, query)
            status = "SUCCESS" if results else "NO_RELEVANT_DOCUMENTS"
            warnings = []

            # Agentic secondary search: if specific carrier returned no results, broaden search to general passenger rights regulations
            if not results and (query.airline or query.airline_code):
                logger.info(f"No specific policy match for airline {query.airline or query.airline_code}. Broadening search to general statutory passenger rights.")
                broadened_query = RetrievalQuery(
                    query=query.query,
                    top_k=query.top_k,
                    similarity_threshold=max(0.30, query.similarity_threshold - 0.10),
                    airline=None,
                    airline_code=None,
                    airport=query.airport,
                    policy_type="PASSENGER_RIGHTS_REGULATION",
                    verified_only=query.verified_only,
                    trace_id=query.trace_id
                )
                fallback_results = await self.store.search(query_embedding, broadened_query)
                if fallback_results:
                    results = fallback_results
                    status = "FALLBACK_APPLIED"
                    warnings.append(f"Specific carrier policy for {query.airline or query.airline_code} was not found; retrieved general statutory aviation consumer regulations.")

            # Store in cache
            if len(self._query_cache) >= self._cache_capacity:
                self._query_cache.popitem(last=False)
            self._query_cache[cache_key] = results

            latency = round((time.perf_counter() - start_time) * 1000, 2)
            return RetrievalResponse(
                query=query.query,
                results=results,
                total_results=len(results),
                latency_ms=latency,
                status=status,
                warnings=warnings,
                trace_id=query.trace_id
            )

        except Exception as e:
            logger.error(f"RAG retrieval failure: {e}", exc_info=True)
            latency = round((time.perf_counter() - start_time) * 1000, 2)
            return RetrievalResponse(
                query=query.query,
                results=[],
                total_results=0,
                latency_ms=latency,
                status="ERROR",
                warnings=[f"Retrieval error: {str(e)}"],
                trace_id=query.trace_id
            )

    def build_context(self, response: RetrievalResponse, max_chars: Optional[int] = None) -> RAGContext:
        return self.context_builder.build_context(response, max_chars=max_chars)

    async def ingest_document(self, doc: KnowledgeDocument) -> IngestionResult:
        # Invalidate query cache when knowledge base is updated
        self._query_cache.clear()
        results = await self.store.add_documents([doc])
        return results[0] if results else IngestionResult(doc_id=doc.doc_id, status="ERROR", message="No result returned")

    async def ingest_documents(self, docs: List[KnowledgeDocument]) -> List[IngestionResult]:
        self._query_cache.clear()
        return await self.store.add_documents(docs)

    async def get_document(self, doc_id: str) -> Optional[KnowledgeDocument]:
        if not self._initialized:
            await self.initialize()
        return await self.store.get_document(doc_id)

    async def list_documents(self) -> List[Dict[str, Any]]:
        if not self._initialized:
            await self.initialize()
        return await self.store.list_documents()

    async def delete_document(self, doc_id: str) -> bool:
        self._query_cache.clear()
        return await self.store.delete_document(doc_id)

    async def get_stats(self) -> Dict[str, Any]:
        if not self._initialized:
            await self.initialize()
        counts = await self.store.count()
        return {
            "rag_enabled": settings.RAG_ENABLED,
            "embedding_provider": settings.EMBEDDING_PROVIDER,
            "embedding_model": settings.EMBEDDING_MODEL,
            "store_backend": settings.KNOWLEDGE_STORE_BACKEND,
            "total_documents": counts.get("documents", 0),
            "total_chunks": counts.get("chunks", 0),
            "cache_size": len(self._query_cache),
            "cache_capacity": self._cache_capacity,
            "cache_hits": self._cache_hits,
            "cache_misses": self._cache_misses,
            "similarity_threshold": settings.RAG_SIMILARITY_THRESHOLD,
            "top_k": settings.RAG_TOP_K
        }

# Global singleton instance
rag_service = RAGService()
