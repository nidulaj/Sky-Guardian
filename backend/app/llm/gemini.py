"""Gemini generateContent over REST (same transport approach as agents/voice_agent.py)."""
import json
import re
from typing import Any, Dict, Optional

import httpx

from app.config import Settings
from app.llm.base import LLMError

API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
PLACEHOLDER_KEYS = {"", "mock_key"}


def resolve_gemini_key(config: Settings) -> Optional[str]:
    """GEMINI_API_KEY, else LLM_API_KEY; placeholder values count as no key."""
    for candidate in (config.GEMINI_API_KEY, config.LLM_API_KEY):
        if candidate and candidate.strip() not in PLACEHOLDER_KEYS:
            return candidate.strip()
    return None


class GeminiLLMProvider:
    name = "gemini"

    def __init__(self, api_key: str, model: str, timeout_seconds: float,
                 max_output_tokens: int = 2048, transport: Optional[httpx.AsyncBaseTransport] = None):
        if not re.fullmatch(r"[a-zA-Z0-9._-]+", model):
            raise ValueError("Invalid Gemini model name")
        self.api_key = api_key
        self.model = model
        self.timeout_seconds = timeout_seconds
        self.max_output_tokens = max_output_tokens
        self.transport = transport

    def _generation_config(self, schema: Dict[str, Any]) -> Dict[str, Any]:
        config: Dict[str, Any] = {
            "responseMimeType": "application/json",
            "responseSchema": schema,
            "temperature": 0.2,
            "maxOutputTokens": self.max_output_tokens,
        }
        # Keep thinking small so it cannot use up the output budget of a short structured answer.
        if self.model.startswith("gemini-2.5"):
            config["thinkingConfig"] = {"thinkingBudget": 0}
        elif self.model.startswith("gemini-3"):
            config["thinkingConfig"] = {"thinkingLevel": "low"}
        return config

    async def generate_json(self, system: str, user: str, schema: Dict[str, Any]) -> Dict[str, Any]:
        body = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": self._generation_config(schema),
        }
        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds, transport=self.transport) as client:
                response = await client.post(API_URL.format(model=self.model),
                                             headers={"x-goog-api-key": self.api_key}, json=body)
        except httpx.TimeoutException:
            raise LLMError("Gemini request timed out") from None
        except httpx.RequestError as exc:
            raise LLMError(f"Gemini request failed ({type(exc).__name__})") from None
        if not response.is_success:
            raise LLMError(f"Gemini returned HTTP {response.status_code}")
        try:
            candidate = response.json()["candidates"][0]
            if candidate.get("finishReason") not in (None, "STOP"):
                raise ValueError(f"finishReason {candidate.get('finishReason')}")
            text = "".join(p.get("text", "") for p in candidate["content"]["parts"] if not p.get("thought"))
            result = json.loads(text)
        except (ValueError, KeyError, IndexError, TypeError, AttributeError) as exc:
            raise LLMError(f"Unusable Gemini response ({exc})") from None
        if not isinstance(result, dict):
            raise LLMError("Gemini response was not a JSON object")
        return result
