from typing import List, Dict, Any, Set
from app.rag.schemas import RetrievalResponse, ScoredChunk, RAGContext

class ContextBuilder:
    """
    RAG Context Builder.
    Assembles bounded, deduplicated, grounded context blocks from retrieved policy chunks,
    preserving full provenance, citation IDs, and source metadata.
    """
    def __init__(self, max_context_chars: int = 3000):
        self.max_context_chars = max_context_chars

    @staticmethod
    def _text_overlap_ratio(text1: str, text2: str) -> float:
        """Computes approximate character token overlap between two snippets."""
        set1 = set(text1.lower().split())
        set2 = set(text2.lower().split())
        if not set1 or not set2:
            return 0.0
        intersection = set1.intersection(set2)
        smaller = min(len(set1), len(set2))
        return len(intersection) / smaller

    def build_context(self, response: RetrievalResponse, max_chars: int = None) -> RAGContext:
        limit = max_chars or self.max_context_chars
        if not response.results:
            return RAGContext(
                context_text="",
                sources=[],
                total_tokens_approx=0,
                retrieved_chunks_count=0
            )

        # Deduplicate chunks with high textual overlap
        unique_chunks: List[ScoredChunk] = []
        for scored in response.results:
            is_duplicate = False
            for existing in unique_chunks:
                if existing.chunk.doc_id == scored.chunk.doc_id:
                    overlap = self._text_overlap_ratio(existing.chunk.content, scored.chunk.content)
                    if overlap > 0.75:
                        is_duplicate = True
                        break
            if not is_duplicate:
                unique_chunks.append(scored)

        lines: List[str] = [
            "### RETRIEVED AVIATION POLICY & RECOVERY EVIDENCE",
            "The following verified airline conditions of carriage and regulatory rules were retrieved from the knowledge base:",
            ""
        ]

        sources_metadata: List[Dict[str, Any]] = []
        seen_sources: Set[str] = set()
        current_len = sum(len(l) for l in lines)
        chunks_included = 0

        for i, item in enumerate(unique_chunks, start=1):
            meta = item.chunk.metadata
            chunk_body = item.chunk.content.strip()

            snippet_block = [
                f"[EVIDENCE {i}]",
                f"Source: {meta.title}",
                f"Airline: {meta.airline or 'Aviation Regulatory Authority'} ({meta.airline_code or 'REG'})",
                f"Policy Type: {meta.policy_type}",
                f"Section: {meta.section or 'General'}",
                f"Official URL: {meta.source_url}",
                f"Verification: {'Verified Official Source' if meta.verified else 'Unverified'}",
                f"Confidence Score: {item.confidence.upper()} (score: {item.score})",
                "Excerpt Content:",
                f'"{chunk_body}"',
                ""
            ]

            block_text = "\n".join(snippet_block)
            if current_len + len(block_text) > limit and chunks_included > 0:
                # Truncate at context budget boundary
                break

            lines.append(block_text)
            current_len += len(block_text)
            chunks_included += 1

            source_key = f"{meta.title}-{meta.source_url}"
            if source_key not in seen_sources:
                seen_sources.add(source_key)
                sources_metadata.append({
                    "name": meta.title,
                    "airline": meta.airline,
                    "type": "Policy Document",
                    "source_url": meta.source_url,
                    "verified": meta.verified,
                    "confidence": item.confidence,
                    "relevance_score": item.score
                })

        full_text = "\n".join(lines).strip()
        approx_tokens = max(1, len(full_text) // 4)

        return RAGContext(
            context_text=full_text,
            sources=sources_metadata,
            total_tokens_approx=approx_tokens,
            retrieved_chunks_count=chunks_included
        )
