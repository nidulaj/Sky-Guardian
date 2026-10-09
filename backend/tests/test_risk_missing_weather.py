"""Risk Agent + journey API behaviour when weather data is missing or partial."""
from datetime import date, timedelta

import httpx
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.agents.risk_agent import RiskAgent
from app.main import app
from app.orchestrator.state import JourneyState
from app.providers.weather import MockWeatherProvider, OpenMeteoWeatherProvider

# Flight 65 (90 min delay, config/risk.yaml flight band), connection 100 (MISSED).
# A MISSED connection sets a minimum journey score of 80 (overrides.impossible_connection_min_score).
FLIGHTS = [{"status": "DELAYED", "delay_minutes": 90}]
CONNECTIONS = [{"status": "MISSED"}]


def unavailable(airport: str, reason: str = "Forecast unavailable for selected travel date: x is in the past."):
    return {"airport": airport, "status": "unavailable", "weather_score": None, "confidence": 0.0, "warnings": [reason]}


def available(airport: str, score: int, confidence: float = 0.75):
    return {"airport": airport, "status": "available", "weather_score": score, "weather_risk_score": score,
            "confidence": confidence, "warnings": []}


async def run_risk(weather_results):
    state = JourneyState(flight_results=FLIGHTS, connection_results=CONNECTIONS, weather_results=weather_results)
    result = await RiskAgent().execute(state)
    return state.risk_analysis, result


@pytest.mark.asyncio
async def test_all_weather_unavailable_is_missing_not_a_default_score():
    risk, result = await run_risk([unavailable("CMB"), unavailable("KUL"), unavailable("NRT")])

    assert risk["weather_score"] is None
    weather = risk["components"]["weather"]
    assert weather["status"] == "missing"
    assert weather["score"] is None
    assert weather["confidence"] == 0.0
    assert "CMB, KUL, NRT" in weather["reason"]
    assert "Forecast unavailable for selected travel date" in weather["reason"]
    assert risk["missing_data"] == ["weather"]
    assert risk["status"] == "partial"

    # Score = available components with re-normalised weights: (65*0.40 + 100*0.35) / 0.75 = 81.33 -> 81
    assert risk["effective_weights"] == {"flight": 0.5333, "connection": 0.4667, "weather": 0.0}
    assert risk["score"] == 81
    assert risk["weighted_score"] == 81.33
    assert risk["applied_overrides"] == []
    assert risk["level"] == "VERY_HIGH"

    # Confidence loses the weather weight: 0.40*1 + 0.35*1 + 0.25*0 = 0.75
    assert risk["confidence"] == 0.75
    assert risk["confidence_label"] == "medium"
    assert result.status == "partial"
    assert result.confidence == "medium"

    # The possible range is stated: weather 0 -> 61, weather 100 -> 86; the missed-connection minimum lifts 61 to 80.
    assert "could be 80-86" in risk["uncertainty"][0]


@pytest.mark.asyncio
async def test_no_weather_results_at_all_is_missing():
    risk, _ = await run_risk([])
    assert risk["weather_score"] is None
    assert risk["components"]["weather"]["status"] == "missing"
    assert risk["components"]["weather"]["reason"] == "No weather data was provided for this journey."


@pytest.mark.asyncio
async def test_all_weather_available_keeps_original_formula():
    risk, result = await run_risk([available("CMB", 5), available("KUL", 60), available("NRT", 0)])
    # 65*0.40 + 100*0.35 + 60*0.25 = 76, raised to the missed-connection minimum of 80
    assert risk["weighted_score"] == 76.0
    assert risk["score"] == 80
    assert len(risk["applied_overrides"]) == 1
    assert risk["weather_score"] == 60
    assert risk["effective_weights"] == {"flight": 0.4, "connection": 0.35, "weather": 0.25}
    assert risk["components"]["weather"]["status"] == "available"
    assert risk["components"]["weather"]["reason"] == "Highest airport weather risk: KUL"
    assert risk["missing_data"] == []
    assert risk["status"] == "complete"
    # Only the note that the 90-minute delay is an estimate; nothing is missing.
    assert risk["uncertainty"] == ["The delay for leg 1 is the current estimate and may change."]
    assert result.status == "success"


@pytest.mark.asyncio
async def test_partial_weather_scores_available_airports_and_reduces_confidence():
    risk, _ = await run_risk([available("CMB", 20, confidence=0.75), unavailable("ZZZ", "Airport ZZZ is not in the airport coordinate table.")])
    weather = risk["components"]["weather"]
    assert weather["status"] == "available"
    assert weather["score"] == 20
    assert weather["confidence"] == 0.38  # 0.75 * 1/2 airports covered
    assert weather["details"]["airports_unavailable"] == {"ZZZ": "Airport ZZZ is not in the airport coordinate table."}
    assert any("Weather unavailable for ZZZ" in u for u in risk["uncertainty"])
    assert risk["missing_data"] == []


@pytest.mark.asyncio
async def test_legacy_weather_risk_score_still_supported():
    risk, _ = await run_risk([{"weather_risk_score": 60}])
    assert risk["weather_score"] == 60
    assert risk["components"]["weather"]["status"] == "available"


# ---------------------------------------------------------------------------
# Journey API end to end
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.fixture
def journey_weather_provider(monkeypatch):
    from app.api import journeys

    def _use(provider):
        monkeypatch.setattr(journeys.orchestrator.weather_agent, "provider", provider)
    return _use


def legs(travel_date: str, destination: str = "NRT", second_flight: str = "XX123"):
    return {"legs": [
        {"flight_number": "UL001", "travel_date": travel_date, "origin": "CMB", "destination": "KUL"},
        {"flight_number": second_flight, "travel_date": travel_date, "origin": "KUL", "destination": destination},
    ]}


@pytest.mark.asyncio
async def test_journey_api_weather_available(client, journey_weather_provider):
    journey_weather_provider(MockWeatherProvider())
    response = await client.post("/api/journeys/analyze", json=legs(date.today().isoformat()))
    assert response.status_code == 200
    risk = response.json()["risk"]
    assert risk["weather_score"] == 60
    assert risk["components"]["weather"]["status"] == "available"
    assert risk["status"] == "complete"
    assert risk["missing_data"] == []


@pytest.mark.asyncio
async def test_journey_api_weather_unavailable_has_no_fake_score(client, journey_weather_provider):
    def handler(request):
        raise httpx.ConnectError("refused")
    journey_weather_provider(OpenMeteoWeatherProvider(transport=httpx.MockTransport(handler)))

    response = await client.post("/api/journeys/analyze", json=legs(date.today().isoformat()))
    assert response.status_code == 200
    data = response.json()
    risk = data["risk"]
    assert risk["weather_score"] is None
    assert risk["components"]["weather"]["status"] == "missing"
    assert "Could not reach Open-Meteo" in risk["components"]["weather"]["reason"]
    assert risk["missing_data"] == ["weather"]
    assert risk["confidence_label"] == "medium"
    assert all(w["status"] == "unavailable" for w in data["weather_conditions"])
    assert all("weather_risk_score" not in w for w in data["weather_conditions"])


@pytest.mark.asyncio
async def test_journey_api_travel_date_passed_to_flights(client, journey_weather_provider):
    journey_weather_provider(MockWeatherProvider())
    travel = (date.today() + timedelta(days=3)).isoformat()
    data = (await client.post("/api/journeys/analyze", json=legs(travel))).json()
    assert data["flight_statuses"][0]["scheduled_departure"].startswith(travel)
    windows = [w["forecast_window"] for w in data["weather_conditions"]]
    assert all(travel in w or (date.fromisoformat(travel) + timedelta(days=1)).isoformat() in w for w in windows)


@pytest.mark.asyncio
async def test_journey_api_unknown_airport_partial_weather(client, journey_weather_provider):
    journey_weather_provider(MockWeatherProvider())
    data = (await client.post("/api/journeys/analyze", json=legs(date.today().isoformat(), destination="ZZZ", second_flight="AB999"))).json()
    zzz = next(w for w in data["weather_conditions"] if w["airport"] == "ZZZ")
    assert zzz["status"] == "unavailable"
    assert "not in the airport coordinate table" in zzz["warnings"][0]
    assert data["risk"]["components"]["weather"]["status"] == "available"
    assert any("ZZZ" in u for u in data["risk"]["uncertainty"])
