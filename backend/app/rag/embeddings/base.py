from abc import ABC, abstractmethod
from typing import List

class BaseEmbeddingProvider(ABC):
    """
    Abstract Base Class for Text Embedding Providers.
    """
    @property
    @abstractmethod
    def dimension(self) -> int:
        """Returns the embedding vector dimension."""
        pass

    @abstractmethod
    async def embed_text(self, text: str) -> List[float]:
        """Generates an embedding vector for a single text string."""
        pass

    @abstractmethod
    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Generates embedding vectors for a batch of text strings."""
        pass
