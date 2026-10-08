from typing import Optional

from app.config import Settings, settings as default_settings
from app.llm.base import LLMProvider
from app.llm.gemini import GeminiLLMProvider, resolve_gemini_key


def get_llm_provider(config: Settings = default_settings) -> Optional[LLMProvider]:
    """
    Gemini when LLM_PROVIDER=gemini and a real key is configured, otherwise None.
    None means the Recovery Agent uses its deterministic template ("Standard summary"),
    so the UI never labels template text as AI-assisted.
    """
    if config.LLM_PROVIDER.strip().lower() != "gemini":
        return None
    key = resolve_gemini_key(config)
    if not key:
        return None
    return GeminiLLMProvider(api_key=key, model=config.LLM_MODEL, timeout_seconds=config.LLM_TIMEOUT_SECONDS)
