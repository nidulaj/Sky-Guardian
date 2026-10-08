import re
import hashlib
from typing import List, Tuple
from app.rag.schemas import KnowledgeDocument, DocumentChunk, KnowledgeMetadata, utc_now_iso

class DocumentChunker:
    """
    Intelligent aviation & policy document chunker.
    Preserves heading hierarchy, normalizes text, enforces chunk sizing & overlap,
    and calculates content hashes for deduplication and versioning.
    """
    def __init__(self, chunk_size: int = 600, chunk_overlap: int = 80):
        self.chunk_size = max(100, chunk_size)
        self.chunk_overlap = max(0, min(chunk_overlap, self.chunk_size // 2))

    @staticmethod
    def clean_text(text: str) -> str:
        """Cleans and normalizes document text."""
        if not text:
            return ""
        # Normalize newlines
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        # Strip simple HTML tags if present
        text = re.sub(r"<[^>]+>", " ", text)
        # Normalize quotes and special whitespace
        text = text.replace("\u2018", "'").replace("\u2019", "'")
        text = text.replace("\u201c", '"').replace("\u201d", '"')
        text = text.replace("\u00a0", " ")
        # Collapse multiple horizontal whitespaces
        text = re.sub(r"[ \t]+", " ", text)
        # Collapse more than two consecutive newlines
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    @staticmethod
    def compute_hash(text: str) -> str:
        """Computes deterministic SHA-256 hash of text."""
        return hashlib.sha256(text.encode("utf-8")).hexdigest()

    def _split_into_sections(self, text: str) -> List[Tuple[str, str]]:
        """
        Splits markdown text into (section_header, section_body) pairs.
        """
        lines = text.split("\n")
        sections: List[Tuple[str, str]] = []
        current_header = "General"
        current_lines: List[str] = []

        header_pattern = re.compile(r"^(#{1,4}\s+.+)$")

        for line in lines:
            match = header_pattern.match(line.strip())
            if match:
                if current_lines:
                    body = "\n".join(current_lines).strip()
                    if body:
                        sections.append((current_header, body))
                    current_lines = []
                current_header = match.group(1).lstrip("#").strip()
            else:
                current_lines.append(line)

        if current_lines:
            body = "\n".join(current_lines).strip()
            if body:
                sections.append((current_header, body))

        if not sections:
            sections = [("General", text)]

        return sections

    def _chunk_text_block(self, text: str, header: str) -> List[str]:
        """
        Splits a text block into pieces of at most chunk_size characters with chunk_overlap.
        Prefers splitting on paragraph breaks, sentence boundaries, or words.
        """
        if len(text) <= self.chunk_size:
            prefix = f"[{header}]\n" if header and header != "General" else ""
            return [f"{prefix}{text}".strip()]

        chunks: List[str] = []
        # Split into paragraphs
        paragraphs = text.split("\n\n")
        current_chunk = ""

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            # If a single paragraph is too large, split it by sentence
            if len(para) > self.chunk_size:
                sentences = re.split(r"(?<=[.!?])\s+", para)
                for sentence in sentences:
                    sentence = sentence.strip()
                    if not sentence:
                        continue
                    if len(current_chunk) + len(sentence) + 1 <= self.chunk_size:
                        current_chunk = f"{current_chunk} {sentence}".strip()
                    else:
                        if current_chunk:
                            chunks.append(current_chunk)
                        # Overlap: keep last part of previous chunk if possible
                        if self.chunk_overlap > 0 and len(current_chunk) > self.chunk_overlap:
                            overlap_text = current_chunk[-self.chunk_overlap:]
                            current_chunk = f"{overlap_text} {sentence}".strip()
                        else:
                            current_chunk = sentence
            else:
                if len(current_chunk) + len(para) + 2 <= self.chunk_size:
                    current_chunk = f"{current_chunk}\n\n{para}".strip()
                else:
                    if current_chunk:
                        chunks.append(current_chunk)
                    if self.chunk_overlap > 0 and len(current_chunk) > self.chunk_overlap:
                        overlap_text = current_chunk[-self.chunk_overlap:]
                        current_chunk = f"{overlap_text}\n\n{para}".strip()
                    else:
                        current_chunk = para

        if current_chunk:
            chunks.append(current_chunk)

        # Prepend header if not already present
        result = []
        for c in chunks:
            prefix = f"[{header}]\n" if header and header != "General" and not c.startswith(f"[{header}]") else ""
            result.append(f"{prefix}{c}".strip())

        return result

    def chunk_document(self, doc: KnowledgeDocument) -> List[DocumentChunk]:
        """
        Processes a KnowledgeDocument and returns a list of DocumentChunks.
        """
        cleaned_content = self.clean_text(doc.content)
        sections = self._split_into_sections(cleaned_content)
        
        raw_chunks: List[Tuple[str, str]] = [] # (header, chunk_text)
        for header, body in sections:
            chunked_pieces = self._chunk_text_block(body, header)
            for piece in chunked_pieces:
                raw_chunks.append((header, piece))

        if not raw_chunks:
            raw_chunks = [("General", cleaned_content)]

        total_chunks = len(raw_chunks)
        chunks: List[DocumentChunk] = []

        for idx, (header, text) in enumerate(raw_chunks):
            chunk_id = f"{doc.doc_id}-chunk-{idx + 1}"
            content_hash = self.compute_hash(text)
            
            metadata = KnowledgeMetadata(
                doc_id=doc.doc_id,
                chunk_id=chunk_id,
                title=doc.title,
                airline=doc.airline,
                airline_code=doc.airline_code,
                airport=doc.airport,
                policy_type=doc.policy_type,
                source_url=doc.source_url,
                effective_date=doc.effective_date,
                last_verified=doc.updated_at or utc_now_iso(),
                verified=doc.verified,
                jurisdiction=doc.jurisdiction,
                section=header if header != "General" else None,
                chunk_index=idx,
                total_chunks=total_chunks,
                content_hash=content_hash,
                extra=doc.metadata
            )

            chunk = DocumentChunk(
                chunk_id=chunk_id,
                doc_id=doc.doc_id,
                content=text,
                metadata=metadata
            )
            chunks.append(chunk)

        return chunks
