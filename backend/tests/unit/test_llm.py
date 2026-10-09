import json

import httpx
import pytest

from app.config import Settings
from app.llm import LLMError, get_llm_provider
from app.llm.gemini import GeminiLLMProvider, resolve_gemini_key

SCHEMA = {"type": "OBJECT", "properties": {"headline": {"type": "STRING"}}, "required": ["headline"]}


def gemini(handler, model="gemini-2.5-flash"):
    return GeminiLLMProvider("test-key", model, timeout_seconds=1, transport=httpx.MockTransport(handler))


def reply(payload, finish="STOP"):
    return httpx.Response(200, json={"candidates": [{"finishReason": finish, "content": {"parts": [{"text": payload}]}}]})


@pytest.mark.asyncio
async def test_gemini_request_shape_and_json_result():
    seen = {}

    def handler(request):
        seen["url"], seen["key"], seen["body"] = str(request.url), request.headers["x-goog-api-key"], json.loads(request.content)
        return reply('{"headline": "Connection at risk"}')

    assert await gemini(handler).generate_json("rules", "facts", SCHEMA) == {"headline": "Connection at risk"}
    assert seen["url"].endswith("/models/gemini-2.5-flash:generateContent")
    assert seen["key"] == "test-key"
    body = seen["body"]
    assert body["systemInstruction"]["parts"][0]["text"] == "rules"
    assert body["contents"][0]["parts"][0]["text"] == "facts"
    config = body["generationConfig"]
    assert config["responseMimeType"] == "application/json" and config["responseSchema"] == SCHEMA
    assert config["temperature"] == 0.2 and config["thinkingConfig"] == {"thinkingBudget": 0}


@pytest.mark.asyncio
@pytest.mark.parametrize("response", [
    httpx.Response(429, json={}), httpx.Response(500, text="boom"),
    reply("not json"), reply('["a list"]'), reply('{"headline": "x"}', finish="MAX_TOKENS"),
    httpx.Response(200, json={"candidates": []}),
])
async def test_gemini_failures_raise_llm_error(response):
    with pytest.raises(LLMError):
        await gemini(lambda request: response).generate_json("s", "u", SCHEMA)


@pytest.mark.asyncio
async def test_gemini_timeout_raises_llm_error():
    def handler(request):
        raise httpx.ReadTimeout("slow", request=request)
    with pytest.raises(LLMError, match="timed out"):
        await gemini(handler).generate_json("s", "u", SCHEMA)


def test_invalid_model_name_rejected():
    with pytest.raises(ValueError):
        GeminiLLMProvider("k", "../evil", timeout_seconds=1)


@pytest.mark.parametrize("gemini_key,llm_key,expected", [
    (None, "mock_key", None), ("  ", None, None), (None, "real-llm", "real-llm"), ("real-gemini", "real-llm", "real-gemini"),
])
def test_key_resolution_ignores_placeholders(gemini_key, llm_key, expected):
    assert resolve_gemini_key(Settings(GEMINI_API_KEY=gemini_key, LLM_API_KEY=llm_key)) == expected


@pytest.mark.parametrize("provider,key,configured", [
    ("gemini", "real", True), ("gemini", "mock_key", False), ("mock", "real", False), ("openai", "real", False),
])
def test_factory_only_returns_gemini_when_configured(provider, key, configured):
    result = get_llm_provider(Settings(LLM_PROVIDER=provider, LLM_API_KEY=key, GEMINI_API_KEY=None))
    assert (result is not None) is configured
    if configured:
        assert result.model == "gemini-2.5-flash"
