from datetime import datetime, timedelta, timezone

import httpx
import pytest

from app.config import settings
from app.providers.flight.aerodatabox import AeroDataBoxFlightProvider
from app.providers.flight.base import FlightDataUnavailableError
from app.providers.flight.cache import FlightCache
from app.providers.flight.search import AeroDataBoxSearch, UnavailableFlightSearch, get_flight_search_provider
from app.providers.flight.settings import FlightSettings, flight_settings
from app.ranking.config import RankingConfig
from app.schemas.alternative import AlternativeSearchRequest

START = datetime(2026, 10, 8, 10, tzinfo=timezone.utc)


def record(**updates):
    return {"number": "UL 121", "status": "Expected", "codeshareStatus": "IsOperator", "isCargo": False,
            "departure": {"scheduledTime": {"utc": "2026-10-08 12:00Z"}, "quality": ["Basic"]},
            "arrival": {"airport": {"iata": "MAA"}, "scheduledTime": {"utc": "2026-10-08 13:30Z"}, "quality": ["Basic"]},
            **updates}


def provider(handler, **config):
    calls = []

    def respond(request):
        calls.append(request)
        return handler(request)

    return AeroDataBoxFlightProvider(api_key="test-secret", cache=FlightCache(), settings=FlightSettings(**config),
                                    transport=httpx.MockTransport(respond)), calls


@pytest.mark.asyncio
async def test_fids_uses_local_window_fills_only_the_known_origin_and_caches():
    adb, calls = provider(lambda _: httpx.Response(200, json={"departures": [record()]}))
    for _ in range(2):
        flights = await adb.search_departure_window("CMB", START, START + timedelta(hours=12))
        assert len(flights) == 1
        assert flights[0].origin == "CMB" and flights[0].destination == "MAA"
        assert flights[0].flight_number == "UL121"
        assert flights[0].scheduled_arrival == "2026-10-08T13:30:00Z"
        assert flights[0].data_mode == "timetable"
    assert len(calls) == 1
    assert calls[0].url.path.endswith("/CMB/2026-10-08T15:30/2026-10-09T03:30")
    assert calls[0].url.params["withLeg"] == "true"
    assert calls[0].url.params["withCodeshared"] == "false"
    assert calls[0].headers["X-RapidAPI-Key"] == "test-secret"


@pytest.mark.asyncio
async def test_malformed_naive_cargo_and_codeshared_records_are_not_options():
    records = ["bad", record(isCargo=True), record(codeshareStatus="IsCodeshared"), record(number="private"),
               record(departure={"scheduledTime": {"utc": "2026-10-08T12:00:00"}}),
               record(departure={"airport": {"iata": "KUL"}}), record(status="Unknown"), record(status=None)]
    adb, _ = provider(lambda _: httpx.Response(200, json={"departures": records}))
    flights = await adb.search_departure_window("CMB", START, START + timedelta(hours=12))
    assert len(flights) == 2 and all(f.status == "UNKNOWN" for f in flights)


@pytest.mark.parametrize("code", [400, 401, 403, 429, 500])
@pytest.mark.asyncio
async def test_errors_are_unavailable_without_exposing_key(code):
    adb, _ = provider(lambda _: httpx.Response(code, json={"message": "test-secret"}))
    with pytest.raises(FlightDataUnavailableError) as error:
        await adb.search_departure_window("CMB", START, START + timedelta(hours=12))
    assert "test-secret" not in str(error.value)


@pytest.mark.parametrize("payload", [{}, [], {"departures": None}, {"departures": {}}])
@pytest.mark.asyncio
async def test_unexpected_schema_is_not_a_successful_empty_search(payload):
    adb, _ = provider(lambda _: httpx.Response(200, json=payload))
    with pytest.raises(FlightDataUnavailableError):
        await adb.search_departure_window("CMB", START, START + timedelta(hours=12))


@pytest.mark.asyncio
async def test_empty_search_and_units_reserve():
    adb, calls = provider(lambda _: httpx.Response(204))
    assert await adb.search_departure_window("CMB", START, START + timedelta(hours=12)) == []
    adb, calls = provider(lambda _: httpx.Response(204), AERODATABOX_MONTHLY_UNITS=10, AERODATABOX_UNITS_RESERVE=10)
    with pytest.raises(FlightDataUnavailableError, match="quota"):
        await adb.search_departure_window("CMB", START, START + timedelta(hours=12))
    assert not calls


@pytest.mark.asyncio
async def test_search_has_one_http_request_per_window_and_preserves_partial_results():
    adb, calls = provider(lambda request: httpx.Response(200, json={"departures": [record()]}) if "/CMB/" in request.url.path else httpx.Response(403))
    query = AlternativeSearchRequest(origin="CMB", destination="MAA", earliest_departure=START,
                                     latest_departure=START + timedelta(hours=48))
    result = await AeroDataBoxSearch(adb, RankingConfig(max_provider_requests=4)).search(query)
    assert len(calls) == 4
    assert result.available and not result.complete and result.candidates
    assert any("could not be checked" in warning for warning in result.warnings)
    assert all(candidate.legs[0].destination == "MAA" for candidate in result.candidates)


def test_auto_prefers_configured_aerodatabox_without_mock_or_aviationstack_fallback(monkeypatch):
    monkeypatch.setattr(settings, "USE_MOCK_FLIGHTS", False)
    monkeypatch.setattr(settings, "FLIGHT_PROVIDER", "auto")
    monkeypatch.setattr(settings, "ALTERNATIVE_PROVIDER", "auto")
    monkeypatch.setattr(flight_settings, "AERODATABOX_API_KEY", "test-secret")
    assert isinstance(get_flight_search_provider(RankingConfig()), AeroDataBoxSearch)
    monkeypatch.setattr(settings, "ALTERNATIVE_PROVIDER", "aerodatabox")
    monkeypatch.setattr(flight_settings, "AERODATABOX_API_KEY", "")
    assert isinstance(get_flight_search_provider(RankingConfig()), UnavailableFlightSearch)


@pytest.mark.asyncio
async def test_naive_or_oversized_search_window_never_calls_provider():
    adb, calls = provider(lambda _: httpx.Response(204))
    for start, end in [(START.replace(tzinfo=None), START + timedelta(hours=12)), (START, START + timedelta(hours=13))]:
        with pytest.raises(FlightDataUnavailableError):
            await adb.search_departure_window("CMB", start, end)
    assert not calls


@pytest.mark.asyncio
async def test_unknown_airport_and_daylight_saving_boundary_are_not_guessed():
    adb, calls = provider(lambda _: httpx.Response(204))
    for airport, start in [("ZZZ", START), ("LHR", datetime(2026, 10, 25, tzinfo=timezone.utc))]:
        with pytest.raises(FlightDataUnavailableError):
            await adb.search_departure_window(airport, start, start + timedelta(hours=12))
    assert not calls


@pytest.mark.asyncio
async def test_departure_network_error_is_sanitized_and_counted_against_quota():
    def timeout(request):
        raise httpx.ReadTimeout("test-secret", request=request)

    adb, calls = provider(timeout)
    with pytest.raises(FlightDataUnavailableError) as error:
        await adb.search_departure_window("CMB", START, START + timedelta(hours=12))
    assert "test-secret" not in str(error.value) and error.value.__cause__ is None
    assert adb._cache.calls_this_month(adb.name) == len(calls) == 1
