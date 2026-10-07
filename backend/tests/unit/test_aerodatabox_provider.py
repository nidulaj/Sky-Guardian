import json
from datetime import date
from pathlib import Path

import httpx
import pytest
from app.providers.flight import provider as provider_module
from app.providers.flight.aerodatabox import AeroDataBoxFlightProvider
from app.providers.flight.base import (
    FlightDataProvider, FlightNotFoundError, FlightDataUnavailableError, FlightDateNotCoveredError,
)
from app.providers.flight.cache import FlightCache
from app.providers.flight.chain import ChainFlightProvider
from app.providers.flight.settings import FlightSettings
from app.schemas.flight import FlightResult

API_KEY = "rapid-test-key"
FIXTURES = Path(__file__).resolve().parents[1] / "fixtures" / "aerodatabox"


def fixture(name):
    return json.loads((FIXTURES / name).read_text())


def make_provider(handler, today=date(2026, 10, 7), cache=None, units_remaining="398", **settings):
    calls = []

    def wrapped(request):
        calls.append(request)
        response = handler(request)
        if units_remaining is not None:
            response.headers["x-ratelimit-api-units-remaining"] = units_remaining
        return response

    provider = AeroDataBoxFlightProvider(
        api_key=API_KEY, transport=httpx.MockTransport(wrapped), cache=cache or FlightCache(),
        settings=FlightSettings(**settings), today=lambda: today,
    )
    return provider, calls


def ok(body):
    return lambda request: httpx.Response(200, json=body)


@pytest.mark.asyncio
async def test_future_flight_from_recorded_response_is_a_timetable():
    provider, calls = make_provider(ok(fixture("flight_ul306_2026-10-20.json")))
    result = await provider.get_flight_status("UL306", "2026-10-20", "CMB", "SIN")

    assert result.data_mode == "timetable"
    assert result.status == "SCHEDULED"
    assert result.scheduled_departure == "2026-10-19T20:20:00Z"
    assert result.scheduled_arrival == "2026-10-20T00:30:00Z"
    # predictedTime is AeroDataBox's own statistical guess, not an airline estimate: no delay is invented
    assert result.estimated_arrival is None and result.delay_minutes == 0
    assert result.arrival_terminal == "3"
    assert result.airline == "SriLankan Airlines"
    assert "TIMETABLE_ONLY" in result.reason_codes
    request = calls[0]
    assert request.url.path == "/flights/number/UL306/2026-10-20"
    assert request.headers["X-RapidAPI-Key"] == API_KEY
    assert request.headers["X-RapidAPI-Host"] == "aerodatabox.p.rapidapi.com"
    assert request.url.params["dateLocalRole"] == "Both"


@pytest.mark.asyncio
async def test_live_flight_picks_the_departure_on_the_requested_date():
    # The recorded response holds two SQ321 flights: one that left LHR on 6 Oct (arriving 7 Oct) and one leaving on 7 Oct
    provider, _ = make_provider(ok(fixture("flight_sq321_2026-10-07_live.json")))
    result = await provider.get_flight_status("SQ321", "2026-10-07", "LHR", "SIN")

    assert result.scheduled_departure == "2026-10-07T21:05:00Z"
    assert result.data_mode == "live"
    assert result.source == "AeroDataBox (live status)"
    assert result.status == "SCHEDULED"


@pytest.mark.asyncio
async def test_live_flight_in_the_air_maps_revised_and_runway_times():
    provider, _ = make_provider(ok(fixture("flight_sq321_2026-10-07_live.json")))
    result = await provider.get_flight_status("SQ321", "2026-10-06", "LHR", "SIN")

    assert result.status == "DEPARTED"            # EnRoute
    assert result.actual_departure == "2026-10-06T21:33:00Z"   # runway time
    assert result.estimated_departure == "2026-10-06T21:32:00Z"
    assert result.estimated_arrival == "2026-10-07T10:15:00Z"  # 15 min early
    assert result.delay_minutes == 0              # early arrivals are not negative delays
    assert result.terminal == "2" and result.arrival_terminal == "2"


def flight(status="Expected", dep_sched="2026-10-20 08:00Z", dep_revised=None, arr_sched="2026-10-20 12:00Z",
           arr_revised=None, arr_runway=None, quality=("Basic", "Live"), codeshare="IsOperator", dep_iata="CMB",
           local_date="2026-10-20", airline="SriLankan Airlines"):
    def moment(utc):
        return {"utc": utc, "local": utc.replace("Z", "+00:00")} if utc else None
    dep = {"airport": {"iata": dep_iata}, "scheduledTime": {"utc": dep_sched, "local": f"{local_date} 13:30+05:30"},
           "quality": list(quality)}
    if dep_revised:
        dep["revisedTime"] = moment(dep_revised)
    arr = {"airport": {"iata": "SIN"}, "scheduledTime": moment(arr_sched), "quality": list(quality)}
    if arr_revised:
        arr["revisedTime"] = moment(arr_revised)
    if arr_runway:
        arr["runwayTime"] = moment(arr_runway)
    return {"number": "UL 306", "status": status, "codeshareStatus": codeshare, "airline": {"name": airline},
            "departure": dep, "arrival": arr}


@pytest.mark.parametrize("raw,expected", [
    ("Expected", "SCHEDULED"), ("Boarding", "SCHEDULED"), ("Delayed", "DELAYED"), ("EnRoute", "DEPARTED"),
    ("Arrived", "LANDED"), ("Canceled", "CANCELLED"), ("Diverted", "DIVERTED"), ("CanceledUncertain", "UNKNOWN"),
    ("SomethingNew", "UNKNOWN"),
])
@pytest.mark.asyncio
async def test_status_mapping(raw, expected):
    provider, _ = make_provider(ok([flight(status=raw)]))
    result = await provider.get_flight_status("UL306", "2026-10-20", "CMB", "SIN")
    assert result.status == expected
    if raw == "CanceledUncertain":
        assert "CANCELLATION_UNCERTAIN" in result.reason_codes


@pytest.mark.asyncio
async def test_delay_uses_arrival_revision_when_known_else_departure():
    provider, _ = make_provider(ok([flight(dep_revised="2026-10-20 08:40Z", arr_revised="2026-10-20 12:25Z")]))
    result = await provider.get_flight_status("UL306", "2026-10-20", "CMB", "SIN")
    assert result.delay_minutes == 25

    provider, _ = make_provider(ok([flight(dep_revised="2026-10-20 08:40Z")]))
    result = await provider.get_flight_status("UL306", "2026-10-20", "CMB", "SIN")
    assert result.delay_minutes == 40


@pytest.mark.asyncio
async def test_operating_flight_is_preferred_over_codeshare():
    provider, _ = make_provider(ok([flight(codeshare="IsCodeshared", airline="Finnair"), flight()]))
    result = await provider.get_flight_status("UL306", "2026-10-20", "CMB", "SIN")
    assert result.airline == "SriLankan Airlines"


@pytest.mark.parametrize("status_code", [204, 404])
@pytest.mark.asyncio
async def test_no_content_or_not_found_is_flight_not_found(status_code):
    provider, _ = make_provider(lambda r: httpx.Response(status_code))
    with pytest.raises(FlightNotFoundError):
        await provider.get_flight_status("ZZ999", "2026-10-20", "CMB", "SIN")


@pytest.mark.asyncio
async def test_record_on_other_date_only_is_not_found():
    provider, _ = make_provider(ok([flight(local_date="2026-10-19")]))
    with pytest.raises(FlightNotFoundError):
        await provider.get_flight_status("UL306", "2026-10-20", "CMB", "SIN")


@pytest.mark.parametrize("status_code,match", [(401, "HTTP 401"), (403, "HTTP 403"), (429, "rate limit"), (500, "HTTP 500")])
@pytest.mark.asyncio
async def test_http_errors_are_unavailable(status_code, match):
    provider, _ = make_provider(lambda r: httpx.Response(status_code, json={"message": "nope"}))
    with pytest.raises(FlightDataUnavailableError, match=match):
        await provider.get_flight_status("UL306", "2026-10-20", "CMB", "SIN")


@pytest.mark.asyncio
async def test_network_error_is_unavailable_and_never_leaks_the_key():
    def down(request):
        raise httpx.ConnectError("boom", request=request)
    provider, _ = make_provider(down)
    with pytest.raises(FlightDataUnavailableError) as exc:
        await provider.get_flight_status("UL306", "2026-10-20", "CMB", "SIN")
    assert API_KEY not in str(exc.value) and exc.value.__cause__ is None


@pytest.mark.asyncio
async def test_dates_more_than_a_year_away_are_not_covered():
    provider, calls = make_provider(ok([]))
    with pytest.raises(FlightDateNotCoveredError):
        await provider.get_flight_status("UL306", "2027-12-01", "CMB", "SIN")
    assert calls == []


@pytest.mark.asyncio
async def test_responses_and_not_found_are_cached():
    provider, calls = make_provider(ok([flight()]))
    await provider.get_flight_status("UL306", "2026-10-20", "CMB", "SIN")
    await provider.get_flight_status("UL306", "2026-10-20", "CMB", "SIN")
    assert len(calls) == 1

    provider, calls = make_provider(lambda r: httpx.Response(204))
    for _ in range(3):
        with pytest.raises(FlightNotFoundError):
            await provider.get_flight_status("ZZ999", "2026-10-20", "CMB", "SIN")
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_stops_before_the_unit_reserve_using_rapidapi_header():
    cache = FlightCache()
    provider, calls = make_provider(ok([flight()]), cache=cache, units_remaining="11", AERODATABOX_UNITS_RESERVE=10)
    await provider.get_flight_status("UL306", "2026-10-20", "CMB", "SIN")     # leaves 11 units
    with pytest.raises(FlightDataUnavailableError, match="quota"):
        await provider.get_flight_status("UL306", "2026-10-21", "CMB", "SIN")  # 11 - 2 < 10
    assert len(calls) == 1


# ---- provider chain -------------------------------------------------------------------------------------

class Stub(FlightDataProvider):
    def __init__(self, name, outcome):
        self.name, self.outcome, self.calls = name, outcome, 0

    async def get_flight_status(self, flight_number, travel_date, origin, destination):
        self.calls += 1
        if isinstance(self.outcome, Exception):
            raise self.outcome
        return self.outcome


def result(mode, source="x"):
    return FlightResult(flight_number="UL306", origin="CMB", destination="SIN", status="SCHEDULED",
                        source=source, retrieved_at="2026-10-07T00:00:00Z", data_mode=mode)


@pytest.mark.asyncio
async def test_chain_returns_first_answer():
    first, second = Stub("A", result("live", "A")), Stub("B", result("live", "B"))
    out = await ChainFlightProvider([first, second]).get_flight_status("UL306", "2026-10-20", "CMB", "SIN")
    assert out.source == "A" and second.calls == 0


@pytest.mark.parametrize("error", [FlightNotFoundError("x"), FlightDataUnavailableError("x"), FlightDateNotCoveredError("x")])
@pytest.mark.asyncio
async def test_chain_falls_back_when_first_provider_cannot_answer(error):
    out = await ChainFlightProvider([Stub("A", error), Stub("B", result("timetable", "B"))]).get_flight_status("UL306", "2026-10-20", "CMB", "SIN")
    assert out.source == "B"


@pytest.mark.asyncio
async def test_chain_raises_most_informative_error():
    chain = ChainFlightProvider([Stub("A", FlightDataUnavailableError("down")), Stub("B", FlightNotFoundError("nf"))])
    with pytest.raises(FlightNotFoundError):
        await chain.get_flight_status("UL306", "2026-10-20", "CMB", "SIN")

    chain = ChainFlightProvider([Stub("A", FlightDataUnavailableError("down")), Stub("B", FlightDataUnavailableError("down"))])
    with pytest.raises(FlightDataUnavailableError):
        await chain.get_flight_status("UL306", "2026-10-20", "CMB", "SIN")


@pytest.mark.asyncio
async def test_chain_upgrades_timetable_to_live_when_available():
    upgrade = Stub("AS", result("live", "AS"))
    chain = ChainFlightProvider([Stub("ADB", result("timetable", "ADB")), upgrade], live_upgrade=upgrade)
    out = await chain.get_flight_status("UL306", "2026-10-07", "CMB", "SIN")
    assert out.source == "AS"


@pytest.mark.parametrize("upgrade_outcome", [FlightNotFoundError("x"), FlightDataUnavailableError("x"), result("timetable", "AS")])
@pytest.mark.asyncio
async def test_chain_keeps_timetable_when_upgrade_has_nothing_live(upgrade_outcome):
    upgrade = Stub("AS", upgrade_outcome)
    chain = ChainFlightProvider([Stub("ADB", result("timetable", "ADB"))], live_upgrade=upgrade)
    out = await chain.get_flight_status("UL306", "2026-10-20", "CMB", "SIN")
    assert out.source == "ADB"


@pytest.mark.asyncio
async def test_chain_does_not_upgrade_live_results():
    upgrade = Stub("AS", result("live", "AS"))
    chain = ChainFlightProvider([Stub("ADB", result("live", "ADB"))], live_upgrade=upgrade)
    await chain.get_flight_status("UL306", "2026-10-07", "CMB", "SIN")
    assert upgrade.calls == 0


# ---- factory ----------------------------------------------------------------------------------------------

def test_auto_builds_chain_from_configured_keys(monkeypatch, tmp_path):
    monkeypatch.setattr(provider_module.flight_settings, "FLIGHT_CACHE_PATH", str(tmp_path / "c.sqlite3"))
    monkeypatch.setattr(provider_module.flight_settings, "AERODATABOX_API_KEY", "rapid")
    monkeypatch.setattr(provider_module.settings, "FLIGHT_API_KEY", "as-key")
    chain = provider_module.get_flight_provider("auto")
    assert [p.name for p in chain.providers] == ["AeroDataBox", "AviationStack"]
    assert chain.live_upgrade.name == "AviationStack"

    monkeypatch.setattr(provider_module.settings, "FLIGHT_API_KEY", "mock_key")
    chain = provider_module.get_flight_provider("auto")
    assert [p.name for p in chain.providers] == ["AeroDataBox"] and chain.live_upgrade is None

    monkeypatch.setattr(provider_module.flight_settings, "AERODATABOX_API_KEY", "")
    with pytest.raises(ValueError, match="auto needs"):
        provider_module.get_flight_provider("auto")


def test_aerodatabox_factory_requires_key(monkeypatch):
    monkeypatch.setattr(provider_module.flight_settings, "AERODATABOX_API_KEY", "")
    with pytest.raises(ValueError, match="AERODATABOX_API_KEY"):
        provider_module.get_flight_provider("aerodatabox")
