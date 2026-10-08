"""
Connection risk analysis (app/risk/connection_risk.py) and its integration into the Risk Agent.

Flight Agent output is mocked with the real FlightResult contract; Savi's Flight Agent is
not called or changed. Connection results come from the real ConnectionAgent, weather
from the real WeatherAgent with its deterministic MockWeatherProvider.
"""
from datetime import datetime, timedelta, timezone

import pytest

from app.agents.connection_agent import ConnectionAgent, evaluate_connection
from app.agents.risk_agent import RiskAgent
from app.agents.weather_agent import WeatherAgent
from app.orchestrator.state import JourneyState
from app.providers.weather import MockWeatherProvider
from app.risk.config import get_risk_config
from app.risk.connection_risk import assess_connection
from app.schemas.flight import FlightResult

BASE = datetime(2026, 10, 10, 6, 0, tzinfo=timezone.utc)
CFG = get_risk_config().connection


def _iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def flight(number, origin, destination, dep, arr, status="ON_TIME", delay=0):
    return FlightResult(
        flight_number=number, origin=origin, destination=destination,
        scheduled_departure=_iso(dep), estimated_departure=_iso(dep + timedelta(minutes=delay)),
        scheduled_arrival=_iso(arr), estimated_arrival=_iso(arr + timedelta(minutes=delay)),
        status=status, delay_minutes=delay, source="test", retrieved_at=_iso(BASE),
    ).model_dump()


def legs(delay=0, window=120, inbound_status=None):
    """UL001 CMB->KUL then XX123 KUL->NRT; `window` = minutes from UL001's expected arrival to XX123's departure."""
    inbound_status = inbound_status or ("DELAYED" if delay >= 15 else "ON_TIME")
    arrival = BASE + timedelta(hours=4)
    out_dep = arrival + timedelta(minutes=delay + window)
    return [
        flight("UL001", "CMB", "KUL", BASE, arrival, inbound_status, delay),
        flight("XX123", "KUL", "NRT", out_dep, out_dep + timedelta(hours=7)),
    ]


def connection_for(flights):
    return evaluate_connection(flights[0], flights[1], 60).model_dump()


# ---------------------------------------------------------------------------
# Connection risk analysis
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("window,status,score", [
    (120, "SAFE", 10),
    (90, "MODERATE_RISK", 40),
    (70, "HIGH_RISK", 70),
    (30, "LIKELY_MISSED", 90),
    (-40, "MISSED", 100),
])
def test_status_and_score_follow_connection_agent_and_config(window, status, score):
    risk = assess_connection(connection_for(legs(window=window)), 0, CFG)
    assert risk.status == status
    assert risk.risk_score == score == CFG.status_scores[status]
    assert risk.connection_minutes == window
    assert risk.required_minutes == 60
    assert risk.buffer_minutes == window - 60


def test_likely_missed_reason_uses_measured_minutes():
    risk = assess_connection(connection_for(legs(delay=90, window=30)), 0, CFG)
    assert risk.airport == "KUL"
    assert (risk.inbound_flight, risk.outbound_flight) == ("UL001", "XX123")
    assert risk.reason == ("Connection at KUL: 30 minutes between UL001 arriving and XX123 departing, "
                           "against a 60-minute minimum (likely missed).")


def test_missing_timing_is_unavailable_not_zero():
    flights = legs()
    flights[1]["scheduled_departure"] = flights[1]["estimated_departure"] = None
    result = connection_for(flights)
    assert result["status"] == "UNKNOWN" and result["available_connection_minutes"] == 0  # Connection Agent placeholder

    risk = assess_connection(result, 0, CFG)
    assert risk.status == "UNAVAILABLE"
    assert risk.risk_score is None
    assert risk.connection_minutes is None and risk.required_minutes is None and risk.buffer_minutes is None
    assert risk.reason == "Required connection information is unavailable (MISSING_TIMING_DATA)."


def test_cancelled_inbound_is_missed_without_fake_minutes():
    risk = assess_connection(connection_for(legs(inbound_status="CANCELLED")), 0, CFG)
    assert risk.status == "MISSED" and risk.risk_score == 100
    assert risk.connection_minutes is None  # no window was measured
    assert risk.reason == "Connection at KUL cannot be made: UL001 is cancelled (missed)."


@pytest.mark.parametrize("bad", ["junk", None, {"status": "WHATEVER"}, {"status": None}])
def test_invalid_connection_results_are_unavailable(bad):
    risk = assess_connection(bad, 2, CFG)
    assert risk.status == "UNAVAILABLE"
    assert risk.risk_score is None
    assert risk.connection_index == 2


# ---------------------------------------------------------------------------
# Full chain: Flight result -> Connection Agent -> Weather Agent -> Risk Agent
# ---------------------------------------------------------------------------

async def run_chain(flights):
    state = JourneyState(
        journey_legs=[{"flight_number": f["flight_number"], "travel_date": "2026-10-10",
                       "origin": f["origin"], "destination": f["destination"]} for f in flights],
        flight_results=flights,
    )
    await ConnectionAgent().execute(state)
    await WeatherAgent(provider=MockWeatherProvider()).execute(state)
    await RiskAgent().execute(state)
    return state


@pytest.mark.asyncio
async def test_risk_agent_uses_connection_risk_and_weather_agent_output():
    state = await run_chain(legs(delay=90, window=30))
    risk = state.risk_analysis
    conn = risk["components"]["connection"]

    # Connection risk analysis reaches the Risk Agent unchanged.
    assert conn["details"]["connections"][0]["status"] == "LIKELY_MISSED"
    assert conn["details"]["connections"][0]["risk_score"] == 90
    assert risk["connection_score"] == 90

    # Weather score is exactly what the Weather Agent produced (worst airport), not re-scored.
    worst = max(w["weather_score"] for w in state.weather_results if w["status"] == "available")
    assert risk["weather_score"] == worst == 60
    assert risk["components"]["weather"]["reason"].startswith("Highest airport weather risk: KUL")

    # Flight score from the configured delay band (90 min -> 65).
    assert risk["flight_score"] == 65

    w = get_risk_config().weights
    expected = 65 * w.flight + 90 * w.connection + 60 * w.weather
    assert risk["weighted_score"] == round(expected, 2)
    assert risk["score"] == 73 and risk["level"] == "HIGH"
    assert risk["top_factors"][0]["component"] == "connection"


@pytest.mark.asyncio
async def test_unavailable_connection_lowers_confidence_and_is_not_scored():
    flights = legs(delay=45)
    flights[1]["scheduled_departure"] = flights[1]["estimated_departure"] = None
    state = await run_chain(flights)
    risk = state.risk_analysis

    assert risk["connection_score"] is None
    assert risk["components"]["connection"]["status"] == "missing"
    assert risk["components"]["connection"]["details"]["connections"][0]["status"] == "UNAVAILABLE"
    assert risk["missing_data"] == ["connection"]
    assert risk["confidence_label"] != "high"
    assert any("Connection risk is unavailable" in line for line in risk["explanation"])
