import httpx
import pytest
from app.orchestrator.state import JourneyState
from app.agents.flight_agent import FlightAgent
from app.agents.connection_agent import ConnectionAgent
from app.providers.flight import provider as provider_module
from app.providers.flight.aviationstack import AviationStackFlightProvider
from app.providers.flight.base import FlightNotFoundError, FlightDataUnavailableError

API_KEY = "test-key-123"


def record(flight_iata="UL306", flight_date="2026-10-06", status="scheduled", codeshared=None,
           dep=("CMB", "Asia/Colombo", "2026-10-06T01:50:00+00:00"), arr=("SIN", "Asia/Singapore", "2026-10-06T08:30:00+00:00"),
           dep_delay=None, arr_delay=None, dep_estimated=None, arr_estimated=None, airline="SriLankan Airlines"):
    """Shape of one AviationStack /flights record. Times are airport-local but labelled +00:00, as the API does."""
    return {
        "flight_date": flight_date,
        "flight_status": status,
        "departure": {"iata": dep[0], "timezone": dep[1], "scheduled": dep[2], "estimated": dep_estimated,
                      "actual": None, "delay": dep_delay, "terminal": None, "gate": "A1"},
        "arrival": {"iata": arr[0], "timezone": arr[1], "scheduled": arr[2], "estimated": arr_estimated,
                    "actual": None, "delay": arr_delay, "terminal": "3", "gate": None},
        "airline": {"name": airline},
        "flight": {"iata": flight_iata, "codeshared": codeshared},
    }


def make_provider(handler, **kwargs):
    calls = []

    def wrapped(request: httpx.Request):
        calls.append(request)
        return handler(request)

    return AviationStackFlightProvider(api_key=API_KEY, transport=httpx.MockTransport(wrapped), **kwargs), calls


def respond(data=None, status_code=200, error=None):
    body = {"error": error} if error else {"pagination": {}, "data": data or []}
    return lambda request: httpx.Response(status_code, json=body)


@pytest.mark.asyncio
async def test_maps_record_and_converts_local_times_to_utc():
    provider, calls = make_provider(respond([record()]))
    result = await provider.get_flight_status("UL306", "2026-10-06", "CMB", "SIN")

    # 01:50 in Colombo (+05:30) is 20:20 UTC the previous day; 08:30 in Singapore (+08:00) is 00:30 UTC
    assert result.scheduled_departure == "2026-10-05T20:20:00Z"
    assert result.scheduled_arrival == "2026-10-06T00:30:00Z"
    assert result.origin == "CMB" and result.destination == "SIN"
    assert result.airline == "SriLankan Airlines"
    assert result.status == "SCHEDULED"
    assert result.source == "AviationStack (live)"
    assert result.reason_codes == []

    request = calls[0]
    assert request.url.scheme == "https"
    assert request.url.params["flight_iata"] == "UL306"
    assert "flight_date" not in request.url.params  # not available on the free plan


@pytest.mark.asyncio
async def test_selects_record_for_travel_date_and_prefers_operating_carrier():
    data = [
        record(flight_date="2026-10-05", dep=("CMB", "Asia/Colombo", "2026-10-05T01:50:00+00:00")),
        record(codeshared={"flight_iata": "ul306"}, airline="Finnair"),
        record(),
    ]
    provider, _ = make_provider(respond(data))
    result = await provider.get_flight_status("UL306", "2026-10-06", "CMB", "SIN")

    assert result.airline == "SriLankan Airlines"
    assert result.scheduled_departure == "2026-10-05T20:20:00Z"


@pytest.mark.asyncio
async def test_no_record_for_travel_date_is_not_found():
    provider, _ = make_provider(respond([record(flight_date="2026-10-06")]))

    with pytest.raises(FlightNotFoundError):
        await provider.get_flight_status("UL306", "2026-09-15", "CMB", "SIN")


@pytest.mark.asyncio
async def test_codeshare_number_is_matched_on_its_own_designator():
    provider, _ = make_provider(respond([record(flight_iata="AY6648", codeshared={"flight_iata": "ul306"}, airline="Finnair")]))

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
    provider, _ = make_provider(respond([record(status=raw)]))
    result = await provider.get_flight_status("UL306", "2026-10-06", "CMB", "SIN")

    assert result.status == expected
    if raw == "incident":
        assert "INCIDENT_REPORTED" in result.reason_codes


@pytest.mark.asyncio
async def test_arrival_delay_takes_priority_over_departure_delay():
    provider, _ = make_provider(respond([record(dep_delay=40, arr_delay=25, arr_estimated="2026-10-06T08:55:00+00:00")]))
    result = await provider.get_flight_status("UL306", "2026-10-06", "CMB", "SIN")

    assert result.delay_minutes == 25
    assert result.estimated_arrival == "2026-10-06T00:55:00Z"


@pytest.mark.asyncio
async def test_missing_timezone_keeps_time_and_flags_it():
    provider, _ = make_provider(respond([record(dep=("CMB", None, "2026-10-06T01:50:00+00:00"))]))
    result = await provider.get_flight_status("UL306", "2026-10-06", "CMB", "SIN")

    assert result.scheduled_departure == "2026-10-06T01:50:00+00:00"
    assert "TIMEZONE_UNVERIFIED" in result.reason_codes


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
async def test_responses_are_cached_per_flight_number():
    provider, calls = make_provider(respond([record(), record(flight_date="2026-10-07")]))

    await provider.get_flight_status("UL306", "2026-10-06", "CMB", "SIN")
    await provider.get_flight_status("UL306", "2026-10-07", "CMB", "SIN")
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
async def test_flight_and_connection_agents_with_aviationstack_data():
    """Two live-shaped legs connecting at SIN: 08:30 local arrival, 10:00 local departure -> 90 min window."""
    data = {
        "UL306": [record(arr_delay=None)],
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
    conn = state.connection_results[0]
    assert conn["airport"] == "SIN"
    assert conn["available_connection_minutes"] == 90
    assert conn["status"] == "MODERATE_RISK"


def test_factory_builds_aviationstack_from_settings(monkeypatch):
    monkeypatch.setattr(provider_module.settings, "FLIGHT_API_KEY", "real-key")
    assert isinstance(provider_module.get_flight_provider("aviationstack"), AviationStackFlightProvider)


@pytest.mark.parametrize("key", [None, "", "mock_key"])
def test_factory_requires_a_real_key(monkeypatch, key):
    monkeypatch.setattr(provider_module.settings, "FLIGHT_API_KEY", key)
    with pytest.raises(ValueError, match="FLIGHT_API_KEY"):
        provider_module.get_flight_provider("aviationstack")


def test_factory_honours_use_mock_flights_switch(monkeypatch):
    monkeypatch.setattr(provider_module.settings, "FLIGHT_API_KEY", "real-key")
    monkeypatch.setattr(provider_module.settings, "FLIGHT_PROVIDER", "aviationstack")
    monkeypatch.setattr(provider_module.settings, "USE_MOCK_FLIGHTS", False)
    assert isinstance(provider_module.get_flight_provider(), AviationStackFlightProvider)

    monkeypatch.setattr(provider_module.settings, "USE_MOCK_FLIGHTS", True)
    assert provider_module.get_flight_provider().name == "MockFlightProvider"
