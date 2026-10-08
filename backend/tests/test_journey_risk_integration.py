"""
End-to-end integration: Flight Agent -> Connection Agent -> Weather Agent -> Risk Agent,
run through the real SupervisorOrchestrator.

Only the data sources are replaced, and only here in the tests: a FlightDataProvider that
returns controlled FlightResults (live / timetable) or raises the provider errors the
Flight Agent already handles, and the existing MockWeatherProvider or an Open-Meteo client
whose network calls are refused. The agents themselves are the production ones.
"""
from datetime import date, datetime, timedelta, timezone
from typing import Dict, Optional

import httpx
import pytest

from app.agents.flight_agent import FlightAgent
from app.agents.weather_agent import WeatherAgent
from app.orchestrator.graph import SupervisorOrchestrator
from app.orchestrator.state import JourneyState
from app.providers.flight.base import FlightDataProvider, FlightDataUnavailableError
from app.providers.flight.mock import MockFlightProvider
from app.providers.weather import MockWeatherProvider, OpenMeteoWeatherProvider
from app.risk.config import get_risk_config
from app.schemas.flight import FlightResult

TODAY = date.today()
BASE = datetime(TODAY.year, TODAY.month, TODAY.day, 6, 0, tzinfo=timezone.utc)
CFG = get_risk_config()


def _iso(dt: Optional[datetime]) -> Optional[str]:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ") if dt else None


class StubFlightProvider(FlightDataProvider):
    """Test-only provider: returns the FlightResult registered for a flight number, else an outage."""
    name = "StubFlightProvider"

    def __init__(self, flights: Dict[str, FlightResult]):
        self.flights = flights

    async def get_flight_status(self, flight_number, travel_date, origin, destination):
        if flight_number not in self.flights:
            raise FlightDataUnavailableError("stub outage")
        return self.flights[flight_number].model_copy()


def flight(number, origin, destination, dep, arr, *, delay=0, data_mode="live", status=None):
    live = data_mode == "live"
    return FlightResult(
        flight_number=number, airline="Test Air", origin=origin, destination=destination,
        scheduled_departure=_iso(dep), scheduled_arrival=_iso(arr),
        estimated_departure=_iso(dep + timedelta(minutes=delay)) if live else None,
        estimated_arrival=_iso(arr + timedelta(minutes=delay)) if live else None,
        status=status or ("DELAYED" if delay >= 15 else "SCHEDULED" if not live else "ON_TIME"),
        delay_minutes=delay, source=f"Test ({data_mode})", retrieved_at=_iso(BASE),
        reason_codes=[] if live else ["TIMETABLE_ONLY"], data_mode=data_mode,
    )


def two_legs(transfer="KUL", destination="NRT", delay=0, window=150, data_mode="live"):
    """Leg 1 CMB->transfer, leg 2 transfer->destination; `window` = minutes from expected arrival to departure."""
    arr = BASE + timedelta(hours=4)
    dep2 = arr + timedelta(minutes=delay + window)
    return {
        "UL001": flight("UL001", "CMB", transfer, BASE, arr, delay=delay, data_mode=data_mode),
        "XX123": flight("XX123", transfer, destination, dep2, dep2 + timedelta(hours=7), data_mode=data_mode),
    }


def refused_weather():
    def refuse(request):
        raise httpx.ConnectError("refused")
    return OpenMeteoWeatherProvider(transport=httpx.MockTransport(refuse))


async def run(flights: Dict[str, FlightResult], weather_provider=None, transfer="KUL", destination="NRT", flight_provider=None):
    orchestrator = SupervisorOrchestrator()
    orchestrator.flight_agent = FlightAgent(provider=flight_provider or StubFlightProvider(flights))
    orchestrator.weather_agent = WeatherAgent(provider=weather_provider or MockWeatherProvider())
    state = JourneyState(journey_legs=[
        {"flight_number": "UL001", "travel_date": TODAY.isoformat(), "origin": "CMB", "destination": transfer},
        {"flight_number": "XX123", "travel_date": TODAY.isoformat(), "origin": transfer, "destination": destination},
    ])
    return await orchestrator.run_workflow(state)


def expected(flight_s, conn_s, weather_s):
    w = CFG.weights
    return flight_s * w.flight + conn_s * w.connection + weather_s * w.weather


# ---------------------------------------------------------------------------
# Test 1 - all three agents available
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_all_agents_available_uses_configured_weights():
    state = await run(two_legs(delay=90, window=30))
    risk = state.risk_analysis

    # Each component comes from its agent's own result.
    assert state.flight_results[0]["status"] == "DELAYED" and state.flight_results[0]["delay_minutes"] == 90
    assert state.connection_results[0]["status"] == "LIKELY_MISSED"
    assert max(w["weather_score"] for w in state.weather_results if w["status"] == "available") == 60

    assert (risk["flight_score"], risk["connection_score"], risk["weather_score"]) == (65, 90, 60)
    assert risk["weights"] == CFG.weights.as_dict()
    assert risk["weighted_score"] == round(expected(65, 90, 60), 2)
    assert risk["score"] == 73
    assert risk["level"] == CFG.levels.level_for(73) == "HIGH"
    assert risk["status"] == "complete"
    assert risk["confidence_label"] == "high"
    assert risk["is_probability"] is False


# ---------------------------------------------------------------------------
# Test 2 - weather unavailable
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_weather_unavailable_is_not_zero_and_reduces_confidence():
    state = await run(two_legs(delay=90, window=30), weather_provider=refused_weather())
    risk = state.risk_analysis

    assert all(w["status"] == "unavailable" for w in state.weather_results)
    assert risk["weather_score"] is None
    assert risk["missing_data"] == ["weather"]
    w = CFG.weights
    assert risk["weighted_score"] == round((65 * w.flight + 90 * w.connection) / (w.flight + w.connection), 2)
    assert risk["score"] == 77
    assert risk["confidence"] == round(w.flight + w.connection, 2)
    assert risk["confidence_label"] == "medium"
    assert any(line.startswith("Weather risk is unavailable") for line in risk["explanation"])


# ---------------------------------------------------------------------------
# Test 3 - connection high risk reaches the Risk Agent
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_high_connection_risk_raises_overall_risk():
    safe = (await run(two_legs(window=150))).risk_analysis
    tight = (await run(two_legs(window=30))).risk_analysis

    assert safe["components"]["connection"]["details"]["connections"][0]["status"] == "SAFE"
    assert tight["components"]["connection"]["details"]["connections"][0]["status"] == "LIKELY_MISSED"
    assert (safe["connection_score"], tight["connection_score"]) == (10, 90)
    assert tight["score"] > safe["score"]
    assert tight["top_factors"][0]["component"] == "connection"


# ---------------------------------------------------------------------------
# Test 4 - flight information unavailable
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_flight_agent_outage_is_missing_not_zero():
    state = await run({})  # provider outage for every leg
    risk = state.risk_analysis

    assert all(f["status"] == "UNKNOWN" for f in state.flight_results)
    assert risk["flight_score"] is None
    assert risk["components"]["flight"]["status"] == "missing"
    assert "FLIGHT_DATA_UNAVAILABLE" in risk["components"]["flight"]["reason"]


@pytest.mark.asyncio
async def test_timetable_only_flights_are_not_scored_as_on_time():
    # Published timetable: Savi's providers return status SCHEDULED with delay 0 and data_mode "timetable".
    state = await run(two_legs(window=150, data_mode="timetable"))
    risk = state.risk_analysis

    assert all(f["data_mode"] == "timetable" for f in state.flight_results)
    flight_c = risk["components"]["flight"]
    assert flight_c["status"] == "missing" and risk["flight_score"] is None
    assert "published timetable only" in flight_c["reason"]
    assert flight_c["details"]["data_modes"] == {"UL001": "timetable", "XX123": "timetable"}

    # The planned connection window is still assessed, with reduced confidence.
    assert risk["connection_score"] == 10
    assert risk["components"]["connection"]["confidence"] == CFG.confidence.estimated_times_factor
    assert any("published schedules" in u for u in risk["uncertainty"])

    # Normalised over the available components: connection + weather.
    w = CFG.weights
    assert risk["weighted_score"] == round((10 * w.connection + 60 * w.weather) / (w.connection + w.weather), 2)
    assert risk["missing_data"] == ["flight"]
    assert risk["confidence_label"] != "high"


# ---------------------------------------------------------------------------
# Test 5 - everything unavailable
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_all_unavailable_gives_no_score():
    state = await run({}, weather_provider=refused_weather())
    risk = state.risk_analysis

    assert risk["score"] is None
    assert risk["level"] == "UNKNOWN"
    assert risk["status"] == "insufficient_data"
    assert risk["confidence"] == 0.0 and risk["confidence_label"] == "unknown"
    assert (risk["flight_score"], risk["connection_score"], risk["weather_score"]) == (None, None, None)
    assert "could not assess" in state.recommendation_text
    assert state.alternative_options == []


# ---------------------------------------------------------------------------
# Test 6 - normal safe journey
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_safe_journey_is_low_risk():
    state = await run(two_legs(transfer="SIN", window=150), transfer="SIN")
    risk = state.risk_analysis

    assert state.connection_results[0]["status"] == "SAFE"
    assert risk["score"] == 4 and risk["level"] == "LOW"
    assert risk["applied_overrides"] == []
    assert state.alternative_options == []  # recovery path not triggered


# ---------------------------------------------------------------------------
# Data provenance from the agents
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_demo_flight_data_lowers_confidence_and_is_flagged():
    state = await run({}, flight_provider=MockFlightProvider())
    risk = state.risk_analysis

    assert all(f["data_mode"] == "demo" for f in state.flight_results)
    assert risk["components"]["flight"]["confidence"] == CFG.confidence.mock_data_factor
    assert risk["components"]["connection"]["confidence"] == CFG.confidence.mock_data_factor
    assert risk["confidence_label"] != "high"
    assert state.is_demo_data is True
    flight_sources = [s for s in state.sources if s["type"] == "Aviation Data"]
    assert flight_sources == [{"name": "MockFlightProvider (Demo Data)", "type": "Aviation Data", "verified": False}]


@pytest.mark.asyncio
async def test_live_flight_sources_come_from_the_flight_agent():
    state = await run(two_legs(window=150))
    names = {s["name"]: s["verified"] for s in state.sources}
    assert names["Test (live)"] is True
    assert names["MockWeatherProvider"] is False  # weather is still demo data here
    assert "MockFlightProvider" not in names
    assert state.is_demo_data is True  # because the weather is mock
