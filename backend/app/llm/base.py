"""LLM provider contract used by the Recovery Agent."""
from typing import Any, Dict, Protocol


class LLMError(Exception):
    """Any provider failure (missing key, HTTP error, timeout, unusable output). Safe to log, never shown."""


class LLMProvider(Protocol):
    name: str
    model: str

    async def generate_json(self, system: str, user: str, schema: Dict[str, Any]) -> Dict[str, Any]:
        """Return one JSON object matching `schema` (Gemini OpenAPI-subset format), or raise LLMError."""
        ...
