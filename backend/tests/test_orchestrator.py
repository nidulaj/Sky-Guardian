"""Supervisor orchestrator: failure isolation, routing and the public workflow trace."""
import asyncio

import pytest
from httpx import AsyncClient, ASGITransport

from app.api import journeys
from app.config import settings
from app.main import app

DEMO_LEGS = [
    {"flight_number": "UL001", "travel_date": "2026-09-15", "origin": "CMB", "destination": "KUL"},
    {"flight_number": "XX123", "travel_date": "2026-09-15", "origin": "KUL", "destination": "NRT"},
]


class Boom:
    """Agent stand-in that fails with an internal error that must not reach the passenger."""

    async def execute(self, state):
        raise RuntimeError("provider exploded: api_key=secret-123")


class Hang:
    async def execute(self, state):
        await asyncio.sleep(5)


async def analyze(**extra):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        return await client.post("/api/journeys/analyze", json={"legs": DEMO_LEGS, **extra})


def runs(state):
    return {run.agent: run for run in state.agent_runs}


@pytest.mark.asyncio
async def test_weather_agent_crash_still_returns_a_partial_assessment(monkeypatch):
    monkeypatch.setattr(journeys.orchestrator, "weather_agent", Boom())
    response = await analyze()
    assert response.status_code == 200
    data = response.json()
    assert "Weather data unavailable; risk assessed with reduced confidence." in data["warnings"]
    assert data["risk"]["status"] == "partial"
    assert data["risk"]["components"]["weather"]["score"] is None
    assert "secret-123" not in response.text and "provider exploded" not in response.text


@pytest.mark.asyncio
async def test_failed_agent_is_recorded_and_workflow_is_partial(monkeypatch):
    orchestrator = journeys.orchestrator
    monkeypatch.setattr(orchestrator, "weather_agent", Boom())
    state = await orchestrator.run_workflow(journeys.JourneyState(journey_legs=DEMO_LEGS))
    weather = runs(state)["weather_agent"]
    assert weather.status == "error"
    assert weather.error == "weather agent RuntimeError"
    assert weather.duration_ms is not None
    assert state.workflow_status == "PARTIAL"
    assert state.recommendation_text


@pytest.mark.asyncio
async def test_slow_agent_times_out_and_workflow_completes(monkeypatch):
    orchestrator = journeys.orchestrator
    monkeypatch.setattr(settings, "AGENT_TIMEOUT_SECONDS", 0.05)
    monkeypatch.setattr(orchestrator, "connection_agent", Hang())
    state = await orchestrator.run_workflow(journeys.JourneyState(journey_legs=DEMO_LEGS))
    assert runs(state)["connection_agent"].status == "error"
    assert runs(state)["connection_agent"].error == "connection agent timed out"
    assert "Connection timing could not be calculated." in state.warnings
    assert runs(state)["recovery_agent"].status == "success"
    assert state.workflow_status == "PARTIAL"


@pytest.mark.asyncio
async def test_recovery_agent_failure_keeps_a_safe_recommendation(monkeypatch):
    orchestrator = journeys.orchestrator
    monkeypatch.setattr(orchestrator, "recovery_agent", Boom())
    state = await orchestrator.run_workflow(journeys.JourneyState(journey_legs=DEMO_LEGS))
    assert "could not be generated" in state.recommendation_text
    assert "provider exploded" not in state.recommendation_text


@pytest.mark.asyncio
async def test_alternative_agent_crash_reports_unavailable_search(monkeypatch):
    orchestrator = journeys.orchestrator
    monkeypatch.setattr(orchestrator, "alternative_agent", Boom())
    state = await orchestrator.run_workflow(journeys.JourneyState(journey_legs=DEMO_LEGS))
    assert state.alternative_search["status"] == "unavailable"
    assert state.alternative_options == [] and state.recommended_option is None
