import io
import re
import uuid
import logging
from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Form, status
from typing import List, Optional, Dict, Any
from app.config import settings
from pydantic import BaseModel, Field
from app.rag.schemas import (
    KnowledgeDocument,
    RetrievalQuery,
    RetrievalResponse,
    IngestionResult,
    ScoredChunk
)
from app.rag.service import rag_service

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

class AskQuestionResponse(BaseModel):
    question: str
    answer: str
    sources: List[Dict[str, Any]] = []
    chunks: List[ScoredChunk] = []
    latency_ms: float = 0.0

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
    Retrieves the most relevant chunks from Supabase pgvector and returns
    a grounded answer with cited document sources.
    """
    import time
    start = time.perf_counter()
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

    if not retrieval_resp.results:
        return AskQuestionResponse(
            question=req.question,
            answer="No relevant documentation was found in the knowledge base to answer this question.",
            sources=[],
            chunks=[],
            latency_ms=round((time.perf_counter() - start) * 1000, 2)
        )

    rag_context = rag_service.build_context(retrieval_resp)

    # Synthesize answer (Gemini if configured, or structured grounded summary)
    answer = ""
    if settings.LLM_PROVIDER == "gemini" and settings.LLM_API_KEY and settings.LLM_API_KEY != "mock_key":
        try:
            import google.generativeai as genai
            genai.configure(api_key=settings.LLM_API_KEY)
            model = genai.GenerativeModel(settings.LLM_MODEL)
            prompt = (
                f"You are SkyGuardian AI, an aviation policy expert assistant.\n"
                f"Answer the user's question based strictly on the following verified document excerpts.\n"
                f"Cite the relevant document title or section.\n\n"
                f"DOCUMENT CONTEXT:\n{rag_context.context_text}\n\n"
                f"USER QUESTION:\n{req.question}\n\n"
                f"ANSWER:"
            )
            llm_res = await model.generate_content_async(prompt)
            answer = llm_res.text
        except Exception as e:
            logger.warning(f"LLM generation failed ({e}), using structured synthesis fallback.")

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

    return AskQuestionResponse(
        question=req.question,
        answer=answer,
        sources=rag_context.sources,
        chunks=retrieval_resp.results,
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
