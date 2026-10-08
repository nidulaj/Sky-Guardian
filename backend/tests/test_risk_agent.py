"""
Risk Agent: aggregation of Flight Agent + Connection Agent + Weather Agent outputs.

Inputs are built with the real upstream contracts: FlightResult (Flight Agent),
the real ConnectionAgent / evaluate_connection (Connection Agent) and
AirportWeatherResult (Weather Agent). Expected numbers use config/risk.yaml:
weights flight 0.40 / connection 0.35 / weather 0.25, levels 29 / 59 / 79.
"""
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from app.agents.connection_agent import ConnectionAgent, evaluate_connection
from app.agents.risk_agent import RiskAgent
from app.main import app
from app.orchestrator.graph import SupervisorOrchestrator
from app.orchestrator.state import JourneyState
from app.providers.weather import OpenMeteoWeatherProvider
from app.risk.config import RiskConfig, RiskWeights, get_risk_config
from app.schemas.flight import FlightResult
from app.schemas.journey import RiskSummary
from app.schemas.weather import AirportWeatherResult

BASE = datetime(2026, 10, 10, 6, 0, tzinfo=timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def flight(number, origin, destination, dep, arr, status="ON_TIME", delay=0):
    """A Flight Agent result for one leg (FlightResult contract)."""
    return FlightResult(
        flight_number=number, origin=origin, destination=destination,
        scheduled_departure=_iso(dep), estimated_departure=_iso(dep + timedelta(minutes=delay)),
        scheduled_arrival=_iso(arr), estimated_arrival=_iso(arr + timedelta(minutes=delay)),
        status=status, delay_minutes=delay, source="test", retrieved_at=_iso(BASE),
    ).model_dump()


def unknown_flight(number, origin, destination, reason="FLIGHT_DATA_UNAVAILABLE"):
    """What the Flight Agent returns when the provider fails (status UNKNOWN, delay defaults to 0)."""
    return FlightResult(
        flight_number=number, origin=origin, destination=destination, status="UNKNOWN",
        source="test", retrieved_at=_iso(BASE), reason_codes=[reason],
    ).model_dump()


def two_legs(delay=0, window=120, inbound_status=None, outbound_status="ON_TIME"):
    """CMB -> KUL -> NRT; `window` = minutes from UL001's expected arrival to XX123's departure."""
    inbound_status = inbound_status or ("DELAYED" if delay >= 15 else "ON_TIME")
    arrival = BASE + timedelta(hours=4)
    inbound = flight("UL001", "CMB", "KUL", BASE, arrival, inbound_status, delay)
    out_dep = arrival + timedelta(minutes=delay + window)
    outbound = flight("XX123", "KUL", "NRT", out_dep, out_dep + timedelta(hours=7), outbound_status)
    return [inbound, outbound]


def weather(airport, score, confidence=1.0, conditions=None):
    levels = get_risk_config().levels
    return AirportWeatherResult(
        airport=airport, status="available", weather_score=score, weather_risk=levels.level_for(score),
        conditions=conditions or [], source="test", confidence=confidence,
    ).model_dump(mode="json")


def weather_unavailable(airport, reason="Forecast unavailable for selected travel date."):
    return AirportWeatherResult(
        airport=airport, status="unavailable", source="Open-Meteo", confidence=0.0, warnings=[reason],
    ).model_dump(mode="json")


def legs_for(flights):
    return [{"flight_number": f.get("flight_number"), "travel_date": "2026-10-10",
             "origin": f.get("origin"), "destination": f.get("destination")}
            for f in flights if isinstance(f, dict)]


async def assess(flights, weather_results, connections=None):
    """Runs the real Connection Agent (unless connections are given), then the Risk Agent."""
    state = JourneyState(journey_legs=legs_for(flights), flight_results=flights, weather_results=weather_results)
    if connections is None:
        await ConnectionAgent().execute(state)
    else:
        state.connection_results = connections
    result = await RiskAgent().execute(state)
    return state.risk_analysis, result


def all_weather(score=40):
    return [weather("CMB", 0), weather("KUL", score), weather("NRT", 0)]


# ---------------------------------------------------------------------------
# 1. All three available
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_all_three_available():
    # Flight 45 (45 min delay), connection 70 (HIGH_RISK: 70 min vs MCT 60), weather 40
    risk, result = await assess(two_legs(delay=45, window=70), all_weather(40))

    assert (risk["flight_score"], risk["connection_score"], risk["weather_score"]) == (45, 70, 40)
    assert {n: c["status"] for n, c in risk["components"].items()} == {
        "flight": "available", "connection": "available", "weather": "available"}
    # 45*0.40 + 70*0.35 + 40*0.25 = 18 + 24.5 + 10 = 52.5 -> 53
    assert risk["weighted_score"] == 52.5
    assert risk["score"] == 53
    assert risk["level"] == "MODERATE"
    assert risk["status"] == "complete"
    assert risk["missing_data"] == []
    assert risk["confidence"] == 1.0 and risk["confidence_label"] == "high"
    assert risk["effective_weights"] == {"flight": 0.4, "connection": 0.35, "weather": 0.25}
    assert [f["component"] for f in risk["top_factors"]] == ["connection", "flight", "weather"]
    assert [f["contribution"] for f in risk["top_factors"]] == [24.5, 18.0, 10.0]
    assert risk["explanation"][0] == "Overall risk: moderate (53/100). This is a decision-support score, not a probability."
    assert result.status == "success"


# ---------------------------------------------------------------------------
# 2-7. Missing components: re-normalised weights, never 0
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_weather_unavailable():
    risk, result = await assess(two_legs(delay=45, window=70), [weather_unavailable(a) for a in ("CMB", "KUL", "NRT")])

    assert risk["weather_score"] is None
    assert risk["components"]["weather"]["status"] == "missing"
    assert "Forecast unavailable for selected travel date" in risk["components"]["weather"]["reason"]
    # (45*0.40 + 70*0.35) / (0.40 + 0.35) = 42.5 / 0.75 = 56.67 -> 57
    assert risk["score"] == 57
    assert risk["effective_weights"] == {"flight": 0.5333, "connection": 0.4667, "weather": 0.0}
    assert risk["missing_data"] == ["weather"]
    assert risk["status"] == "partial"
    assert risk["confidence"] == 0.75 and risk["confidence_label"] == "medium"
    assert any(line.startswith("Weather risk is unavailable") for line in risk["explanation"])
    assert result.status == "partial"


@pytest.mark.asyncio
async def test_flight_unavailable():
    timed = two_legs(delay=45, window=70)
    connections = [evaluate_connection(timed[0], timed[1], 60).model_dump()]  # HIGH_RISK, 70
    flights = [unknown_flight("UL001", "CMB", "KUL"), unknown_flight("XX123", "KUL", "NRT")]

    risk, _ = await assess(flights, all_weather(40), connections=connections)

    assert risk["flight_score"] is None
    assert risk["components"]["flight"]["status"] == "missing"
    assert "FLIGHT_DATA_UNAVAILABLE" in risk["components"]["flight"]["reason"]
    # (70*0.35 + 40*0.25) / 0.60 = 34.5 / 0.6 = 57.5 -> 58
    assert risk["score"] == 58
    assert risk["missing_data"] == ["flight"]
    assert risk["confidence"] == 0.6 and risk["confidence_label"] == "medium"


@pytest.mark.asyncio
async def test_connection_unavailable_from_connection_agent():
    flights = two_legs(delay=45)
    flights[1]["scheduled_departure"] = flights[1]["estimated_departure"] = None  # no onward time

    risk, _ = await assess(flights, all_weather(40))

    assert risk["connection_score"] is None
    assert risk["components"]["connection"]["status"] == "missing"
    assert "MISSING_TIMING_DATA" in risk["components"]["connection"]["reason"]
    # (45*0.40 + 40*0.25) / 0.65 = 28 / 0.65 = 43.08 -> 43
    assert risk["score"] == 43
    assert risk["level"] == "MODERATE"
    assert risk["missing_data"] == ["connection"]
    assert risk["confidence"] == 0.65


@pytest.mark.asyncio
async def test_flight_and_weather_available_but_no_connection_result():
    # Multi-leg journey but the Connection Agent produced nothing.
    risk, _ = await assess(two_legs(delay=45, window=70), all_weather(40), connections=[])

    assert risk["components"]["connection"]["status"] == "missing"
    assert risk["connection_score"] is None
    assert risk["score"] == 43
    assert risk["missing_data"] == ["connection"]


@pytest.mark.asyncio
async def test_flight_and_connection_available_but_no_weather_results():
    risk, _ = await assess(two_legs(delay=45, window=70), [])

    assert risk["components"]["weather"]["status"] == "missing"
    assert risk["components"]["weather"]["reason"] == "No weather data was provided for this journey."
    assert risk["score"] == 57
    assert risk["missing_data"] == ["weather"]


@pytest.mark.asyncio
async def test_only_one_component_available():
    flights = [unknown_flight("UL001", "CMB", "KUL"), unknown_flight("XX123", "KUL", "NRT")]
    risk, result = await assess(flights, all_weather(40))  # Connection Agent -> UNKNOWN

    assert risk["components"]["connection"]["status"] == "missing"
    assert risk["missing_data"] == ["flight", "connection"]
    assert risk["score"] == 40
    assert risk["effective_weights"] == {"flight": 0.0, "connection": 0.0, "weather": 1.0}
    assert risk["confidence"] == 0.25 and risk["confidence_label"] == "low"
    assert "Flight, Connection risk unavailable" in risk["uncertainty"][0]
    assert result.status == "partial"


@pytest.mark.asyncio
async def test_all_components_unavailable_has_no_score():
    flights = [unknown_flight("UL001", "CMB", "KUL"), unknown_flight("XX123", "KUL", "NRT")]
    risk, result = await assess(flights, [weather_unavailable("CMB"), weather_unavailable("NRT")])

    assert risk["score"] is None
    assert risk["level"] == "UNKNOWN"
    assert risk["status"] == "insufficient_data"
    assert (risk["flight_score"], risk["connection_score"], risk["weather_score"]) == (None, None, None)
    assert risk["confidence"] == 0.0 and risk["confidence_label"] == "unknown"
    assert risk["top_factors"] == []
    assert risk["explanation"][0].startswith("Overall risk: unknown.")
    assert result.status == "unavailable"


# ---------------------------------------------------------------------------
# 9-13. Severe component results
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_high_flight_risk():
    risk, _ = await assess(two_legs(delay=150, window=150), all_weather(0))
    flight_c = risk["components"]["flight"]
    assert flight_c["score"] == 95 and flight_c["level"] == "VERY_HIGH"
    assert flight_c["reason"] == "UL001 is delayed by 150 minutes."
    assert risk["top_factors"][0]["component"] == "flight"
    # 95*0.40 + 10*0.35 + 0 = 41.5 -> 42
    assert risk["score"] == 42


@pytest.mark.asyncio
async def test_high_connection_risk():
    risk, _ = await assess(two_legs(delay=0, window=30), all_weather(0))
    conn = risk["components"]["connection"]
    assert conn["score"] == 90 and conn["level"] == "VERY_HIGH"
    assert conn["details"]["connection_statuses"] == {"KUL": "LIKELY_MISSED"}
    assert "30 minutes between UL001 arriving and XX123 departing, against a 60-minute minimum" in conn["reason"]
    assert risk["top_factors"][0]["component"] == "connection"
    # 0*0.40 + 90*0.35 + 0*0.25 = 31.5 -> 32
    assert risk["score"] == 32


@pytest.mark.asyncio
async def test_high_weather_risk_uses_weather_agent_score():
    w = [weather("CMB", 5), weather("KUL", 85, conditions=["Active thunderstorms", "Heavy rainfall (9 mm/h)"])]
    risk, _ = await assess(two_legs(delay=0, window=120), w)
    wc = risk["components"]["weather"]
    assert wc["score"] == 85 and wc["level"] == "VERY_HIGH"
    assert wc["reason"] == "Highest airport weather risk: KUL (Active thunderstorms, Heavy rainfall (9 mm/h))"
    assert risk["top_factors"][0]["component"] == "weather"
    # 0*0.40 + 10*0.35 + 85*0.25 = 24.75 -> 25
    assert risk["score"] == 25


@pytest.mark.asyncio
async def test_cancelled_flight_cannot_be_low():
    risk, _ = await assess(two_legs(inbound_status="CANCELLED"), all_weather(0))

    assert risk["components"]["flight"]["score"] == 100
    assert risk["components"]["connection"]["details"]["connection_statuses"] == {"KUL": "MISSED"}
    assert "UL001 is cancelled" in risk["components"]["connection"]["reason"]
    # 100*0.40 + 100*0.35 + 0 = 75, raised to the cancelled-flight minimum of 90
    assert risk["weighted_score"] == 75.0
    assert risk["score"] == 90
    assert risk["level"] == "VERY_HIGH"
    assert risk["top_factors"][0]["factor"] == "Flight cancellation"
    assert "cancelled" in risk["applied_overrides"][0]


@pytest.mark.asyncio
async def test_cancelled_direct_flight_with_clear_weather():
    arrival = BASE + timedelta(hours=12)
    flights = [flight("UL504", "CMB", "LHR", BASE, arrival, status="CANCELLED")]
    risk, _ = await assess(flights, [weather("CMB", 0), weather("LHR", 0)])

    assert risk["components"]["connection"]["status"] == "not_applicable"
    assert risk["connection_score"] is None
    assert risk["missing_data"] == []
    assert risk["score"] == 90 and risk["level"] == "VERY_HIGH"


@pytest.mark.asyncio
async def test_impossible_connection():
    # UL001 lands 90 min late; XX123 leaves 40 min before it arrives.
    risk, _ = await assess(two_legs(delay=90, window=-40), all_weather(0))
    conn = risk["components"]["connection"]
    assert conn["score"] == 100
    assert conn["details"]["connection_statuses"] == {"KUL": "MISSED"}
    assert "XX123 is due to leave 40 minutes before UL001 arrives" in conn["reason"]
    # 65*0.40 + 100*0.35 + 0 = 61, raised to the impossible-connection minimum of 80
    assert risk["weighted_score"] == 61.0
    assert risk["score"] == 80 and risk["level"] == "VERY_HIGH"
    assert len(risk["applied_overrides"]) == 1


# ---------------------------------------------------------------------------
# 14-17. Thresholds, weights, missing != 0, not a probability
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@pytest.mark.parametrize("score,level", [
    (0, "LOW"), (29, "LOW"), (30, "MODERATE"), (59, "MODERATE"),
    (60, "HIGH"), (79, "HIGH"), (80, "VERY_HIGH"), (100, "VERY_HIGH"),
])
async def test_risk_level_boundaries(score, level):
    # Only weather is available, so the journey score equals the weather score.
    flights = [unknown_flight("UL001", "CMB", "KUL"), unknown_flight("XX123", "KUL", "NRT")]
    risk, _ = await assess(flights, [weather("KUL", score)])
    assert risk["score"] == score
    assert risk["level"] == level
    assert risk["level_thresholds"] == {"low_max": 29, "moderate_max": 59, "high_max": 79}


@pytest.mark.asyncio
async def test_weights_come_from_configuration():
    assert get_risk_config().weights.as_dict() == {"flight": 0.40, "connection": 0.35, "weather": 0.25}

    custom = RiskConfig(weights=RiskWeights(flight=0.5, connection=0.3, weather=0.2))
    state = JourneyState(flight_results=two_legs(delay=45, window=70), weather_results=all_weather(40))
    await ConnectionAgent().execute(state)
    await RiskAgent(risk_config=custom).execute(state)
    # 45*0.5 + 70*0.3 + 40*0.2 = 22.5 + 21 + 8 = 51.5 -> 52
    assert state.risk_analysis["weights"] == {"flight": 0.5, "connection": 0.3, "weather": 0.2}
    assert state.risk_analysis["score"] == 52


def test_weights_must_sum_to_one():
    with pytest.raises(ValidationError):
        RiskWeights(flight=0.5, connection=0.5, weather=0.25)


@pytest.mark.asyncio
async def test_missing_data_never_becomes_zero():
    # An UNKNOWN flight carries delay_minutes=0 and an UNKNOWN connection carries 0 minutes;
    # neither may be scored as "no delay" or "zero-minute connection".
    flights = [two_legs(delay=45, window=70)[0], unknown_flight("XX123", "KUL", "NRT")]
    risk, _ = await assess(flights, [weather_unavailable("KUL")])

    assert risk["components"]["flight"]["score"] == 45  # only UL001 is scored
    assert risk["components"]["flight"]["details"]["legs_unavailable"] == {"XX123": "FLIGHT_DATA_UNAVAILABLE"}
    assert risk["components"]["flight"]["confidence"] == 0.5
    assert risk["connection_score"] is None
    assert risk["weather_score"] is None
    # With zeros the score would be 45*0.40 = 18; with missing data it is the flight score alone.
    assert risk["score"] == 45
    assert risk["confidence"] == 0.2  # 0.40 * 0.5


@pytest.mark.asyncio
@pytest.mark.parametrize("flights,weather_results", [
    (two_legs(delay=45, window=70), all_weather(40)),
    (two_legs(inbound_status="CANCELLED"), all_weather(0)),
    ([unknown_flight("UL001", "CMB", "KUL")], []),
])
async def test_is_probability_is_always_false(flights, weather_results):
    risk, _ = await assess(flights, weather_results)
    assert risk["is_probability"] is False


def test_risk_summary_rejects_probability():
    with pytest.raises(ValidationError):
        RiskSummary(score=50, level="MODERATE", is_probability=True)


# ---------------------------------------------------------------------------
# Robustness and integration
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_same_input_gives_same_result():
    flights, w = two_legs(delay=90, window=-40), all_weather(68)
    first, _ = await assess(flights, w)
    second, _ = await assess(flights, w)
    assert first == second


@pytest.mark.asyncio
async def test_invalid_agent_results_are_treated_as_missing():
    flights = [
        {"flight_number": "UL001", "status": "BOGUS", "delay_minutes": 90},
        {"flight_number": "XX123", "status": "DELAYED", "delay_minutes": "90"},
        {"flight_number": "AB1", "status": "DELAYED", "delay_minutes": -5},
        {"status": "DELAYED", "delay_minutes": 99999},
    ]
    connections = [{"connection_index": 0, "airport": "KUL", "status": "WHATEVER"}, {"connection_index": 1, "status": None}]
    weather_results = [{"airport": "KUL", "status": "available", "weather_score": 250}, {"airport": "NRT", "weather_score": True}]

    risk, result = await assess(flights, weather_results, connections=connections)

    assert risk["score"] is None and risk["level"] == "UNKNOWN"
    assert risk["components"]["flight"]["details"]["legs_unavailable"] == {
        "UL001": "unrecognised flight status", "XX123": "invalid delay_minutes",
        "AB1": "invalid delay_minutes", "leg 4": "invalid delay_minutes",
    }
    assert set(risk["components"]["connection"]["details"]["connections_unavailable"]) == {"KUL", "connection 2", "connection 3"}
    assert any("Flight status unavailable for UL001" in w for w in risk["warnings"])
    assert result.status == "unavailable"


@pytest.mark.asyncio
async def test_upstream_weather_warnings_are_kept():
    w = [weather("KUL", 60), weather_unavailable("NRT", "Airport NRT forecast timed out.")]
    risk, _ = await assess(two_legs(), w)
    assert "Airport NRT forecast timed out." in risk["warnings"]
    assert any("Weather unavailable for NRT" in u for u in risk["uncertainty"])


@pytest.mark.asyncio
async def test_orchestrator_runs_risk_after_upstream_agents():
    state = JourneyState(journey_legs=[
        {"flight_number": "UL001", "travel_date": "2026-10-10", "origin": "CMB", "destination": "KUL"},
        {"flight_number": "XX123", "travel_date": "2026-10-10", "origin": "KUL", "destination": "NRT"},
    ])
    final = await SupervisorOrchestrator().run_workflow(state)
    risk = final.risk_analysis
    assert final.workflow_status == "COMPLETED"
    assert risk["components"]["flight"]["details"]["flight_statuses"] == {"UL001": "DELAYED", "XX123": "ON_TIME"}
    assert risk["components"]["connection"]["details"]["connection_statuses"] == {"KUL": "LIKELY_MISSED"}
    assert risk["flight_score"] == 65 and risk["connection_score"] == 90
    assert final.alternative_options  # connection at risk -> recovery path ran


@pytest.mark.asyncio
async def test_journey_api_reports_unknown_risk_when_nothing_is_available(monkeypatch):
    from app.api import journeys

    def refuse(request):
        raise httpx.ConnectError("refused")
    monkeypatch.setattr(journeys.orchestrator.weather_agent, "provider",
                        OpenMeteoWeatherProvider(transport=httpx.MockTransport(refuse)))

    payload = {"legs": [  # XX503 simulates a flight-data outage in the mock provider
        {"flight_number": "XX503", "travel_date": "2026-10-10", "origin": "CMB", "destination": "KUL"},
    ]}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/journeys/analyze", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["journey_status"] == "INSUFFICIENT_DATA"
    assert data["risk"]["score"] is None
    assert data["risk"]["level"] == "UNKNOWN"
    assert data["risk"]["components"]["connection"]["status"] == "not_applicable"
