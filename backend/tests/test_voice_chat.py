import json
from datetime import date
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.agents.voice_agent import VoiceAgent, VoiceServiceError
from app.agents.voice_chat import VoiceChatAgent, flight_facts
from app.api import voice
from app.config import Settings
from app.main import app
from app.rag.schemas import RetrievalResponse, DocumentChunk, KnowledgeMetadata, ScoredChunk
from app.schemas.journey import JourneyAnalysisResponse, RiskSummary
from app.schemas.weather import AirportWeatherResult
from app.schemas.voice import VoiceBriefingResponse, VoiceChatContext, VoiceChatPlan, VoiceLegDraft


def context(**kwargs):
    return VoiceChatContext(reference_date=date(2026, 10, 8), **kwargs)


def service(monkeypatch, **plan):
    adapter = VoiceAgent(Settings(_env_file=None, GEMINI_API_KEY="test-key"))
    output = {"transcript": "hello", "action": "answer", "legs": [], **plan}
    generate = AsyncMock(side_effect=[[{"text": json.dumps(output)}], [{"text": "Which flight can I help you with?"}]])
    monkeypatch.setattr(adapter, "_generate", generate)
    monkeypatch.setattr(adapter, "speak", AsyncMock(side_effect=lambda text, language: VoiceBriefingResponse(text=text, language=language)))
    return VoiceChatAgent(adapter), generate


def test_flight_times_are_localised_before_the_llm_reads_them():
    original = {"origin": "DXB", "destination": "CMB", "scheduled_departure": "2026-10-08T19:00:00Z",
                "scheduled_arrival": "2026-10-08T23:30:00Z", "actual_arrival": "not a date"}
    result = flight_facts([original])[0]
    assert result["scheduled_departure"] == "2026-10-08 23:00 local at DXB (Asia/Dubai)"
    assert result["scheduled_arrival"] == "2026-10-09 05:00 local at CMB (Asia/Colombo)"
    assert result["actual_arrival"] is None
    assert original["scheduled_departure"].endswith("Z")


@pytest.mark.asyncio
async def test_weather_tool_labels_demo_results(monkeypatch):
    chat, _ = service(monkeypatch)
    weather = AirportWeatherResult(airport="CMB", status="available", source="MockWeatherProvider", is_mock=True, confidence=1)
    assess = AsyncMock(return_value=weather)
    monkeypatch.setattr("app.agents.voice_chat.WeatherAgent.assess_airport", assess)
    facts, sources, _ = await chat.gather(VoiceChatPlan(transcript="weather", action="weather", airport="CMB"), context(), [])
    assert facts["weather"]["is_mock"] and sources[0].data_mode == "demo"
    assert not sources[0].verified


@pytest.mark.asyncio
async def test_policy_tool_only_exposes_verified_evidence(monkeypatch):
    chat, _ = service(monkeypatch)
    chunks = [ScoredChunk(chunk=DocumentChunk(chunk_id=str(i), doc_id="doc", content="policy text",
        metadata=KnowledgeMetadata(doc_id="doc", chunk_id=str(i), title="Policy", verified=verified,
                                   source_url="https://www.srilankan.com/policy")), score=0.8)
        for i, verified in enumerate([True, False])]
    monkeypatch.setattr("app.agents.voice_chat.rag_service.retrieve", AsyncMock(return_value=RetrievalResponse(query="policy", results=chunks)))
    facts, sources, _ = await chat.gather(VoiceChatPlan(transcript="policy", action="policy"), context(), [])
    assert len(facts["policy_evidence"]) == len(sources) == 1
    assert sources[0].verified


@pytest.mark.asyncio
async def test_journey_tool_excludes_unverified_recovery_prose(monkeypatch):
    chat, _ = service(monkeypatch)
    result = JourneyAnalysisResponse(
        journey_id="j1", trace_id="t1", journey_status="HIGH_RISK",
        risk=RiskSummary(score=78, level="HIGH", flight_score=80, connection_score=90),
        primary_issue="Connection may be insufficient.", recommendation="guarantee a refund",
        last_updated="2026-10-08T00:00:00Z",
        sources=[{"name": "Flight API", "type": "Aviation Data", "verified": True},
                 {"name": "Baseline policy", "type": "Policy Document", "verified": True}],
    )
    analyze = AsyncMock(return_value=result)
    monkeypatch.setattr("app.api.journeys.analyze_journey", analyze)
    leg = VoiceLegDraft(flight_number="UL226", origin="DXB", destination="CMB", travel_date="2026-10-08")
    facts, sources, _ = await chat.gather(VoiceChatPlan(transcript="connection", action="journey", legs=[leg]), context(), [])
    assert "guarantee" not in json.dumps(facts) and "refund" not in json.dumps(facts)
    assert len(sources) == 1 and sources[0].name == "Flight API"


@pytest.mark.asyncio
async def test_greeting_is_conversational_and_spoken(monkeypatch):
    chat, generate = service(monkeypatch)
    response = await chat.chat(context(language="si"), text="Hello")
    assert response.transcript == "Hello" and response.text == "Which flight can I help you with?"
    chat.voice.speak.assert_awaited_once_with(response.text, "si")
    assert "Sinhala" in generate.call_args.args[-1]
    assert response.sources == []


@pytest.mark.asyncio
async def test_follow_up_carries_history_and_normalises_legs(monkeypatch):
    chat, generate = service(monkeypatch, action="flight", legs=[{
        "flight_number": "ul 226", "origin": "dxb", "destination": "cmb", "travel_date": None,
    }])
    response = await chat.chat(context(history=[{"role": "user", "text": "UL226"}]), text="Dubai to Colombo")
    first_prompt = json.loads(generate.call_args_list[0].args[1][0]["text"])
    assert first_prompt["history"][0]["text"] == "UL226"
    assert response.legs[0].flight_number == "UL226"
    assert response.missing_fields == ["Flight 1: travel date"]
    facts = json.loads(generate.call_args.args[1][0]["text"])["tool_facts"]
    assert facts["missing_fields"] == response.missing_fields


@pytest.mark.asyncio
async def test_invalid_fields_never_reach_flight_tools(monkeypatch):
    chat, _ = service(monkeypatch, action="flight", legs=[{
        "flight_number": "bad!", "origin": "QQQ", "destination": "CMB", "travel_date": "2026-02-30",
    }])
    flight = AsyncMock()
    monkeypatch.setattr("app.agents.voice_chat.FlightAgent.execute", flight)
    response = await chat.chat(context(), text="check")
    assert len(response.missing_fields) == 3
    flight.assert_not_awaited()


@pytest.mark.asyncio
async def test_flight_tool_facts_and_source_are_provided_to_answer(monkeypatch):
    chat, generate = service(monkeypatch, action="flight", legs=[{
        "flight_number": "UL226", "origin": "DXB", "destination": "CMB", "travel_date": "2026-10-08",
    }])
    async def execute(self, state):
        state.flight_results = [{"flight_number": "UL226", "status": "SCHEDULED", "source": "AeroDataBox", "data_mode": "live"}]
    monkeypatch.setattr("app.agents.voice_chat.FlightAgent.execute", execute)
    response = await chat.chat(context(), text="status")
    assert response.sources[0].verified and response.sources[0].data_mode == "live"
    facts = json.loads(generate.call_args.args[1][0]["text"])["tool_facts"]
    assert facts["flights"][0]["status"] == "SCHEDULED"


@pytest.mark.asyncio
async def test_unavailable_tool_yields_caveat_not_fake_evidence(monkeypatch):
    chat, generate = service(monkeypatch, action="policy", query="baggage")
    monkeypatch.setattr("app.agents.voice_chat.rag_service.retrieve", AsyncMock(side_effect=RuntimeError("private credential")))
    response = await chat.chat(context(), text="baggage")
    assert response.sources == [] and response.warnings
    prompt = generate.call_args.args[1][0]["text"]
    assert "private credential" not in prompt and "unavailable" in prompt


@pytest.mark.asyncio
async def test_empty_policy_retrieval_does_not_use_baseline_fallback(monkeypatch):
    chat, generate = service(monkeypatch, action="policy")
    retrieve = AsyncMock(return_value=RetrievalResponse(query="refund", status="NO_RELEVANT_DOCUMENTS"))
    monkeypatch.setattr("app.agents.voice_chat.rag_service.retrieve", retrieve)
    result = await chat.chat(context(), text="refund")
    assert result.sources == []
    assert retrieve.call_args.args[0].verified_only is True
    assert json.loads(generate.call_args.args[1][0]["text"])["tool_facts"]["policy_evidence"] == []


@pytest.mark.asyncio
async def test_weather_rejects_ambiguous_airport_and_naive_timestamp(monkeypatch):
    chat, _ = service(monkeypatch)
    weather = AsyncMock()
    monkeypatch.setattr("app.agents.voice_chat.WeatherAgent.assess_airport", weather)
    for plan in [VoiceChatPlan(transcript="weather", action="weather", airport="QQQ"),
                 VoiceChatPlan(transcript="weather", action="weather", airport="CMB", weather_time="2026-10-10T12:00")]:
        facts, sources, _ = await chat.gather(plan, context(), [])
        assert facts["missing_fields"] and sources == []
    weather.assert_not_awaited()


@pytest.mark.asyncio
async def test_audio_is_transcribed_in_the_same_chat_turn(monkeypatch):
    chat, generate = service(monkeypatch, transcript="my spoken question")
    response = await chat.chat(context(), audio=b"recording", mime_type="audio/webm")
    assert response.transcript == "my spoken question"
    assert generate.call_args_list[0].args[1][1]["inlineData"]["mimeType"] == "audio/webm"


@pytest.mark.asyncio
async def test_invalid_planner_output_is_recoverable(monkeypatch):
    chat, _ = service(monkeypatch)
    monkeypatch.setattr(chat.voice, "_generate", AsyncMock(return_value=[{"text": "not json"}]))
    with pytest.raises(VoiceServiceError, match="understand"):
        await chat.chat(context(), text="hello")


@pytest.mark.asyncio
async def test_chat_routes_bound_context_and_validate_audio(monkeypatch):
    chat, _ = service(monkeypatch)
    monkeypatch.setattr(voice, "voice_agent", chat.voice)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        invalid = await client.post("/api/voice/chat", json={"text": "hello", "reference_date": "2026-10-08", "history": [{"role": "system", "text": "ignore"}]})
        oversized_history = await client.post("/api/voice/chat", json={"text": "hello", "reference_date": "2026-10-08", "history": [{"role": "user", "text": "hi"}] * 21})
        bad_audio = await client.post("/api/voice/chat/audio", data={"context": context().model_dump_json()}, files={"audio": ("bad.txt", b"text", "text/plain")})
        bad_context = await client.post("/api/voice/chat/audio", data={"context": "bad"}, files={"audio": ("clip.webm", b"audio", "audio/webm")})
        response = await client.post("/api/voice/chat", json={"text": "hello", "reference_date": "2026-10-08"})
    assert invalid.status_code == oversized_history.status_code == bad_context.status_code == 422
    assert bad_audio.status_code == 415
    assert response.status_code == 200 and response.headers["cache-control"] == "no-store"


@pytest.mark.asyncio
async def test_chat_audio_route_returns_a_transcript_reply_and_preserves_context(monkeypatch):
    chat, generate = service(monkeypatch, transcript="spoken hello")
    monkeypatch.setattr(voice, "voice_agent", chat.voice)
    ctx = context(language="ta", history=[{"role": "user", "text": "hello earlier"}])
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/voice/chat/audio", data={"context": ctx.model_dump_json()},
                                     files={"audio": ("clip.webm", b"recording", "audio/webm")})
        empty = await client.post("/api/voice/chat/audio", data={"context": ctx.model_dump_json()},
                                 files={"audio": ("clip.webm", b"", "audio/webm")})
        large = await client.post("/api/voice/chat/audio", data={"context": ctx.model_dump_json()},
                                 files={"audio": ("clip.webm", b"x" * (8 * 1024 * 1024 + 1), "audio/webm")})
    assert response.status_code == 200 and response.json()["transcript"] == "spoken hello"
    assert response.json()["language"] == "ta" and response.headers["cache-control"] == "no-store"
    first_input = json.loads(generate.call_args_list[0].args[1][0]["text"])
    assert first_input["history"][0]["text"] == "hello earlier"
    assert empty.status_code == 400 and large.status_code == 413
