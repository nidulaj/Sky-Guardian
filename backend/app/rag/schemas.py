from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Literal
from datetime import datetime, timezone

def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

class KnowledgeMetadata(BaseModel):
    doc_id: str
    chunk_id: str
    title: str
    airline: Optional[str] = None
    airline_code: Optional[str] = None
    airport: Optional[str] = None
    policy_type: str = "CARRIER_CONDITIONS_OF_CARRIAGE"
    source_url: str = ""
    effective_date: str = "2025-01-01"
    last_verified: str = Field(default_factory=utc_now_iso)
    verified: bool = True
    jurisdiction: Optional[str] = None
    section: Optional[str] = None
    chunk_index: int = 0
    total_chunks: int = 1
    content_hash: str = ""
    extra: Dict[str, Any] = Field(default_factory=dict)

class KnowledgeDocument(BaseModel):
    doc_id: str
    title: str
    content: str
    airline: Optional[str] = None
    airline_code: Optional[str] = None
    airport: Optional[str] = None
    policy_type: str = "CARRIER_CONDITIONS_OF_CARRIAGE"
    source_url: str = ""
    effective_date: str = "2025-01-01"
    jurisdiction: Optional[str] = None
    verified: bool = True
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: str = Field(default_factory=utc_now_iso)
    updated_at: str = Field(default_factory=utc_now_iso)

class DocumentChunk(BaseModel):
    chunk_id: str
    doc_id: str
    content: str
    embedding: Optional[List[float]] = None
    metadata: KnowledgeMetadata

class RetrievalQuery(BaseModel):
    query: str
    top_k: int = 3
    similarity_threshold: float = 0.40
    airline: Optional[str] = None
    airline_code: Optional[str] = None
    airport: Optional[str] = None
    policy_type: Optional[str] = None
    verified_only: bool = True
    trace_id: Optional[str] = None

class ScoredChunk(BaseModel):
    chunk: DocumentChunk
    score: float
    confidence: Literal["high", "medium", "low"] = "high"

class RetrievalResponse(BaseModel):
    query: str
    results: List[ScoredChunk] = []
    total_results: int = 0
    latency_ms: float = 0.0
    status: Literal["SUCCESS", "NO_RELEVANT_DOCUMENTS", "FALLBACK_APPLIED", "ERROR"] = "SUCCESS"
    warnings: List[str] = []
    trace_id: Optional[str] = None

class IngestionResult(BaseModel):
    doc_id: str
    status: Literal["INGESTED", "UPDATED", "SKIPPED_DUPLICATE", "ERROR"]
    chunks_created: int = 0
    message: str = ""

class RAGContext(BaseModel):
    context_text: str
    sources: List[Dict[str, Any]] = []
    total_tokens_approx: int = 0
    retrieved_chunks_count: int = 0
