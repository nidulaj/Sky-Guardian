"""Weather Agent tests: airports, WMO codes, providers, agent, scoring integration, API."""
import json
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.agents.risk_agent import RiskAgent
from app.agents.weather_agent import WeatherAgent
from app.airports import AIRPORTS, get_airport
from app.main import app
from app.orchestrator.state import JourneyState
from app.providers.weather import (
    ForecastTimeUnavailable,
    MockWeatherProvider,
    OpenMeteoWeatherProvider,
    WeatherDataProvider,
    WeatherProviderError,
    get_weather_provider,
)
from app.providers.weather.open_meteo import HOURLY_VARIABLES
from app.providers.weather.weather_codes import describe_weather_code, snow_ice_state, thunderstorm_state
from app.risk.config import RiskConfig, get_risk_config
from app.risk.weather_scoring import score_weather
from app.schemas.weather import WeatherObservation

CMB = get_airport("CMB")
COLOMBO_OFFSET = 19800  # +05:30


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def open_meteo_payload(hours: int = 48, offset: int = COLOMBO_OFFSET, start: str = "2026-10-06T00:00", **series):
    """An Open-Meteo hourly response; each variable defaults to a constant series."""
    base = datetime.fromisoformat(start)
    defaults = {
        "temperature_2m": 27.0,
        "precipitation": 0.0,
        "weather_code": 2,
        "visibility": 10000.0,
        "wind_speed_10m": 8.0,
        "wind_gusts_10m": 14.0,
    }
    hourly = {"time": [(base + timedelta(hours=h)).strftime("%Y-%m-%dT%H:%M") for h in range(hours)]}
    for var, default in defaults.items():
        value = series.get(var, default)
        hourly[var] = value if isinstance(value, list) else [value] * hours
    return {"latitude": 7.2, "longitude": 79.9, "utc_offset_seconds": offset, "timezone": "Asia/Colombo", "hourly": hourly}


def provider_for(handler) -> OpenMeteoWeatherProvider:
    return OpenMeteoWeatherProvider(transport=httpx.MockTransport(handler), cache_ttl_seconds=600)


def json_handler(payload, status: int = 200, calls: Optional[list] = None):
    def handler(request: httpx.Request) -> httpx.Response:
        if calls is not None:
            calls.append(request)
        return httpx.Response(status, json=payload)
    return handler


def raising_handler(exc: Exception):
    def handler(request: httpx.Request) -> httpx.Response:
        raise exc
    return handler


class FailingProvider(WeatherDataProvider):
    name = "FailingProvider"

    async def get_observation(self, airport, target_time=None):
        raise WeatherProviderError(f"Could not reach Open-Meteo for {airport.code}.")


LEGS = [
    {"flight_number": "UL001", "travel_date": "2026-09-15", "origin": "CMB", "destination": "KUL"},
    {"flight_number": "XX123", "travel_date": "2026-09-15", "origin": "KUL", "destination": "NRT"},
]


# ---------------------------------------------------------------------------
# Airport coordinates
# ---------------------------------------------------------------------------

def test_airport_lookup_is_case_insensitive_and_includes_cmb():
    airport = get_airport(" cmb ")
    assert airport is not None
    assert airport.code == "CMB"
    assert airport.latitude == pytest.approx(7.18, abs=0.01)
    assert airport.longitude == pytest.approx(79.88, abs=0.01)


def test_airport_lookup_unknown_returns_none():
    assert get_airport("ZZZ") is None
    assert get_airport("") is None
    assert get_airport(None) is None


def test_demo_airports_have_coordinates():
    for code in ("CMB", "KUL", "NRT", "HND"):
        assert code in AIRPORTS


# ---------------------------------------------------------------------------
# WMO weather codes
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("code,text", [
    (0, "Clear sky"), (1, "Mainly clear"), (2, "Partly cloudy"), (3, "Overcast"),
    (51, "Light drizzle"), (53, "Moderate drizzle"), (55, "Heavy drizzle"),
    (61, "Slight rain"), (63, "Moderate rain"), (65, "Heavy rain"),
    (71, "Slight snowfall"), (73, "Moderate snowfall"), (75, "Heavy snowfall"),
    (80, "Slight rain showers"), (81, "Moderate rain showers"), (82, "Violent rain showers"),
    (95, "Thunderstorm"),
])
def test_weather_code_descriptions(code, text):
    assert describe_weather_code(code) == text


def test_weather_code_unknown_and_missing():
    assert describe_weather_code(42) == "Unknown weather code (42)"
    assert describe_weather_code(None) is None
    assert thunderstorm_state(None) is None
    assert snow_ice_state(None) is None


def test_weather_code_hazard_states():
    assert thunderstorm_state(95) == "ACTIVE"
    assert thunderstorm_state(99) == "ACTIVE"
    assert thunderstorm_state(61) == "NONE"
    assert snow_ice_state(66) == "FREEZING"
    assert snow_ice_state(75) == "HEAVY"
    assert snow_ice_state(71) == "LIGHT"
    assert snow_ice_state(0) == "NONE"


# ---------------------------------------------------------------------------
# Provider selection + MockWeatherProvider
# ---------------------------------------------------------------------------

def test_provider_factory():
    assert isinstance(get_weather_provider("mock"), MockWeatherProvider)
    assert isinstance(get_weather_provider("open_meteo"), OpenMeteoWeatherProvider)
    assert get_weather_provider("open-meteo") is get_weather_provider("open_meteo")
    with pytest.raises(ValueError):
        get_weather_provider("not-a-provider")


@pytest.mark.asyncio
async def test_mock_provider_returns_valid_observations():
    provider = MockWeatherProvider()
    kul = await provider.get_observation(get_airport("KUL"))
    assert isinstance(kul, WeatherObservation)
    assert kul.is_mock is True
    assert kul.thunderstorm == "ACTIVE"
    assert kul.condition_text == "Thunderstorm"

    target = datetime(2026, 9, 15, 10, 25, tzinfo=timezone.utc)
    cmb = await provider.get_observation(CMB, target)
    assert cmb.forecast_time == datetime(2026, 9, 15, 10, 0, tzinfo=timezone.utc)


@pytest.mark.asyncio
async def test_mock_kul_keeps_demo_weather_score():
    """The demo journey (and its existing tests) rely on KUL scoring 60."""
    obs = await MockWeatherProvider().get_observation(get_airport("KUL"))
    assessment = score_weather(obs, get_risk_config())
    assert assessment.score == 60
    assert assessment.factors.thunderstorm is True


# ---------------------------------------------------------------------------
# OpenMeteoWeatherProvider
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_open_meteo_request_parameters():
    calls = []
    provider = provider_for(json_handler(open_meteo_payload(), calls=calls))
    await provider.get_observation(CMB, datetime(2026, 10, 6, 6, 0, tzinfo=timezone.utc))

    params = calls[0].url.params
    assert params["latitude"] == "7.1808"
    assert params["longitude"] == "79.8841"
    assert params["hourly"].split(",") == HOURLY_VARIABLES
    assert set(HOURLY_VARIABLES) == {
        "temperature_2m", "precipitation", "weather_code", "visibility", "wind_speed_10m", "wind_gusts_10m",
    }
    assert params["timezone"] == "auto"
    assert params["timeformat"] == "iso8601"
    assert params["wind_speed_unit"] == "kn"
    assert params["temperature_unit"] == "celsius"
    assert params["precipitation_unit"] == "mm"
    assert "daily" not in params and "current" not in params
    assert "apikey" not in params


@pytest.mark.asyncio
async def test_open_meteo_converts_nearest_hour_to_observation():
    hours = 48
    payload = open_meteo_payload(
        hours=hours,
        temperature_2m=[20.0 + h for h in range(hours)],
        precipitation=[0.1 * h for h in range(hours)],
        weather_code=[95 if h == 14 else 2 for h in range(hours)],
        visibility=[8100.0] * hours,
        wind_speed_10m=[12.0] * hours,
        wind_gusts_10m=[18.0] * hours,
    )
    provider = provider_for(json_handler(payload))
    # 08:40 UTC = 14:10 in Colombo -> nearest forecast hour is 14:00 local (index 14).
    obs = await provider.get_observation(CMB, datetime(2026, 10, 6, 8, 40, tzinfo=timezone.utc))

    assert obs.airport == "CMB"
    assert obs.forecast_time == datetime(2026, 10, 6, 14, 0, tzinfo=timezone(timedelta(seconds=COLOMBO_OFFSET)))
    assert obs.temperature_c == 34.0
    assert obs.precipitation_mm_per_hr == pytest.approx(1.4)
    assert obs.visibility_km == 8.1  # metres -> km
    assert obs.wind_speed_kt == 12.0
    assert obs.wind_gust_kt == 18.0
    assert obs.weather_code == 95
    assert obs.condition_text == "Thunderstorm"
    assert obs.thunderstorm == "ACTIVE"
    assert obs.snow_ice == "NONE"
    assert obs.alerts is None  # Open-Meteo forecasts carry no official alerts
    assert obs.is_mock is False
    assert obs.source == "Open-Meteo"


@pytest.mark.asyncio
async def test_open_meteo_caches_forecast_per_airport():
    calls = []
    provider = provider_for(json_handler(open_meteo_payload(), calls=calls))
    t = datetime(2026, 10, 6, 6, 0, tzinfo=timezone.utc)
    await provider.get_observation(CMB, t)
    await provider.get_observation(CMB, t + timedelta(hours=5))
    assert len(calls) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("exc", [
    httpx.ReadTimeout("timed out"),
    httpx.ConnectTimeout("timed out"),
    httpx.ConnectError("connection refused"),
])
async def test_open_meteo_network_failures_raise_provider_error(exc):
    provider = provider_for(raising_handler(exc))
    with pytest.raises(WeatherProviderError) as info:
        await provider.get_observation(CMB)
    assert "CMB" in str(info.value)
    assert "Traceback" not in str(info.value)


@pytest.mark.asyncio
async def test_open_meteo_http_error_status():
    provider = provider_for(json_handler({"error": True, "reason": "boom"}, status=500))
    with pytest.raises(WeatherProviderError, match="HTTP 500"):
        await provider.get_observation(CMB)


@pytest.mark.asyncio
async def test_open_meteo_invalid_json():
    provider = provider_for(lambda request: httpx.Response(200, content=b"<html>not json</html>"))
    with pytest.raises(WeatherProviderError, match="invalid response"):
        await provider.get_observation(CMB)


@pytest.mark.asyncio
@pytest.mark.parametrize("payload", [
    {"utc_offset_seconds": 0},  # no hourly block
    {"hourly": {"time": ["2026-10-06T00:00"]}},  # no utc offset
    {"utc_offset_seconds": 0, "hourly": {"time": ["not-a-time"]}},
    {"utc_offset_seconds": 0, "hourly": {"time": ["2026-10-06T00:00", "2026-10-06T01:00"], "precipitation": [0.0]}},
])
async def test_open_meteo_malformed_payloads(payload):
    provider = provider_for(json_handler(payload))
    with pytest.raises(WeatherProviderError):
        await provider.get_observation(CMB)


@pytest.mark.asyncio
async def test_open_meteo_missing_hourly_data():
    provider = provider_for(json_handler({"utc_offset_seconds": 0, "hourly": {"time": []}}))
    with pytest.raises(WeatherProviderError, match="no hourly forecast"):
        await provider.get_observation(CMB)


@pytest.mark.asyncio
async def test_open_meteo_null_values_become_missing_data():
    payload = open_meteo_payload(visibility=None, wind_gusts_10m=None, weather_code=None)
    del payload["hourly"]["wind_speed_10m"]  # variable absent entirely
    provider = provider_for(json_handler(payload))
    obs = await provider.get_observation(CMB, datetime(2026, 10, 6, 6, 0, tzinfo=timezone.utc))
    assert obs.visibility_km is None
    assert obs.wind_speed_kt is None and obs.wind_gust_kt is None
    assert obs.thunderstorm is None and obs.condition_text is None

    assessment = score_weather(obs, get_risk_config())
    assert {"weather.visibility", "weather.wind", "weather.thunderstorm"} <= set(assessment.missing_data)


@pytest.mark.asyncio
async def test_open_meteo_target_time_outside_forecast():
    provider = provider_for(json_handler(open_meteo_payload(hours=24)))
    with pytest.raises(ForecastTimeUnavailable, match="beyond the 16-day forecast range"):
        await provider.get_observation(CMB, datetime(2026, 11, 30, 0, 0, tzinfo=timezone.utc))
    with pytest.raises(ForecastTimeUnavailable, match="Forecast unavailable for selected travel date: 2026-09-15 .* is in the past"):
        await provider.get_observation(CMB, datetime(2026, 9, 15, 10, 0, tzinfo=timezone.utc))
    with pytest.raises(ForecastTimeUnavailable):
        await provider.get_observation(CMB, datetime(2026, 10, 6, 6, 0))  # naive


# ---------------------------------------------------------------------------
# Weather scoring integration (existing score_weather)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_open_meteo_observation_scored_by_existing_rules():
    # Thunderstorm + heavy rain (10 mm/h) + strong gusts (32 kt) + reduced visibility (3 km).
    payload = open_meteo_payload(weather_code=95, precipitation=10.0, wind_gusts_10m=32.0, visibility=3000.0)
    provider = provider_for(json_handler(payload))
    agent = WeatherAgent(provider=provider, risk_config=RiskConfig())

    result = await agent.assess_airport(
        "CMB", target_times=[(datetime(2026, 10, 6, 6, 0, tzinfo=timezone.utc), "departure")]
    )
    expected = score_weather(result.observation, RiskConfig())

    # heavy rain 35 + thunderstorm 30 * 0.5 correlation + wind 15 + visibility 15 = 80
    assert result.weather_score == expected.score == 80
    assert result.weather_risk == "VERY_HIGH"
    assert result.factors.thunderstorm and result.factors.strong_wind and result.factors.low_visibility
    assert "weather.alerts" in result.missing_data
    assert any("Heavy rainfall" in c for c in result.conditions)


# ---------------------------------------------------------------------------
# WeatherAgent
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_weather_agent_journey_with_mock_provider():
    state = JourneyState(journey_legs=LEGS)
    res = await WeatherAgent(provider=MockWeatherProvider()).execute(state)

    assert res.status == "success"
    by_airport = {w["airport"]: w for w in state.weather_results}
    assert set(by_airport) == {"CMB", "KUL", "NRT"}
    assert by_airport["CMB"]["roles"] == ["origin"]
    assert by_airport["KUL"]["roles"] == ["transfer"]
    assert by_airport["NRT"]["roles"] == ["destination"]
    kul = by_airport["KUL"]
    assert kul["status"] == "available"
    assert kul["weather_score"] == 60
    assert kul["weather_risk_score"] == 60  # legacy key read by the current Risk Agent
    assert kul["observation"]["weather_code"] == 95


@pytest.mark.asyncio
async def test_weather_agent_uses_flight_times_and_reports_worst_hour():
    class TimeDependentProvider(MockWeatherProvider):
        async def get_observation(self, airport, target_time=None):
            obs = await super().get_observation(airport, target_time)
            if target_time and target_time.hour >= 16:  # onward departure hour is stormy
                obs = obs.model_copy(update={"precipitation_mm_per_hr": 9.0})
            return obs

    state = JourneyState(flight_results=[
        {"origin": "CMB", "destination": "SIN", "scheduled_departure": "2026-10-06T10:00:00Z",
         "scheduled_arrival": "2026-10-06T14:00:00Z", "estimated_arrival": "2026-10-06T15:00:00Z"},
        {"origin": "SIN", "destination": "HND", "scheduled_departure": "2026-10-06T16:30:00Z",
         "scheduled_arrival": "2026-10-06T23:30:00Z"},
    ])
    await WeatherAgent(provider=TimeDependentProvider()).execute(state)
    sin = next(w for w in state.weather_results if w["airport"] == "SIN")
    assert sin["roles"] == ["transfer"]
    assert sin["weather_score"] == 35  # heavy rain at the 16:00 hour beats the dry 15:00 arrival
    assert "departure" in sin["forecast_window"]


@pytest.mark.asyncio
async def test_weather_agent_unknown_airport_is_unavailable_not_an_error():
    state = JourneyState(journey_legs=[
        {"flight_number": "AB1", "travel_date": "2026-10-06", "origin": "CMB", "destination": "ZZZ"},
    ])
    res = await WeatherAgent(provider=MockWeatherProvider()).execute(state)
    assert res.status == "partial"
    zzz = next(w for w in state.weather_results if w["airport"] == "ZZZ")
    assert zzz["status"] == "unavailable"
    assert "weather_risk_score" not in zzz
    assert "not in the airport coordinate table" in zzz["warnings"][0]


@pytest.mark.asyncio
async def test_weather_agent_provider_failure_keeps_risk_agent_working():
    state = JourneyState(
        journey_legs=LEGS,
        flight_results=[{"status": "ON_TIME", "delay_minutes": 0}],
    )
    res = await WeatherAgent(provider=FailingProvider()).execute(state)
    assert res.status == "unavailable"
    assert res.confidence == "unknown"
    assert all(w["status"] == "unavailable" for w in state.weather_results)
    assert any("Could not reach Open-Meteo" in w for w in res.warnings)

    # The Risk Agent still runs and reports weather as missing instead of inventing a score.
    await RiskAgent().execute(state)
    assert state.risk_analysis["weather_score"] is None
    assert state.risk_analysis["components"]["weather"]["status"] == "missing"


def test_repo_risk_config_loads():
    cfg = get_risk_config()
    assert cfg.weights.as_dict() == {"flight": 0.40, "connection": 0.35, "weather": 0.25}
    assert cfg.levels.level_for(60) == "HIGH"


# ---------------------------------------------------------------------------
# API endpoint
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture
def use_provider(monkeypatch):
    from app.api import weather as weather_api

    def _use(provider):
        monkeypatch.setattr(weather_api.weather_agent, "provider", provider)
    return _use


@pytest.mark.asyncio
async def test_weather_endpoint_success(client, use_provider):
    use_provider(MockWeatherProvider())
    response = await client.get("/api/weather", params={"airport": "kul"})
    assert response.status_code == 200
    data = response.json()
    assert data["airport"] == "KUL"
    assert data["status"] == "available"
    assert data["weather_score"] == 60
    assert data["weather_risk"] == "HIGH"
    assert data["conditions"]
    obs = data["observation"]
    for field in ("forecast_time", "temperature_c", "precipitation_mm_per_hr", "visibility_km",
                  "wind_speed_kt", "wind_gust_kt", "weather_code", "condition_text"):
        assert field in obs


@pytest.mark.asyncio
async def test_weather_endpoint_with_open_meteo(client, use_provider):
    use_provider(provider_for(json_handler(open_meteo_payload(weather_code=63, precipitation=4.0))))
    response = await client.get("/api/weather", params={"airport": "CMB", "time": "2026-10-06T12:00:00+05:30"})
    assert response.status_code == 200
    data = response.json()
    assert data["source"] == "Open-Meteo"
    assert data["is_mock"] is False
    assert data["observation"]["condition_text"] == "Moderate rain"
    assert data["weather_score"] == 18


@pytest.mark.asyncio
async def test_weather_endpoint_lists_airports(client):
    response = await client.get("/api/weather/airports")
    assert response.status_code == 200
    codes = [a["code"] for a in response.json()]
    assert "CMB" in codes and "KUL" in codes


@pytest.mark.asyncio
@pytest.mark.parametrize("params,status", [
    ({}, 422),
    ({"airport": "C1"}, 422),
    ({"airport": "COLOMBO"}, 422),
    ({"airport": "ZZZ"}, 404),
    ({"airport": "CMB", "time": "2026-10-06T12:00:00"}, 422),  # no timezone
    ({"airport": "CMB", "time": "tomorrow"}, 422),
])
async def test_weather_endpoint_rejects_invalid_input(client, params, status):
    response = await client.get("/api/weather", params=params)
    assert response.status_code == status


@pytest.mark.asyncio
async def test_weather_endpoint_provider_failure_returns_503(client, use_provider):
    use_provider(provider_for(raising_handler(httpx.ConnectError("refused"))))
    response = await client.get("/api/weather", params={"airport": "CMB"})
    assert response.status_code == 503
    detail = response.json()["detail"]
    assert detail["message"] == "Weather data temporarily unavailable."
    body = json.dumps(response.json())
    assert "Traceback" not in body and "httpx" not in body
