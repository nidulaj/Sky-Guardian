import asyncio
import re
import pytest
from app.orchestrator.state import JourneyState
from app.agents.flight_agent import FlightAgent
from app.providers.flight.base import FlightDataProvider, FlightNotFoundError, FlightDataUnavailableError
from app.providers.flight.mock import MockFlightProvider
from app.providers.flight.provider import get_flight_provider
from app.schemas.flight import FlightResult, FLIGHT_NUMBER_PATTERN


def leg(flight_number, origin, destination, travel_date="2026-09-15"):
    return {"flight_number": flight_number, "travel_date": travel_date, "origin": origin, "destination": destination}


async def run_agent(legs, provider=None, **kwargs):
    state = JourneyState(journey_legs=legs)
    result = await FlightAgent(provider=provider, **kwargs).execute(state)
    return state, result


class RaisingProvider(FlightDataProvider):
    """Provider stub that always fails with the given exception."""
    name = "RaisingProvider"

    def __init__(self, exc):
        self.exc = exc
        self.calls = 0

    async def get_flight_status(self, flight_number, travel_date, origin, destination):
        self.calls += 1
        raise self.exc


class SlowProvider(FlightDataProvider):
    name = "SlowProvider"

    async def get_flight_status(self, flight_number, travel_date, origin, destination):
        await asyncio.sleep(5)


class FixedProvider(FlightDataProvider):
    """Provider stub returning a pre-built FlightResult."""
    name = "FixedProvider"

    def __init__(self, result: FlightResult):
        self.result = result

    async def get_flight_status(self, flight_number, travel_date, origin, destination):
        return self.result.model_copy()


@pytest.mark.asyncio
async def test_delayed_flight_is_detected():
    state, result = await run_agent([leg("UL001", "CMB", "KUL")])

    flight = state.flight_results[0]
    assert result.agent == "flight_agent"
    assert result.status == "success"
    assert result.confidence == "high"
    assert flight["flight_number"] == "UL001"
    assert flight["status"] == "DELAYED"
    assert flight["delay_minutes"] == 90
    assert flight["scheduled_arrival"] == "2026-09-15T15:30:00Z"
    assert flight["estimated_arrival"] == "2026-09-15T17:00:00Z"
    assert flight["source"] == "MockFlightProvider (Demo Data)"


@pytest.mark.asyncio
async def test_on_time_flight():
    state, result = await run_agent([leg("XX123", "KUL", "NRT")])

    flight = state.flight_results[0]
    assert flight["status"] == "ON_TIME"
    assert flight["delay_minutes"] == 0
    assert flight["scheduled_departure"] == "2026-09-15T17:30:00Z"
    # Arrives after midnight UTC, so the arrival is on the next day
    assert flight["scheduled_arrival"] == "2026-09-16T01:00:00Z"


@pytest.mark.asyncio
async def test_cancelled_flight():
    state, result = await run_agent([leg("UL504", "CMB", "LHR")])

    flight = state.flight_results[0]
    assert result.status == "success"
    assert flight["status"] == "CANCELLED"
    assert flight["estimated_departure"] is None
    assert flight["estimated_arrival"] is None


@pytest.mark.asyncio
async def test_flight_data_unavailable():
    provider = RaisingProvider(FlightDataUnavailableError("upstream down"))
    state, result = await run_agent([leg("UL001", "CMB", "KUL")], provider=provider)

    flight = state.flight_results[0]
    assert result.status == "unavailable"
    assert result.confidence == "low"
    assert flight["status"] == "UNKNOWN"
    assert flight["reason_codes"] == ["FLIGHT_DATA_UNAVAILABLE"]
    assert "temporarily unavailable" in result.warnings[0]
    assert result.warnings[0] in state.warnings


@pytest.mark.asyncio
async def test_mock_provider_simulated_outage():
    state, result = await run_agent([leg("XX503", "CMB", "KUL")])

    assert state.flight_results[0]["reason_codes"] == ["FLIGHT_DATA_UNAVAILABLE"]


@pytest.mark.asyncio
async def test_provider_timeout_is_reported_as_unavailable():
    state, result = await run_agent([leg("UL001", "CMB", "KUL")], provider=SlowProvider(), timeout_seconds=0.05)

    assert state.flight_results[0]["status"] == "UNKNOWN"
    assert state.flight_results[0]["reason_codes"] == ["FLIGHT_DATA_UNAVAILABLE"]


@pytest.mark.asyncio
async def test_unexpected_provider_error_does_not_crash():
    state, result = await run_agent([leg("UL001", "CMB", "KUL")], provider=RaisingProvider(RuntimeError("boom")))

    assert state.flight_results[0]["status"] == "UNKNOWN"
    assert state.flight_results[0]["reason_codes"] == ["PROVIDER_ERROR"]


@pytest.mark.asyncio
async def test_unknown_flight_is_not_invented():
    state, result = await run_agent([leg("AA100", "JFK", "LAX")])

    flight = state.flight_results[0]
    assert flight["status"] == "UNKNOWN"
    assert flight["reason_codes"] == ["FLIGHT_NOT_FOUND"]
    assert flight["scheduled_departure"] is None
    assert flight["scheduled_arrival"] is None


@pytest.mark.asyncio
async def test_different_flight_on_demo_route_is_not_replaced_by_ul001():
    state, result = await run_agent([leg("MH178", "CMB", "KUL")])

    flight = state.flight_results[0]
    assert flight["flight_number"] == "MH178"
    assert flight["status"] == "UNKNOWN"


@pytest.mark.parametrize("good_number", ["UL001", "MH88", "6E1234", "U21234", "BA304A", "SLK123"])
def test_valid_flight_number_formats(good_number):
    assert re.fullmatch(FLIGHT_NUMBER_PATTERN, good_number)


@pytest.mark.parametrize("bad_number", ["", "12", "1234", "000", "UL", "UL12345", "U-L001", "<script>alert(1)</script>", "' OR 1=1 --"])
@pytest.mark.asyncio
async def test_invalid_flight_number_is_rejected_before_provider_call(bad_number):
    provider = RaisingProvider(AssertionError("provider must not be called"))
    state, result = await run_agent([leg(bad_number, "CMB", "KUL")], provider=provider)

    flight = state.flight_results[0]
    assert provider.calls == 0
    assert flight["status"] == "UNKNOWN"
    assert "INVALID_FLIGHT_NUMBER" in flight["reason_codes"]
    # Rejected input is never echoed back verbatim
    assert "<" not in flight["flight_number"] and "'" not in flight["flight_number"]
    assert all("<" not in w for w in result.warnings)


@pytest.mark.parametrize("origin,destination", [("", "KUL"), ("CM", "KUL"), ("CMB", "KUL1"), ("C1B", "KUL"), ("CMB", "<script>"), ("' OR 1=1", "KUL")])
@pytest.mark.asyncio
async def test_invalid_airport_code_is_rejected(origin, destination):
    state, result = await run_agent([leg("UL001", origin, destination)])

    flight = state.flight_results[0]
    assert flight["status"] == "UNKNOWN"
    assert "INVALID_AIRPORT_CODE" in flight["reason_codes"]
    # Rejected airport codes are never echoed back verbatim
    for value in [flight["origin"], flight["destination"], *result.warnings]:
        assert "<" not in value and "'" not in value
    assert len(flight["origin"]) <= 3 and len(flight["destination"]) <= 3


@pytest.mark.asyncio
async def test_oversized_input_is_truncated():
    huge = "UL" + "1" * 10_000
    state, result = await run_agent([leg(huge, "CMB", "KUL")])

    assert state.flight_results[0]["status"] == "UNKNOWN"
    assert len(state.flight_results[0]["flight_number"]) <= 8
    assert all(huge not in w and len(w) < 300 for w in result.warnings)


@pytest.mark.parametrize("travel_date", ["", "2026-13-45", "15/09/2026", "20260915", "2026-W38-2"])
@pytest.mark.asyncio
async def test_invalid_travel_date_is_rejected(travel_date):
    state, result = await run_agent([leg("UL001", "CMB", "KUL", travel_date)])

    assert state.flight_results[0]["status"] == "UNKNOWN"
    assert "INVALID_TRAVEL_DATE" in state.flight_results[0]["reason_codes"]


@pytest.mark.asyncio
async def test_input_is_normalised():
    state, result = await run_agent([leg(" ul 001 ", "cmb", "kul")])

    flight = state.flight_results[0]
    assert flight["flight_number"] == "UL001"
    assert flight["status"] == "DELAYED"
    assert result.warnings == []


@pytest.mark.parametrize("origin,destination", [("JFK", "LAX"), ("CMB", "SIN"), ("DEL", "KUL")])
@pytest.mark.asyncio
async def test_route_mismatch_is_flagged(origin, destination):
    state, result = await run_agent([leg("UL001", origin, destination)])

    flight = state.flight_results[0]
    assert "ROUTE_MISMATCH" in flight["reason_codes"]
    assert result.confidence == "medium"
    assert "CMB → KUL" in result.warnings[0]


@pytest.mark.asyncio
async def test_delay_is_derived_when_provider_omits_it():
    provider = FixedProvider(FlightResult(
        flight_number="UL001", origin="CMB", destination="KUL",
        scheduled_departure="2026-09-15T10:00:00Z", estimated_departure="2026-09-15T10:45:00Z",
        status="ON_TIME", delay_minutes=0, source="FixedProvider", retrieved_at="2026-09-15T08:00:00",
    ))
    state, result = await run_agent([leg("UL001", "CMB", "KUL")], provider=provider)

    flight = state.flight_results[0]
    assert flight["delay_minutes"] == 45
    assert flight["status"] == "DELAYED"
    assert "DELAY_DERIVED_FROM_TIMES" in flight["reason_codes"]


@pytest.mark.asyncio
async def test_delay_is_derived_from_actual_departure():
    provider = FixedProvider(FlightResult(
        flight_number="UL001", origin="CMB", destination="KUL",
        scheduled_departure="2026-09-15T10:00:00Z", actual_departure="2026-09-15T12:00:00Z",
        status="DEPARTED", delay_minutes=0, source="FixedProvider", retrieved_at="2026-09-15T08:00:00",
    ))
    state, result = await run_agent([leg("UL001", "CMB", "KUL")], provider=provider)

    assert state.flight_results[0]["delay_minutes"] == 120
    assert state.flight_results[0]["status"] == "DEPARTED"


@pytest.mark.asyncio
async def test_sub_minute_or_early_departure_is_not_a_delay():
    for estimated in ["2026-09-15T10:00:30Z", "2026-09-15T09:50:00Z"]:
        provider = FixedProvider(FlightResult(
            flight_number="UL001", origin="CMB", destination="KUL",
            scheduled_departure="2026-09-15T10:00:00Z", estimated_departure=estimated,
            status="ON_TIME", delay_minutes=0, source="FixedProvider", retrieved_at="2026-09-15T08:00:00",
        ))
        state, result = await run_agent([leg("UL001", "CMB", "KUL")], provider=provider)

        assert state.flight_results[0]["delay_minutes"] == 0
        assert state.flight_results[0]["status"] == "ON_TIME"
        assert "DELAY_DERIVED_FROM_TIMES" not in state.flight_results[0]["reason_codes"]


@pytest.mark.asyncio
async def test_unreadable_provider_timestamp_is_dropped():
    provider = FixedProvider(FlightResult(
        flight_number="UL001", origin="CMB", destination="KUL",
        scheduled_arrival="not-a-time", status="ON_TIME", source="FixedProvider", retrieved_at="2026-09-15T08:00:00",
    ))
    state, result = await run_agent([leg("UL001", "CMB", "KUL")], provider=provider)

    assert state.flight_results[0]["scheduled_arrival"] is None
    assert "INVALID_TIMESTAMP" in state.flight_results[0]["reason_codes"]


@pytest.mark.asyncio
async def test_partial_result_when_some_legs_fail():
    state, result = await run_agent([leg("UL001", "CMB", "KUL"), leg("ZZ999", "KUL", "NRT")])

    assert result.status == "partial"
    assert result.confidence == "medium"
    assert [f["status"] for f in state.flight_results] == ["DELAYED", "UNKNOWN"]


@pytest.mark.asyncio
async def test_flight_agent_does_not_compute_risk():
    state, result = await run_agent([leg("UL001", "CMB", "KUL")])

    assert state.risk_analysis is None
    assert state.connection_results == []
    assert state.alternative_options == []


@pytest.mark.asyncio
async def test_results_keep_leg_order():
    legs = [leg("XX123", "KUL", "NRT"), leg("UL001", "CMB", "KUL"), leg("SQ638", "SIN", "NRT")]
    state, result = await run_agent(legs)

    assert [f["flight_number"] for f in state.flight_results] == ["XX123", "UL001", "SQ638"]


def test_provider_factory_returns_mock_by_default():
    assert isinstance(get_flight_provider(), MockFlightProvider)
    assert isinstance(get_flight_provider("mock"), MockFlightProvider)


def test_provider_factory_rejects_unknown_provider():
    with pytest.raises(ValueError, match="Unknown FLIGHT_PROVIDER"):
        get_flight_provider("flightaware")


@pytest.mark.asyncio
async def test_mock_provider_raises_not_found_for_unknown_flight():
    with pytest.raises(FlightNotFoundError):
        await MockFlightProvider().get_flight_status("AA100", "2026-09-15", "JFK", "LAX")
