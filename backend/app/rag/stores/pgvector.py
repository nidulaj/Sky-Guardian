import asyncio
import logging
from collections import Counter
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

from app.config import settings
from app.rag.schemas import (
    KnowledgeDocument,
    DocumentChunk,
    RetrievalQuery,
    ScoredChunk,
    IngestionResult,
    KnowledgeMetadata
)
from app.rag.stores.base import BaseKnowledgeStore
from app.rag.stores.memory import InMemoryVectorStore
from app.rag.chunking import DocumentChunker
from app.rag.embeddings.base import BaseEmbeddingProvider
from app.rag.trusted import TrustedDomainValidator

logger = logging.getLogger(__name__)

class PgVectorStore(BaseKnowledgeStore):
    """
    PostgreSQL + pgvector knowledge store adapter powered by Supabase.
    Stores raw document records in 'rag_documents' and vector chunks in 'rag_chunks'.
    Performs cosine similarity searches using the 'match_rag_chunks' stored procedure.
    Seamlessly falls back to InMemoryVectorStore if Supabase is offline or unconfigured.
    """
    def __init__(
        self,
        db_url: Optional[str] = None,
        embedding_provider: Optional[BaseEmbeddingProvider] = None,
        chunker: Optional[DocumentChunker] = None,
        domain_validator: Optional[TrustedDomainValidator] = None
    ):
        self.db_url = db_url or settings.DATABASE_URL
        self.embedding_provider = embedding_provider
        self.chunker = chunker or DocumentChunker(
            chunk_size=settings.RAG_CHUNK_SIZE,
            chunk_overlap=settings.RAG_CHUNK_OVERLAP
        )
        self.domain_validator = domain_validator or TrustedDomainValidator()
        
        # In-memory fallback
        self._memory_fallback = InMemoryVectorStore(
            embedding_provider=self.embedding_provider,
            chunker=self.chunker,
            domain_validator=self.domain_validator
        )
        self._supabase = None
        self._is_connected = False
        self._init_client()

    def _init_client(self):
        try:
            supabase_url = settings.clean_supabase_url
            supabase_key = settings.SUPABASE_SERVICE_ROLE_KEY
            if supabase_url and supabase_key:
                from supabase import create_client
                self._supabase = create_client(supabase_url, supabase_key)
                # Quick health check
                self._supabase.table("rag_documents").select("id").limit(1).execute()
                self._is_connected = True
                logger.info("PgVectorStore successfully connected to Supabase pgvector.")
            else:
                logger.info("PgVectorStore: Supabase credentials not set. Using in-memory fallback.")
                self._is_connected = False
        except Exception as e:
            logger.warning(f"PgVectorStore: Failed to connect to Supabase ({e}). Using in-memory fallback.")
            self._is_connected = False

    async def add_documents(self, documents: List[KnowledgeDocument]) -> List[IngestionResult]:
        if not self._is_connected:
            return await self._memory_fallback.add_documents(documents)

        results: List[IngestionResult] = []

        for doc in documents:
            try:
                # 1. Validate domain trust
                if doc.source_url and not self.domain_validator.is_trusted(doc.source_url):
                    logger.warning(f"Document {doc.doc_id} source {doc.source_url} is not in trusted domain list.")
                    doc.verified = False

                # 2. Upsert document record in rag_documents
                now_iso = datetime.now(timezone.utc).isoformat()
                doc_payload = {
                    "id": doc.doc_id,
                    "title": doc.title,
                    "airline": doc.airline,
                    "airline_code": doc.airline_code,
                    "airport": doc.airport,
                    "policy_type": doc.policy_type,
                    "source_url": doc.source_url,
                    "storage_path": doc.metadata.get("storage_path"),
                    "file_name": doc.metadata.get("file_name"),
                    "mime_type": doc.metadata.get("mime_type"),
                    "verified": doc.verified,
                    "metadata": doc.metadata,
                    "updated_at": now_iso
                }
                self._supabase.table("rag_documents").upsert(doc_payload).execute()

                # 3. Chunk document
                chunks = self.chunker.chunk_document(doc)

                # 4. Generate embeddings and upsert chunks in rag_chunks
                chunk_records = []
                for chunk in chunks:
                    if not chunk.embedding and self.embedding_provider:
                        chunk.embedding = await self.embedding_provider.embed_text(chunk.content)
                    
                    chunk_records.append({
                        "id": chunk.chunk_id,
                        "document_id": doc.doc_id,
                        "chunk_index": chunk.metadata.chunk_index,
                        "content": chunk.content,
                        "metadata": chunk.metadata.model_dump(),
                        "embedding": chunk.embedding
                    })

                if chunk_records:
                    self._supabase.table("rag_chunks").upsert(chunk_records).execute()

                results.append(IngestionResult(
                    doc_id=doc.doc_id,
                    status="INGESTED",
                    chunks_created=len(chunks),
                    message=f"Successfully ingested {len(chunks)} chunks into Supabase pgvector."
                ))
            except Exception as e:
                logger.error(f"Error ingesting doc {doc.doc_id} to Supabase: {e}")
                results.append(IngestionResult(
                    doc_id=doc.doc_id,
                    status="ERROR",
                    chunks_created=0,
                    message=str(e)
                ))

        return results

    async def add_chunks(self, chunks: List[DocumentChunk]) -> int:
        if not self._is_connected:
            return await self._memory_fallback.add_chunks(chunks)

        chunk_records = []
        for chunk in chunks:
            if not chunk.embedding and self.embedding_provider:
                chunk.embedding = await self.embedding_provider.embed_text(chunk.content)
            chunk_records.append({
                "id": chunk.chunk_id,
                "document_id": chunk.doc_id,
                "chunk_index": chunk.metadata.chunk_index,
                "content": chunk.content,
                "metadata": chunk.metadata.model_dump(),
                "embedding": chunk.embedding
            })

        if chunk_records:
            self._supabase.table("rag_chunks").upsert(chunk_records).execute()
        return len(chunk_records)

    async def search(self, query_embedding: List[float], query: RetrievalQuery) -> List[ScoredChunk]:
        if not self._is_connected:
            return await self._memory_fallback.search(query_embedding, query)

        try:
            params = {
                "query_embedding": query_embedding,
                "match_threshold": query.similarity_threshold,
                "match_count": query.top_k,
                "filter_airline": query.airline,
                "filter_airline_code": query.airline_code if not query.airline else None,
                "filter_airport": query.airport,
                "filter_policy_type": query.policy_type
            }

            resp = self._supabase.rpc("match_rag_chunks", params).execute()
            rows = resp.data or []

            scored_candidates: List[ScoredChunk] = []
            for row in rows:
                sim = float(row.get("similarity", 0.0))
                meta_dict = row.get("metadata") or {}
                
                # Check verified_only filter
                if query.verified_only:
                    if not meta_dict.get("verified", True):
                        continue
                    src = meta_dict.get("source_url")
                    if src and not self.domain_validator.is_trusted(src):
                        continue

                metadata = KnowledgeMetadata(**meta_dict)
                chunk = DocumentChunk(
                    chunk_id=row.get("chunk_id"),
                    doc_id=row.get("document_id"),
                    content=row.get("content", ""),
                    metadata=metadata
                )

                confidence = "high" if sim >= 0.70 else ("medium" if sim >= 0.50 else "low")
                scored_candidates.append(ScoredChunk(
                    chunk=chunk,
                    score=round(sim, 4),
                    confidence=confidence
                ))

            scored_candidates.sort(key=lambda x: x.score, reverse=True)
            return scored_candidates[:query.top_k]
        except Exception as e:
            logger.error(f"Supabase pgvector search error: {e}. Falling back to memory store.")
            return await self._memory_fallback.search(query_embedding, query)

    async def get_document(self, doc_id: str) -> Optional[KnowledgeDocument]:
        if not self._is_connected:
            return await self._memory_fallback.get_document(doc_id)

        try:
            res = self._supabase.table("rag_documents").select("*").eq("id", doc_id).execute()
            if not res.data:
                return None
            row = res.data[0]
            
            # Fetch chunks to reconstruct full content if needed
            chunk_res = self._supabase.table("rag_chunks").select("content").eq("document_id", doc_id).order("chunk_index").execute()
            content = "\n\n".join([c["content"] for c in chunk_res.data]) if chunk_res.data else ""

            return KnowledgeDocument(
                doc_id=row["id"],
                title=row.get("title", ""),
                airline=row.get("airline"),
                airline_code=row.get("airline_code"),
                airport=row.get("airport"),
                policy_type=row.get("policy_type") or "CARRIER_CONDITIONS_OF_CARRIAGE",
                source_url=row.get("source_url") or "",
                verified=row.get("verified", True),
                metadata=row.get("metadata") or {},
                content=content,
                created_at=row.get("created_at") or "",
                updated_at=row.get("updated_at") or ""
            )
        except Exception as e:
            logger.error(f"Error fetching document {doc_id} from Supabase: {e}")
            return await self._memory_fallback.get_document(doc_id)

    async def list_documents(self) -> List[Dict[str, Any]]:
        if not self._is_connected:
            return await self._memory_fallback.list_documents()

        def _sync_list():
            res = self._supabase.table("rag_documents").select("*").order("created_at", desc=True).execute()
            rows = res.data or []
            if not rows:
                return []

            # Batch query chunk counts across all documents in a single fast query
            # instead of running N sequential network round-trips!
            chunk_counts = Counter()
            try:
                chunk_res = self._supabase.table("rag_chunks").select("document_id").execute()
                for c in (chunk_res.data or []):
                    did = c.get("document_id")
                    if did:
                        chunk_counts[did] += 1
            except Exception as ce:
                logger.warning(f"Batch chunk counting failed: {ce}")

            docs = []
            for row in rows:
                doc_id = row["id"]
                docs.append({
                    "doc_id": doc_id,
                    "title": row.get("title"),
                    "airline": row.get("airline"),
                    "airline_code": row.get("airline_code"),
                    "airport": row.get("airport"),
                    "policy_type": row.get("policy_type"),
                    "source_url": row.get("source_url"),
                    "storage_path": row.get("storage_path"),
                    "file_name": row.get("file_name"),
                    "mime_type": row.get("mime_type"),
                    "verified": row.get("verified", True),
                    "total_chunks": chunk_counts.get(doc_id, 0),
                    "created_at": row.get("created_at"),
                    "updated_at": row.get("updated_at")
                })
            return docs

        try:
            return await asyncio.to_thread(_sync_list)
        except Exception as e:
            logger.error(f"Error listing documents from Supabase: {e}")
            return await self._memory_fallback.list_documents()

    async def delete_document(self, doc_id: str) -> bool:
        if not self._is_connected:
            return await self._memory_fallback.delete_document(doc_id)

        def _sync_delete():
            # 1. Clean up file from storage bucket if present
            try:
                doc_res = self._supabase.table("rag_documents").select("storage_path").eq("id", doc_id).execute()
                if doc_res.data and doc_res.data[0].get("storage_path"):
                    storage_path = doc_res.data[0]["storage_path"]
                    try:
                        self._supabase.storage.from_(settings.SUPABASE_STORAGE_BUCKET).remove([storage_path])
                    except Exception as se:
                        logger.warning(f"Could not delete storage file {storage_path}: {se}")
            except Exception as e:
                logger.warning(f"Error checking storage_path for {doc_id}: {e}")

            # 2. Explicitly delete vector chunks for fast, reliable cleanup
            try:
                self._supabase.table("rag_chunks").delete().eq("document_id", doc_id).execute()
            except Exception as ce:
                logger.warning(f"Could not delete chunks for document {doc_id}: {ce}")

            # 3. Delete document record (also triggers cascade if configured)
            self._supabase.table("rag_documents").delete().eq("id", doc_id).execute()
            return True

        try:
            result = await asyncio.to_thread(_sync_delete)
            # Ensure memory fallback cache is also purged
            await self._memory_fallback.delete_document(doc_id)
            return result
        except Exception as e:
            logger.error(f"Error deleting document {doc_id} from Supabase: {e}")
            return await self._memory_fallback.delete_document(doc_id)

    async def count(self) -> Dict[str, int]:
        if not self._is_connected:
            return await self._memory_fallback.count()

        def _sync_count():
            docs_res = self._supabase.table("rag_documents").select("id", count="exact").execute()
            chunks_res = self._supabase.table("rag_chunks").select("id", count="exact").execute()
            return {
                "documents": docs_res.count if docs_res.count is not None else len(docs_res.data or []),
                "chunks": chunks_res.count if chunks_res.count is not None else len(chunks_res.data or [])
            }

        try:
            return await asyncio.to_thread(_sync_count)
        except Exception as e:
            logger.error(f"Error getting count from Supabase: {e}")
            return await self._memory_fallback.count()

    async def clear(self) -> None:
        if not self._is_connected:
            await self._memory_fallback.clear()
            return

        try:
            self._supabase.table("rag_chunks").delete().neq("id", "0").execute()
            self._supabase.table("rag_documents").delete().neq("id", "0").execute()
        except Exception as e:
            logger.error(f"Error clearing Supabase tables: {e}")
            await self._memory_fallback.clear()
