import logging
from typing import List, Optional
from app.rag.embeddings.base import BaseEmbeddingProvider
from app.rag.embeddings.mock import MockEmbeddingProvider

logger = logging.getLogger(__name__)

class GeminiEmbeddingProvider(BaseEmbeddingProvider):
    """
    Embedding provider using Google Generative AI (e.g. text-embedding-004).
    Falls back gracefully to MockEmbeddingProvider if the API key is not configured
    or if network/API calls fail.
    """
    def __init__(self, api_key: Optional[str] = None, model: str = "models/text-embedding-004"):
        self.api_key = api_key
        self.model = model
        self._fallback_provider = MockEmbeddingProvider()
        self._initialized = False

        if self.api_key and self.api_key != "mock_key":
            try:
                import google.generativeai as genai
                genai.configure(api_key=self.api_key)
                self._genai = genai
                self._initialized = True
                logger.info("Google Generative AI embedding provider initialized successfully.")
            except Exception as e:
                logger.warning(f"Failed to initialize google-generativeai: {e}. Falling back to mock embeddings.")
        else:
            logger.info("GeminiEmbeddingProvider using mock fallback because no live API key was supplied.")

    @property
    def dimension(self) -> int:
        return 768 if self._initialized else self._fallback_provider.dimension

    async def embed_text(self, text: str) -> List[float]:
        if not self._initialized:
            return await self._fallback_provider.embed_text(text)
        try:
            result = self._genai.embed_content(
                model=self.model,
                content=text,
                task_type="retrieval_document"
            )
            embedding = result.get("embedding", [])
            if isinstance(embedding, list) and embedding:
                return embedding
            return await self._fallback_provider.embed_text(text)
        except Exception as e:
            logger.warning(f"Gemini embed_content failed: {e}. Using fallback.")
            return await self._fallback_provider.embed_text(text)

    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        if not self._initialized:
            return await self._fallback_provider.embed_batch(texts)
        results = []
        for text in texts:
            vec = await self.embed_text(text)
            results.append(vec)
        return results
