import re
import math
import hashlib
from typing import List
from app.rag.embeddings.base import BaseEmbeddingProvider

class MockEmbeddingProvider(BaseEmbeddingProvider):
    """
    Deterministic semantic projection embedding provider for testing and offline operation.
    Projects normalized token representations into a 128-dimensional unit hypersphere.
    Produces high cosine similarity for semantically overlapping aviation & policy texts,
    and low similarity for non-overlapping texts.
    """
    def __init__(self, dimension: int = 128):
        self._dim = dimension

        # Domain term weights to boost semantic focus on aviation disruption concepts
        self._concept_weights = {
            "srilankan": 3.0, "ul": 2.5, "malaysia": 3.0, "mh": 2.5, "singapore": 3.0, "sq": 2.5,
            "qatar": 3.0, "emirates": 3.0, "qantas": 3.0, "ana": 3.0, "jal": 3.0,
            "delay": 2.5, "delayed": 2.5, "delays": 2.5, "cancellation": 3.0, "cancelled": 3.0,
            "connection": 3.0, "connecting": 3.0, "missed": 3.5, "rebook": 3.5, "rebooking": 3.5,
            "voucher": 3.0, "vouchers": 3.0, "hotel": 3.0, "accommodation": 3.0, "meal": 3.0,
            "mct": 3.5, "minimum": 2.0, "transfer": 2.5, "klia": 3.0, "cmb": 3.0, "nrt": 3.0,
            "policy": 2.5, "carriage": 3.0, "rights": 2.5, "eu261": 4.0, "dot": 3.5, "macpc": 3.5,
            "refund": 3.0, "duty": 2.5, "care": 2.5, "compensation": 3.5, "interline": 3.0,
            "ticket": 2.0, "boarding": 2.0, "desk": 2.5, "transit": 2.5, "layover": 3.0
        }

    @property
    def dimension(self) -> int:
        return self._dim

    def _tokenize(self, text: str) -> List[str]:
        words = re.findall(r"\b[a-zA-Z0-9_\-]{2,}\b", text.lower())
        return words

    def _embed(self, text: str) -> List[float]:
        tokens = self._tokenize(text)
        if not tokens:
            # Return zero vector with slight bias
            return [1.0 / math.sqrt(self._dim)] * self._dim

        vector = [0.0] * self._dim

        for token in tokens:
            weight = self._concept_weights.get(token, 1.0)
            # Use sha256 to hash token into integer space
            h = int(hashlib.sha256(token.encode("utf-8")).hexdigest()[:8], 16)
            
            # Project onto 3 distinct coordinates per token
            for i in range(3):
                idx = (h + i * 37) % self._dim
                sign = 1.0 if ((h >> (i * 4)) & 1) == 0 else -1.0
                vector[idx] += sign * weight

        # L2 normalize vector
        norm = math.sqrt(sum(x * x for x in vector))
        if norm < 1e-9:
            return [1.0 / math.sqrt(self._dim)] * self._dim

        return [round(x / norm, 6) for x in vector]

    async def embed_text(self, text: str) -> List[float]:
        return self._embed(text)

    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        return [self._embed(t) for t in texts]
