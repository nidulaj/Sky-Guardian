import math
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
from app.rag.chunking import DocumentChunker
from app.rag.embeddings.base import BaseEmbeddingProvider
from app.rag.trusted import TrustedDomainValidator

logger = logging.getLogger(__name__)

class InMemoryVectorStore(BaseKnowledgeStore):
    """
    In-memory vector store with cosine similarity search, metadata filtering,
    document hashing for deduplication and updates, and domain allowlist filtering.
    """
    def __init__(
        self,
        embedding_provider: BaseEmbeddingProvider,
        chunker: Optional[DocumentChunker] = None,
        domain_validator: Optional[TrustedDomainValidator] = None
    ):
        self.embedding_provider = embedding_provider
        self.chunker = chunker or DocumentChunker()
        self.domain_validator = domain_validator or TrustedDomainValidator()
        
        self._documents: Dict[str, KnowledgeDocument] = {}
        self._chunks: Dict[str, DocumentChunk] = {}
        self._doc_hashes: Dict[str, str] = {}

    @staticmethod
    def _cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
        if not vec1 or not vec2 or len(vec1) != len(vec2):
            return 0.0
        dot = sum(a * b for a, b in zip(vec1, vec2))
        norm1 = math.sqrt(sum(a * a for a, b in zip(vec1, vec2)))
        norm2 = math.sqrt(sum(b * b for a, b in zip(vec1, vec2)))
        if norm1 < 1e-9 or norm2 < 1e-9:
            return 0.0
        return dot / (norm1 * norm2)

    async def add_documents(self, documents: List[KnowledgeDocument]) -> List[IngestionResult]:
        results: List[IngestionResult] = []

        for doc in documents:
            new_hash = DocumentChunker.compute_hash(doc.content)

            is_update = doc.doc_id in self._documents
            if is_update:
                old_hash = self._doc_hashes.get(doc.doc_id)
                if old_hash == new_hash:
                    # Content unchanged, skip duplicate
                    results.append(IngestionResult(
                        doc_id=doc.doc_id,
                        status="SKIPPED_DUPLICATE",
                        chunks_created=0,
                        message="Document with identical content hash already exists."
                    ))
                    continue
                else:
                    # Content changed, delete existing chunks first
                    await self.delete_document(doc.doc_id)

            # Validate domain trust
            if doc.source_url and not self.domain_validator.is_trusted(doc.source_url):
                logger.warning(f"Document {doc.doc_id} source {doc.source_url} is not in trusted domain list.")
                doc.verified = False

            # Chunk document
            chunks = self.chunker.chunk_document(doc)
            if not chunks:
                results.append(IngestionResult(
                    doc_id=doc.doc_id,
                    status="ERROR",
                    chunks_created=0,
                    message="Document content yielded 0 chunks."
                ))
                continue

            # Embed chunks in batch
            texts = [c.content for c in chunks]
            try:
                embeddings = await self.embedding_provider.embed_batch(texts)
                for chunk, emb in zip(chunks, embeddings):
                    chunk.embedding = emb
                    self._chunks[chunk.chunk_id] = chunk
            except Exception as e:
                logger.error(f"Failed to embed chunks for doc {doc.doc_id}: {e}")
                results.append(IngestionResult(
                    doc_id=doc.doc_id,
                    status="ERROR",
                    chunks_created=0,
                    message=f"Embedding error: {str(e)}"
                ))
                continue

            self._documents[doc.doc_id] = doc
            self._doc_hashes[doc.doc_id] = new_hash

            status = "UPDATED" if is_update else "INGESTED"
            results.append(IngestionResult(
                doc_id=doc.doc_id,
                status=status,
                chunks_created=len(chunks),
                message=f"Successfully ingested {len(chunks)} chunks."
            ))

        return results

    async def add_chunks(self, chunks: List[DocumentChunk]) -> int:
        count = 0
        for c in chunks:
            if not c.embedding:
                c.embedding = await self.embedding_provider.embed_text(c.content)
            self._chunks[c.chunk_id] = c
            count += 1
        return count

    def _matches_filters(self, chunk: DocumentChunk, query: RetrievalQuery) -> bool:
        meta = chunk.metadata

        # Verified only
        if query.verified_only and not meta.verified:
            return False

        # Domain trust check if verified only
        if query.verified_only and meta.source_url:
            if not self.domain_validator.is_trusted(meta.source_url):
                return False

        # Airline filter (matches airline name or code)
        if query.airline or query.airline_code:
            target_airline = (query.airline or "").lower()
            target_code = (query.airline_code or "").lower()
            
            chunk_airline = (meta.airline or "").lower()
            chunk_code = (meta.airline_code or "").lower()

            airline_match = False
            if target_airline and (target_airline in chunk_airline or chunk_airline in target_airline):
                airline_match = True
            if target_code and (target_code == chunk_code):
                airline_match = True
            
            # Allow general passenger rights regulations if airline-specific filter is applied
            if not airline_match and meta.policy_type in ["PASSENGER_RIGHTS_REGULATION", "GENERAL_ADVISORY"]:
                airline_match = True

            if not airline_match:
                return False

        # Airport filter
        if query.airport:
            target_airport = query.airport.upper()
            chunk_airport = (meta.airport or "").upper()
            if chunk_airport and chunk_airport != target_airport:
                return False

        # Policy type filter
        if query.policy_type:
            if meta.policy_type.lower() != query.policy_type.lower():
                return False

        return True

    async def search(self, query_embedding: List[float], query: RetrievalQuery) -> List[ScoredChunk]:
        scored_candidates: List[ScoredChunk] = []

        for chunk in self._chunks.values():
            if not self._matches_filters(chunk, query):
                continue

            if not chunk.embedding:
                continue

            sim = self._cosine_similarity(query_embedding, chunk.embedding)
            if sim >= query.similarity_threshold:
                confidence = "high" if sim >= 0.70 else ("medium" if sim >= 0.50 else "low")
                scored_candidates.append(ScoredChunk(
                    chunk=chunk,
                    score=round(sim, 4),
                    confidence=confidence
                ))

        # Sort descending by score
        scored_candidates.sort(key=lambda x: x.score, reverse=True)
        return scored_candidates[:query.top_k]

    async def get_document(self, doc_id: str) -> Optional[KnowledgeDocument]:
        return self._documents.get(doc_id)

    async def list_documents(self) -> List[Dict[str, Any]]:
        result = []
        for doc in self._documents.values():
            chunk_count = sum(1 for c in self._chunks.values() if c.doc_id == doc.doc_id)
            result.append({
                "doc_id": doc.doc_id,
                "title": doc.title,
                "airline": doc.airline,
                "airline_code": doc.airline_code,
                "airport": doc.airport,
                "policy_type": doc.policy_type,
                "source_url": doc.source_url,
                "verified": doc.verified,
                "chunks_count": chunk_count,
                "updated_at": doc.updated_at
            })
        return result

    async def delete_document(self, doc_id: str) -> bool:
        if doc_id not in self._documents:
            return False
        del self._documents[doc_id]
        if doc_id in self._doc_hashes:
            del self._doc_hashes[doc_id]
        
        # Remove corresponding chunks
        chunk_keys_to_del = [cid for cid, chunk in self._chunks.items() if chunk.doc_id == doc_id]
        for cid in chunk_keys_to_del:
            del self._chunks[cid]
        return True

    async def count(self) -> Dict[str, int]:
        return {
            "documents": len(self._documents),
            "chunks": len(self._chunks)
        }

    async def clear(self) -> None:
        self._documents.clear()
        self._chunks.clear()
        self._doc_hashes.clear()
