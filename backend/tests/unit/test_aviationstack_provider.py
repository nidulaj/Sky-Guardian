import json
from datetime import date
from pathlib import Path

import httpx
import pytest
from app.orchestrator.state import JourneyState
from app.agents.flight_agent import FlightAgent
from app.agents.connection_agent import ConnectionAgent
from app.providers.flight import provider as provider_module
from app.providers.flight.aviationstack import AviationStackFlightProvider
from app.providers.flight.base import FlightNotFoundError, FlightDataUnavailableError, FlightDateNotCoveredError
from app.providers.flight.cache import FlightCache
from app.providers.flight.settings import FlightSettings

API_KEY = "test-key-123"
FIXTURES = Path(__file__).resolve().parents[1] / "fixtures" / "aviationstack"
TODAY = date(2026, 10, 5)  # the live fixture was recorded on 2026-10-05 for flights dated 2026-10-06


def fixture(name):
    return json.loads((FIXTURES / name).read_text())


def record(flight_iata="UL306", flight_date="2026-10-06", status="scheduled", codeshared=None,
           dep=("CMB", "Asia/Colombo", "2026-10-06T01:50:00+00:00"), arr=("SIN", "Asia/Singapore", "2026-10-06T08:30:00+00:00"),
           dep_delay=None, arr_delay=None, arr_estimated=None, airline="SriLankan Airlines"):
    """Shape of one AviationStack /flights record. Times are airport-local but labelled +00:00, as the API does."""
    return {
        "flight_date": flight_date,
        "flight_status": status,
        "departure": {"iata": dep[0], "timezone": dep[1], "scheduled": dep[2], "estimated": None,
                      "actual": None, "delay": dep_delay, "terminal": None, "gate": "A1"},
        "arrival": {"iata": arr[0], "timezone": arr[1], "scheduled": arr[2], "estimated": arr_estimated,
                    "actual": None, "delay": arr_delay, "terminal": "3", "gate": None},
        "airline": {"name": airline},
        "flight": {"iata": flight_iata, "codeshared": codeshared},
    }


def make_provider(handler, today=TODAY, cache=None, **settings):
    calls = []

    def wrapped(request: httpx.Request):
        calls.append(request)
        return handler(request)

    provider = AviationStackFlightProvider(
        api_key=API_KEY,
        transport=httpx.MockTransport(wrapped),
        cache=cache or FlightCache(),
        settings=FlightSettings(**settings),
        today=lambda tz: today,
    )
    return provider, calls


def respond(data=None, status_code=200, error=None):
    body = {"error": error} if error else {"pagination": {}, "data": data or []}
    return lambda request: httpx.Response(status_code, json=body)


def by_endpoint(live=None, timetable=None):
    """Route MockTransport requests to the live (/flights) or timetable (/flightsFuture) payload."""
    def handler(request):
        if request.url.path.endswith("/flightsFuture"):
            return httpx.Response(200, json=timetable if timetable is not None else {"data": []})
        return httpx.Response(200, json=live if live is not None else {"data": []})
    return handler


# ---- endpoint choice by travel date ---------------------------------------------------------------------

@pytest.mark.asyncio
async def test_near_dates_use_live_status_from_recorded_response():
    provider, calls = make_provider(by_endpoint(live=fixture("flights_live_ul306.json")))
    result = await provider.get_flight_status("UL306", "2026-10-06", "CMB", "SIN")

    # 01:50 in Colombo (+05:30) is 20:20 UTC the previous day; 08:30 in Singapore (+08:00) is 00:30 UTC
    assert result.scheduled_departure == "2026-10-05T20:20:00Z"
    assert result.scheduled_arrival == "2026-10-06T00:30:00Z"
    assert result.airline == "SriLankan Airlines"  # operating carrier, not the Finnair codeshare
    assert result.data_mode == "live"
    assert result.source == "AviationStack (live status)"
    assert result.arrival_terminal == "3"
    assert [c.url.path for c in calls] == ["/v1/flights"]
    assert calls[0].url.scheme == "https"
    assert "flight_date" not in calls[0].url.params  # not allowed on the free plan


@pytest.mark.asyncio
async def test_later_dates_use_published_timetable_from_recorded_response():
    provider, calls = make_provider(by_endpoint(timetable=fixture("flights_future_cmb_ul306.json")))
    result = await provider.get_flight_status("UL306", "2026-10-20", "CMB", "SIN")

    assert result.data_mode == "timetable"
    assert result.status == "SCHEDULED"
    assert result.scheduled_departure == "2026-10-19T20:20:00Z"
    assert result.scheduled_arrival == "2026-10-20T00:30:00Z"
    assert result.airline == "Srilankan Airlines"
    assert result.arrival_terminal == "3"
    assert result.terminal is None and result.gate is None  # blank strings become None
    assert "TIMETABLE_ONLY" in result.reason_codes
    params = calls[0].url.params
    assert calls[0].url.path == "/v1/flightsFuture"
    assert (params["iataCode"], params["type"], params["date"], params["airline_iata"], params["flight_number"]) == \
        ("CMB", "departure", "2026-10-20", "UL", "306")


@pytest.mark.asyncio
async def test_today_falls_back_to_timetable_when_not_in_live_feed():
    provider, calls = make_provider(by_endpoint(live={"data": []}, timetable=fixture("flights_future_cmb_ul306.json")))
    result = await provider.get_flight_status("UL306", "2026-10-05", "CMB", "SIN")

    assert result.data_mode == "timetable"
    assert [c.url.path for c in calls] == ["/v1/flights", "/v1/flightsFuture"]


@pytest.mark.asyncio
async def test_timetable_error_during_live_fallback_is_reported_as_not_found():
    def handler(request):
        if request.url.path.endswith("/flightsFuture"):
            return httpx.Response(200, json={"error": {"code": "invalid_date"}})
        return httpx.Response(200, json={"data": []})

    provider, _ = make_provider(handler)
    with pytest.raises(FlightNotFoundError):
        await provider.get_flight_status("UL306", "2026-10-05", "CMB", "SIN")


@pytest.mark.parametrize("travel_date", ["2026-10-01", "2025-12-31"])
@pytest.mark.asyncio
async def test_past_dates_are_not_covered_and_cost_no_request(travel_date):
    provider, calls = make_provider(by_endpoint())
    with pytest.raises(FlightDateNotCoveredError):
        await provider.get_flight_status("UL306", travel_date, "CMB", "SIN")
    assert calls == []


@pytest.mark.asyncio
async def test_dates_too_far_ahead_are_not_covered():
    provider, calls = make_provider(by_endpoint())
    with pytest.raises(FlightDateNotCoveredError):
        await provider.get_flight_status("UL306", "2027-12-01", "CMB", "SIN")
    assert calls == []


@pytest.mark.asyncio
async def test_today_is_judged_in_the_origin_airport_timezone():
    seen = []
    provider, _ = make_provider(by_endpoint(live=fixture("flights_live_ul306.json")))
    provider._today = lambda tz: seen.append(tz) or TODAY
    await provider.get_flight_status("UL306", "2026-10-06", "CMB", "SIN")
    assert seen == ["Asia/Colombo"]


# ---- record selection and mapping -----------------------------------------------------------------------

@pytest.mark.asyncio
async def test_no_record_for_travel_date_is_not_found():
    provider, _ = make_provider(by_endpoint(live={"data": [record(flight_date="2026-10-06")]}))
    with pytest.raises(FlightNotFoundError):
        await provider.get_flight_status("UL306", "2026-10-04", "CMB", "SIN")


@pytest.mark.asyncio
async def test_codeshare_number_is_matched_on_its_own_designator():
    provider, _ = make_provider(by_endpoint(live={"data": [record(flight_iata="AY6648", codeshared={"flight_iata": "ul306"}, airline="Finnair")]}))
    with pytest.raises(FlightNotFoundError):
        await provider.get_flight_status("UL306", "2026-10-06", "CMB", "SIN")
    result = await provider.get_flight_status("AY6648", "2026-10-06", "CMB", "SIN")
    assert result.airline == "Finnair"


@pytest.mark.parametrize("raw,expected", [
    ("scheduled", "SCHEDULED"), ("active", "DEPARTED"), ("landed", "LANDED"),
    ("cancelled", "CANCELLED"), ("diverted", "DIVERTED"), ("incident", "UNKNOWN"), ("something-new", "UNKNOWN"),
])
@pytest.mark.asyncio
async def test_status_mapping(raw, expected):
    provider, _ = make_provider(by_endpoint(live={"data": [record(status=raw)]}))
    result = await provider.get_flight_status("UL306", "2026-10-06", "CMB", "SIN")

    assert result.status == expected
    if raw == "incident":
        assert "INCIDENT_REPORTED" in result.reason_codes


@pytest.mark.asyncio
async def test_arrival_delay_takes_priority_over_departure_delay():
    provider, _ = make_provider(by_endpoint(live={"data": [record(dep_delay=40, arr_delay=25, arr_estimated="2026-10-06T08:55:00+00:00")]}))
    result = await provider.get_flight_status("UL306", "2026-10-06", "CMB", "SIN")

    assert result.delay_minutes == 25
    assert result.estimated_arrival == "2026-10-06T00:55:00Z"


@pytest.mark.asyncio
async def test_missing_timezone_falls_back_to_airport_database():
    provider, _ = make_provider(by_endpoint(live={"data": [record(dep=("CMB", None, "2026-10-06T01:50:00+00:00"))]}))
    result = await provider.get_flight_status("UL306", "2026-10-06", "CMB", "SIN")

    assert result.scheduled_departure == "2026-10-05T20:20:00Z"
    assert "TIMEZONE_UNVERIFIED" not in result.reason_codes


@pytest.mark.asyncio
async def test_unknown_airport_without_timezone_keeps_time_and_flags_it():
    provider, _ = make_provider(by_endpoint(live={"data": [record(dep=("QQQ", None, "2026-10-06T01:50:00+00:00"))]}))
    result = await provider.get_flight_status("UL306", "2026-10-06", "CMB", "SIN")

    assert result.scheduled_departure == "2026-10-06T01:50:00+00:00"
    assert "TIMEZONE_UNVERIFIED" in result.reason_codes


# ---- errors, cache and quota ----------------------------------------------------------------------------

@pytest.mark.parametrize("code", ["invalid_access_key", "usage_limit_reached", "function_access_restricted"])
@pytest.mark.asyncio
async def test_api_errors_are_unavailable(code):
    provider, _ = make_provider(respond(error={"code": code, "message": "..."}, status_code=401))
    with pytest.raises(FlightDataUnavailableError, match=code):
        await provider.get_flight_status("UL306", "2026-10-06", "CMB", "SIN")


@pytest.mark.asyncio
async def test_http_and_network_failures_are_unavailable_and_never_leak_the_key():
    def network_down(request):
        raise httpx.ConnectError("connection refused", request=request)

    for handler in [network_down, lambda r: httpx.Response(502, text="Bad Gateway"), respond(status_code=500)]:
        provider, _ = make_provider(handler)
        with pytest.raises(FlightDataUnavailableError) as exc:
            await provider.get_flight_status("UL306", "2026-10-06", "CMB", "SIN")
        assert API_KEY not in str(exc.value)
        assert exc.value.__cause__ is None


@pytest.mark.asyncio
async def test_live_responses_are_cached_per_flight_number():
    provider, calls = make_provider(by_endpoint(live={"data": [record(), record(flight_date="2026-10-05")]}))

    await provider.get_flight_status("UL306", "2026-10-06", "CMB", "SIN")
    await provider.get_flight_status("UL306", "2026-10-05", "CMB", "SIN")
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_cache_survives_a_new_provider_instance(tmp_path):
    cache_path = str(tmp_path / "flights.sqlite3")
    first, first_calls = make_provider(by_endpoint(timetable=fixture("flights_future_cmb_ul306.json")), cache=FlightCache(cache_path))
    await first.get_flight_status("UL306", "2026-10-20", "CMB", "SIN")

    second, second_calls = make_provider(by_endpoint(), cache=FlightCache(cache_path))
    result = await second.get_flight_status("UL306", "2026-10-20", "CMB", "SIN")
    assert result.data_mode == "timetable"
    assert len(first_calls) == 1 and second_calls == []


@pytest.mark.asyncio
async def test_not_found_is_cached_to_save_quota():
    provider, calls = make_provider(by_endpoint())
    for _ in range(3):
        with pytest.raises(FlightNotFoundError):
            await provider.get_flight_status("ZZ999", "2026-10-20", "CMB", "SIN")
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_errors_are_not_cached():
    responses = iter([httpx.Response(500, text="oops"), httpx.Response(200, json={"data": [record()]})])
    provider, calls = make_provider(lambda request: next(responses))

    with pytest.raises(FlightDataUnavailableError):
        await provider.get_flight_status("UL306", "2026-10-06", "CMB", "SIN")
    result = await provider.get_flight_status("UL306", "2026-10-06", "CMB", "SIN")
    assert result.flight_number == "UL306"
    assert len(calls) == 2


@pytest.mark.asyncio
async def test_quota_stops_requests_before_the_monthly_limit():
    cache = FlightCache()
    provider, calls = make_provider(by_endpoint(), cache=cache, FLIGHT_MONTHLY_QUOTA=3, FLIGHT_QUOTA_RESERVE=1)

    with pytest.raises(FlightNotFoundError):
        await provider.get_flight_status("AA001", "2026-10-20", "CMB", "SIN")
    with pytest.raises(FlightNotFoundError):
        await provider.get_flight_status("AA002", "2026-10-20", "CMB", "SIN")
    with pytest.raises(FlightDataUnavailableError, match="quota"):
        await provider.get_flight_status("AA003", "2026-10-20", "CMB", "SIN")
    assert len(calls) == 2
    assert cache.calls_this_month("AviationStack") == 2


# ---- through the agents ---------------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_flight_and_connection_agents_with_aviationstack_data():
    """Two live-shaped legs connecting at SIN: 08:30 local arrival, 10:00 local departure -> 90 min window."""
    data = {
        "UL306": [record()],
        "SQ638": [record(flight_iata="SQ638", airline="Singapore Airlines",
                         dep=("SIN", "Asia/Singapore", "2026-10-06T10:00:00+00:00"),
                         arr=("NRT", "Asia/Tokyo", "2026-10-06T18:00:00+00:00"))],
    }
    provider, _ = make_provider(lambda request: httpx.Response(200, json={"data": data[request.url.params["flight_iata"]]}))
    state = JourneyState(journey_legs=[
        {"flight_number": "UL306", "travel_date": "2026-10-06", "origin": "CMB", "destination": "SIN"},
        {"flight_number": "SQ638", "travel_date": "2026-10-06", "origin": "SIN", "destination": "NRT"},
    ])
    flight_result = await FlightAgent(provider=provider).execute(state)
    await ConnectionAgent(default_mct_minutes=60).execute(state)

    assert flight_result.status == "success"
    first = state.flight_results[0]
    assert (first["origin_city"], first["destination_city"]) == ("Colombo", "Singapore")
    assert (first["origin_timezone"], first["destination_timezone"]) == ("Asia/Colombo", "Asia/Singapore")
    conn = state.connection_results[0]
    assert conn["airport"] == "SIN"
    assert conn["available_connection_minutes"] == 90
    assert conn["status"] == "MODERATE_RISK"


@pytest.mark.asyncio
async def test_past_date_reaches_the_user_as_a_clear_warning():
    provider, _ = make_provider(by_endpoint())
    state = JourneyState(journey_legs=[{"flight_number": "UL306", "travel_date": "2026-09-01", "origin": "CMB", "destination": "SIN"}])
    result = await FlightAgent(provider=provider).execute(state)

    assert state.flight_results[0]["reason_codes"] == ["DATE_NOT_COVERED"]
    assert "Past flights" in result.warnings[0]


# ---- provider factory -----------------------------------------------------------------------------------

def test_factory_builds_aviationstack_from_settings(monkeypatch, tmp_path):
    monkeypatch.setattr(provider_module.settings, "FLIGHT_API_KEY", "real-key")
    monkeypatch.setattr(provider_module.flight_settings, "FLIGHT_CACHE_PATH", str(tmp_path / "c.sqlite3"))
    assert isinstance(provider_module.get_flight_provider("aviationstack"), AviationStackFlightProvider)


@pytest.mark.parametrize("key", [None, "", "mock_key"])
def test_factory_requires_a_real_key(monkeypatch, key):
    monkeypatch.setattr(provider_module.settings, "FLIGHT_API_KEY", key)
    with pytest.raises(ValueError, match="FLIGHT_API_KEY"):
        provider_module.get_flight_provider("aviationstack")


def test_factory_honours_use_mock_flights_switch(monkeypatch, tmp_path):
    monkeypatch.setattr(provider_module.settings, "FLIGHT_API_KEY", "real-key")
    monkeypatch.setattr(provider_module.settings, "FLIGHT_PROVIDER", "aviationstack")
    monkeypatch.setattr(provider_module.flight_settings, "FLIGHT_CACHE_PATH", str(tmp_path / "c.sqlite3"))
    monkeypatch.setattr(provider_module.settings, "USE_MOCK_FLIGHTS", False)
    assert isinstance(provider_module.get_flight_provider(), AviationStackFlightProvider)

    monkeypatch.setattr(provider_module.settings, "USE_MOCK_FLIGHTS", True)
    assert provider_module.get_flight_provider().name == "MockFlightProvider"


# ---- live-only path used to upgrade another provider's timetable -----------------------------------------

@pytest.mark.asyncio
async def test_live_status_outside_the_live_window_costs_no_request():
    provider, calls = make_provider(respond([record(flight_date="2026-10-20")]))
    assert await provider.get_live_status("UL306", "2026-10-20", "CMB", "SIN") is None
    assert calls == []


@pytest.mark.asyncio
async def test_live_status_never_falls_back_to_the_timetable():
    provider, calls = make_provider(respond([]))
    assert await provider.get_live_status("UL306", "2026-10-06", "CMB", "SIN") is None
    assert [c.url.path for c in calls] == ["/v1/flights"]


@pytest.mark.asyncio
async def test_live_status_only_returns_a_departure_from_the_requested_origin():
    other_leg = record(dep=("MLE", "Indian/Maldives", "2026-10-06T10:00:00+00:00"),
                       arr=("CMB", "Asia/Colombo", "2026-10-06T12:00:00+00:00"), status="active", dep_delay=90)
    provider, _ = make_provider(respond([other_leg]))
    assert await provider.get_live_status("UL306", "2026-10-06", "CMB", "SIN") is None
