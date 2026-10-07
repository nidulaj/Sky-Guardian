from fastapi import APIRouter, HTTPException, Query, status
from typing import List, Optional, Dict, Any
from app.rag.schemas import (
    KnowledgeDocument,
    RetrievalQuery,
    RetrievalResponse,
    IngestionResult
)
from app.rag.service import rag_service

router = APIRouter(prefix="/api/rag", tags=["RAG Knowledge Base"])

@router.post("/query", response_model=RetrievalResponse)
async def query_knowledge(req: RetrievalQuery):
    """
    Execute semantic retrieval against the aviation disruption knowledge base.
    Supports airline, airport, and policy_type metadata filtering.
    """
    response = await rag_service.retrieve(req)
    return response

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
    """Deletes a document and its indexed vector chunks from the knowledge base."""
    deleted = await rag_service.delete_document(doc_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Document '{doc_id}' not found.")
    return {"status": "success", "message": f"Document '{doc_id}' deleted."}

@router.get("/stats")
async def get_rag_stats():
    """Returns operational statistics and health of the RAG system."""
    return await rag_service.get_stats()
