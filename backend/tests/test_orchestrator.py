"""Supervisor orchestrator: failure isolation, routing and the public workflow trace."""
import asyncio

import pytest
from httpx import AsyncClient, ASGITransport

from app.api import journeys
from app.config import settings
from app.main import app
from app.orchestrator.routing import should_trigger_recovery

DEMO_LEGS = [
    {"flight_number": "UL001", "travel_date": "2026-09-15", "origin": "CMB", "destination": "KUL"},
    {"flight_number": "XX123", "travel_date": "2026-09-15", "origin": "KUL", "destination": "NRT"},
]


@pytest.fixture(autouse=True, params=["langgraph", "sequential"])
def engine(request, monkeypatch):
    """Every orchestrator test runs on both engines."""
    monkeypatch.setattr(settings, "ORCHESTRATOR_ENGINE", request.param)
    return request.param


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


SAFE_LEGS = [
    {"flight_number": "UL306", "travel_date": "2026-09-15", "origin": "CMB", "destination": "SIN"},
    {"flight_number": "SQ638", "travel_date": "2026-09-15", "origin": "SIN", "destination": "NRT"},
]


@pytest.mark.parametrize("fields,reasons", [
    ({"flight_results": [{"status": "ON_TIME"}, {"status": "CANCELLED"}]}, ["FLIGHT_CANCELLED"]),
    ({"connection_results": [{"status": "SAFE"}, {"status": "LIKELY_MISSED"}]}, ["CONNECTION_AT_RISK"]),
    ({"connection_results": [{"status": "MISSED"}]}, ["CONNECTION_AT_RISK"]),
    ({"risk_analysis": {"score": 60}}, ["RISK_ABOVE_THRESHOLD"]),
    ({"alternatives_requested": True}, ["PASSENGER_REQUESTED"]),
    ({"risk_analysis": {"score": 59}, "connection_results": [{"status": "MODERATE_RISK"}]}, []),
    ({"risk_analysis": {"score": None, "level": "UNKNOWN"}}, []),
])
def test_should_trigger_recovery_rules(fields, reasons):
    assert should_trigger_recovery(journeys.JourneyState(**fields), threshold=60) == (bool(reasons), reasons)


def test_all_reasons_are_reported_together():
    state = journeys.JourneyState(flight_results=[{"status": "CANCELLED"}], connection_results=[{"status": "MISSED"}],
                         risk_analysis={"score": 90}, alternatives_requested=True)
    assert should_trigger_recovery(state, 60)[1] == [
        "FLIGHT_CANCELLED", "CONNECTION_AT_RISK", "RISK_ABOVE_THRESHOLD", "PASSENGER_REQUESTED"]


@pytest.mark.asyncio
async def test_low_risk_journey_skips_policy_and_alternatives():
    state = await journeys.orchestrator.run_workflow(journeys.JourneyState(journey_legs=SAFE_LEGS))
    assert state.recovery_triggered is False and state.recovery_reasons == []
    assert runs(state)["policy_agent"].status == "skipped"
    assert runs(state)["alternative_agent"].status == "skipped"
    assert runs(state)["recovery_agent"].status == "success"
    assert state.workflow_status == "COMPLETED"


@pytest.mark.asyncio
async def test_cancelled_flight_triggers_recovery():
    legs = [{"flight_number": "UL504", "travel_date": "2026-09-15", "origin": "CMB", "destination": "LHR"}]
    state = await journeys.orchestrator.run_workflow(journeys.JourneyState(journey_legs=legs))
    assert state.recovery_triggered is True
    assert "FLIGHT_CANCELLED" in state.recovery_reasons
    assert runs(state)["policy_agent"].status != "skipped"


@pytest.mark.asyncio
async def test_passenger_request_triggers_recovery_on_a_safe_journey():
    state = await journeys.orchestrator.run_workflow(
        journeys.JourneyState(journey_legs=SAFE_LEGS, alternatives_requested=True))
    assert state.recovery_triggered is True
    assert state.recovery_reasons == ["PASSENGER_REQUESTED"]
    assert runs(state)["alternative_agent"].status != "skipped"


GRAPH_ORDER = ["flight_agent", "connection_agent", "weather_agent", "risk_agent",
               "policy_agent", "alternative_agent", "recovery_agent"]


@pytest.mark.asyncio
@pytest.mark.parametrize("legs", [DEMO_LEGS, SAFE_LEGS])
async def test_trace_follows_graph_order(legs):
    state = await journeys.orchestrator.run_workflow(journeys.JourneyState(journey_legs=legs))
    assert [run.agent for run in state.agent_runs] == GRAPH_ORDER


@pytest.mark.asyncio
async def test_run_workflow_returns_the_callers_state():
    state = journeys.JourneyState(journey_legs=DEMO_LEGS)
    assert await journeys.orchestrator.run_workflow(state) is state


@pytest.mark.asyncio
async def test_engines_produce_the_same_assessment(monkeypatch):
    results = {}
    for name in ("langgraph", "sequential"):
        monkeypatch.setattr(settings, "ORCHESTRATOR_ENGINE", name)
        state = await journeys.orchestrator.run_workflow(journeys.JourneyState(journey_legs=DEMO_LEGS))
        # Provider results carry fetch timestamps, so compare the decisions rather than raw dumps.
        results[name] = {
            "flights": [(f["flight_number"], f["status"], f["delay_minutes"]) for f in state.flight_results],
            "connections": [(c["status"], c["available_connection_minutes"]) for c in state.connection_results],
            "risk": (state.risk_analysis["score"], state.risk_analysis["level"]),
            "reasons": state.recovery_reasons,
            "trace": [(r.agent, r.status) for r in state.agent_runs],
            "alternatives": [o.get("route_summary") for o in state.alternative_options],
            "recommendation": state.recommendation_text,
            "status": state.workflow_status,
        }
    assert results["langgraph"] == results["sequential"]
    assert results["langgraph"]["reasons"] == ["CONNECTION_AT_RISK", "RISK_ABOVE_THRESHOLD"]


def test_graph_diagram_has_conditional_recovery_branch():
    diagram = journeys.orchestrator.mermaid()
    assert "recovery_gate -.-> policy" in diagram
    assert "recovery_gate -.-> recovery" in diagram
