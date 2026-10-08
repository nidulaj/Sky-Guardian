from typing import Optional
from app.rag.embeddings.base import BaseEmbeddingProvider
from app.rag.embeddings.mock import MockEmbeddingProvider
from app.rag.embeddings.gemini import GeminiEmbeddingProvider

def get_embedding_provider(
    provider_name: str = "mock",
    api_key: Optional[str] = None,
    model: str = "models/text-embedding-004"
) -> BaseEmbeddingProvider:
    """
    Factory function to instantiate the configured embedding provider.
    """
    provider_lower = (provider_name or "mock").lower().strip()
    if provider_lower == "gemini":
        return GeminiEmbeddingProvider(api_key=api_key, model=model)
    elif provider_lower == "mock":
        return MockEmbeddingProvider()
    else:
        # Default fallback
        return MockEmbeddingProvider()
