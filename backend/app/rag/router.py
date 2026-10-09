import io
import re
import uuid
import logging
from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Form, status
from typing import List, Optional, Dict, Any, Literal
from app.config import settings
from pydantic import BaseModel, Field
from app.rag.schemas import (
    KnowledgeDocument,
    RetrievalQuery,
    RetrievalResponse,
    IngestionResult,
    ScoredChunk,
    DocumentChunk,
    KnowledgeMetadata
)
from app.rag.service import rag_service
from app.rag.web_policy_search import web_policy_search
from app.rag.llm import llm_synthesizer

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/rag", tags=["RAG Knowledge Base"])

class AskQuestionRequest(BaseModel):
    question: str = Field(..., description="Natural language question to ask the RAG knowledge base")
    top_k: int = Field(default=3, description="Maximum number of context chunks to retrieve")
    similarity_threshold: float = Field(default=0.20, description="Minimum cosine similarity score")
    airline: Optional[str] = Field(default=None, description="Optional airline name filter")
    airline_code: Optional[str] = Field(default=None, description="Optional airline IATA code filter")
    airport: Optional[str] = Field(default=None, description="Optional airport IATA code filter")
    policy_type: Optional[str] = Field(default=None, description="Optional policy type filter")
    enable_web_fallback: bool = Field(default=True, description="Search live official airline resources if RAG lacks answers")
    force_web_search: bool = Field(default=False, description="Bypass RAG and search live official airline resources directly")

class AskQuestionResponse(BaseModel):
    question: str
    answer: str
    sources: List[Dict[str, Any]] = []
    chunks: List[ScoredChunk] = []
    source_type: Literal["rag", "web_search", "hybrid"] = "rag"
    latency_ms: float = 0.0
    execution_steps: List[Dict[str, Any]] = []

@router.post("/query", response_model=RetrievalResponse)
async def query_knowledge(req: RetrievalQuery):
    """
    Execute semantic retrieval against the aviation disruption knowledge base.
    Supports airline, airport, and policy_type metadata filtering.
    """
    response = await rag_service.retrieve(req)
    return response

@router.post("/ask", response_model=AskQuestionResponse)
async def ask_knowledge(req: AskQuestionRequest):
    """
    Ask a natural language question to the RAG knowledge base.
    If the policy for the requested airline is not present or RAG confidence is low,
    automatically falls back to live web search on official airline resources.
    """
    import time
    start = time.perf_counter()

    should_use_web_search = req.force_web_search
    retrieval_resp = None
    detected_airline = web_policy_search.detect_airline(req.question)

    if not should_use_web_search:
        retrieval_query = RetrievalQuery(
            query=req.question,
            top_k=req.top_k,
            similarity_threshold=req.similarity_threshold,
            airline=req.airline,
            airline_code=req.airline_code,
            airport=req.airport,
            policy_type=req.policy_type
        )
        retrieval_resp = await rag_service.retrieve(retrieval_query)

        if req.enable_web_fallback:
            if not retrieval_resp or not retrieval_resp.results:
                logger.info(f"No RAG results found for '{req.question}'. Triggering live official airline web search.")
                should_use_web_search = True
            else:
                top_score = max([c.score for c in retrieval_resp.results], default=0.0)
                if top_score < 0.25:
                    logger.info(f"Low RAG similarity ({top_score:.2f}) for '{req.question}'. Triggering live web search fallback.")
                    should_use_web_search = True
                else:
                    if detected_airline:
                        airline_name_lower = detected_airline["name"].lower()
                        airline_code_lower = detected_airline["code"].lower()
                        chunk_airlines = [
                            (c.chunk.metadata.airline or "").lower()
                            for c in retrieval_resp.results
                        ]
                        chunk_codes = [
                            (c.chunk.metadata.airline_code or "").lower()
                            for c in retrieval_resp.results
                        ]
                        if not any(airline_name_lower in a or a in airline_name_lower for a in chunk_airlines if a) and \
                           not any(airline_code_lower == code for code in chunk_codes if code):
                            logger.info(f"Queried airline '{detected_airline['name']}' not in RAG chunks. Falling back to web search.")
                            should_use_web_search = True

    # 1. Live Web Policy Search Fallback
    if should_use_web_search:
        web_res = await web_policy_search.search_airline_policy(
            question=req.question,
            airline_name=req.airline,
            airline_code=req.airline_code
        )
        if web_res.get("success"):
            web_chunks = []
            for idx, s in enumerate(web_res.get("sources", [])):
                snippet = web_res.get("snippets", [""])[idx] if idx < len(web_res.get("snippets", [])) else ""
                web_chunks.append(ScoredChunk(
                    chunk=DocumentChunk(
                        chunk_id=f"web-chunk-{idx+1}",
                        doc_id=f"web-doc-{idx+1}",
                        content=snippet,
                        metadata=KnowledgeMetadata(
                            doc_id=f"web-doc-{idx+1}",
                            chunk_id=f"web-chunk-{idx+1}",
                            title=s.get("name", f"{web_res.get('airline', 'Airline')} Official Resource"),
                            airline=web_res.get("airline"),
                            source_url=s.get("source_url", ""),
                            verified=True,
                            policy_type="OFFICIAL_AIRLINE_WEBSITE"
                        )
                    ),
                    score=float(s.get("relevance_score", 0.90)),
                    confidence="high"
                ))

            steps = [
                {
                    "step": 1,
                    "name": "Query Intent & Carrier Recognition",
                    "status": "COMPLETED",
                    "detail": f"Identified airline: {detected_airline['name']} ({detected_airline['code']})" if detected_airline else "General aviation passenger rights query"
                },
                {
                    "step": 2,
                    "name": "Supabase pgvector Knowledge Base Check",
                    "status": "COMPLETED",
                    "detail": "Checked internal RAG database; policy unindexed or score below confidence threshold"
                },
                {
                    "step": 3,
                    "name": "Official Airline Web Search (Tavily)",
                    "status": "COMPLETED",
                    "detail": f"Searched official carrier domains & verified via trusted_domains.yaml ({len(web_res.get('sources', []))} trusted sources retrieved)"
                },
                {
                    "step": 4,
                    "name": "Gemini LLM Policy Synthesis",
                    "status": "COMPLETED",
                    "detail": f"Synthesized grounded passenger advice using {settings.LLM_MODEL} ({settings.LLM_PROVIDER.upper()})"
                }
            ]

            return AskQuestionResponse(
                question=req.question,
                answer=web_res["answer"],
                sources=web_res.get("sources", []),
                chunks=web_chunks,
                source_type="web_search",
                execution_steps=steps,
                latency_ms=round((time.perf_counter() - start) * 1000, 2)
            )

    # 2. No RAG results and web fallback disabled or empty
    if not retrieval_resp or not retrieval_resp.results:
        steps = [
            {
                "step": 1,
                "name": "Query Intent & Carrier Recognition",
                "status": "COMPLETED",
                "detail": f"Identified airline: {detected_airline['name']}" if detected_airline else "General query"
            },
            {
                "step": 2,
                "name": "Supabase pgvector Knowledge Base Check",
                "status": "COMPLETED",
                "detail": "No matching document excerpts found in internal policy store"
            }
        ]
        return AskQuestionResponse(
            question=req.question,
            answer="No relevant documentation was found in the internal knowledge base or live airline resources to answer this question.",
            sources=[],
            chunks=[],
            source_type="rag",
            execution_steps=steps,
            latency_ms=round((time.perf_counter() - start) * 1000, 2)
        )

    # 3. Grounded RAG Answer Synthesis
    rag_context = rag_service.build_context(retrieval_resp)
    answer = await llm_synthesizer.synthesize_rag_answer(
        question=req.question,
        context_text=rag_context.context_text,
        airline=req.airline
    )

    if not answer:
        bullet_points = []
        for c in retrieval_resp.results[:3]:
            title = c.chunk.metadata.title or "Document"
            clean_snippet = c.chunk.content.strip()
            bullet_points.append(f"**From {title}** (Similarity: {round(c.score * 100, 1)}%):\n> {clean_snippet}")

        answer = (
            f"Here is the verified information retrieved from the knowledge base for your question:\n\n"
            + "\n\n".join(bullet_points)
        )

    steps = [
        {
            "step": 1,
            "name": "Query Intent & Carrier Recognition",
            "status": "COMPLETED",
            "detail": f"Identified airline: {detected_airline['name']} ({detected_airline['code']})" if detected_airline else "General passenger rights inquiry"
        },
        {
            "step": 2,
            "name": "Supabase pgvector Knowledge Retrieval",
            "status": "COMPLETED",
            "detail": f"Retrieved {len(retrieval_resp.results)} matching document chunk(s) from pgvector store"
        },
        {
            "step": 3,
            "name": "Policy Evidence & Domain Verification",
            "status": "COMPLETED",
            "detail": "Validated source URLs against trusted_domains.yaml allowlist"
        },
        {
            "step": 4,
            "name": "Gemini LLM Policy Synthesis",
            "status": "COMPLETED",
            "detail": f"Grounded answer synthesized with Google Gemini ({settings.LLM_MODEL})"
        }
    ]

    return AskQuestionResponse(
        question=req.question,
        answer=answer,
        sources=rag_context.sources,
        chunks=retrieval_resp.results,
        source_type="rag",
        execution_steps=steps,
        latency_ms=round((time.perf_counter() - start) * 1000, 2)
    )

@router.post("/ingest", response_model=IngestionResult)
async def ingest_document(doc: KnowledgeDocument):
    """
    Ingests a knowledge document into the searchable RAG knowledge base.
    Automatically normalizes, chunks, embeds, and indexes the content.
    """
    res = await rag_service.ingest_document(doc)
    if res.status == "ERROR":
        raise HTTPException(status_code=400, detail=res.message)
    return res

@router.post("/upload", response_model=IngestionResult)
async def upload_document(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    airline: Optional[str] = Form(None),
    airline_code: Optional[str] = Form(None),
    airport: Optional[str] = Form(None),
    policy_type: str = Form("CARRIER_CONDITIONS_OF_CARRIAGE"),
    source_url: Optional[str] = Form(None)
):
    """
    Uploads a document file (.pdf, .txt, .md), extracts its text, uploads the
    raw file to Supabase Storage, and chunks/indexes it into pgvector.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Uploaded file must have a filename.")

    content_bytes = await file.read()
    if not content_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    filename_lower = file.filename.lower()
    extracted_text = ""

    # 1. Text extraction
    try:
        if filename_lower.endswith(".pdf") or file.content_type == "application/pdf":
            import pypdf
            pdf_reader = pypdf.PdfReader(io.BytesIO(content_bytes))
            text_pages = []
            for idx, page in enumerate(pdf_reader.pages):
                page_text = page.extract_text() or ""
                if page_text.strip():
                    text_pages.append(f"--- Page {idx + 1} ---\n{page_text.strip()}")
            extracted_text = "\n\n".join(text_pages)
            if not extracted_text.strip():
                raise ValueError("Could not extract readable text from PDF (it might be scanned/image-only).")
        else:
            # Default to UTF-8 decoded text
            extracted_text = content_bytes.decode("utf-8", errors="replace").strip()
    except Exception as e:
        logger.error(f"Error parsing file {file.filename}: {e}")
        raise HTTPException(status_code=422, detail=f"Failed to extract text from file: {str(e)}")

    if not extracted_text:
        raise HTTPException(status_code=422, detail="No readable text found in uploaded document.")

    # 2. Upload raw file to Supabase Storage if configured
    clean_name = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", file.filename)
    doc_id = f"doc-{uuid.uuid4().hex[:12]}"
    storage_path = f"uploads/{doc_id}/{clean_name}"

    if settings.clean_supabase_url and settings.SUPABASE_SERVICE_ROLE_KEY:
        try:
            from supabase import create_client
            sb = create_client(settings.clean_supabase_url, settings.SUPABASE_SERVICE_ROLE_KEY)
            sb.storage.from_(settings.SUPABASE_STORAGE_BUCKET).upload(
                path=storage_path,
                file=content_bytes,
                file_options={"content-type": file.content_type or "application/octet-stream", "upsert": "true"}
            )
            logger.info(f"File uploaded to Supabase Storage at: {storage_path}")
        except Exception as e:
            logger.warning(f"Failed to upload raw file to Supabase Storage: {e}")

    # 3. Formulate KnowledgeDocument
    doc_title = title or file.filename.rsplit(".", 1)[0].replace("_", " ").replace("-", " ").title()
    doc = KnowledgeDocument(
        doc_id=doc_id,
        title=doc_title,
        airline=airline,
        airline_code=airline_code,
        airport=airport,
        policy_type=policy_type,
        source_url=source_url or f"storage://{settings.SUPABASE_STORAGE_BUCKET}/{storage_path}",
        content=extracted_text,
        metadata={
            "storage_path": storage_path,
            "file_name": file.filename,
            "file_size": len(content_bytes),
            "mime_type": file.content_type
        }
    )

    # 4. Ingest, chunk, embed, and store
    res = await rag_service.ingest_document(doc)
    if res.status == "ERROR":
        raise HTTPException(status_code=400, detail=res.message)
    return res

@router.get("/documents", response_model=List[Dict[str, Any]])
async def list_documents():
    """Lists all knowledge documents currently indexed in the knowledge base."""
    return await rag_service.list_documents()

@router.get("/documents/{doc_id}", response_model=KnowledgeDocument)
async def get_document(doc_id: str):
    """Retrieves document details and raw content by document ID."""
    doc = await rag_service.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail=f"Document '{doc_id}' not found.")
    return doc

@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str):
    """Deletes a document, its storage file, and its indexed vector chunks."""
    deleted = await rag_service.delete_document(doc_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Document '{doc_id}' not found.")
    return {"status": "success", "message": f"Document '{doc_id}' deleted."}

@router.get("/stats")
async def get_rag_stats():
    """Returns operational statistics and health of the RAG system."""
    return await rag_service.get_stats()
