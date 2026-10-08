import pytest
from app.orchestrator.state import JourneyState
from app.agents.flight_agent import FlightAgent
from app.agents.connection_agent import ConnectionAgent, evaluate_connection, classify_connection


def inbound(arrival, **extra):
    return {"flight_number": "UL001", "origin": "CMB", "destination": "KUL", "estimated_arrival": arrival, **extra}


def outbound(departure, **extra):
    return {"flight_number": "XX123", "origin": "KUL", "destination": "NRT", "scheduled_departure": departure, **extra}


def test_arrival_1500_next_flight_1700_is_safe():
    conn = evaluate_connection(inbound("2026-09-15T15:00:00Z"), outbound("2026-09-15T17:00:00Z"), mct_minutes=60)

    assert conn.available_connection_minutes == 120
    assert conn.minimum_required_minutes == 60
    assert conn.buffer_minutes == 60
    assert conn.status == "SAFE"
    assert conn.airport == "KUL"


def test_arrival_1530_next_flight_1600_is_likely_missed():
    conn = evaluate_connection(inbound("2026-09-15T15:30:00Z"), outbound("2026-09-15T16:00:00Z"), mct_minutes=60)

    assert conn.available_connection_minutes == 30
    assert conn.buffer_minutes == -30
    assert conn.status == "LIKELY_MISSED"
    assert "BELOW_MINIMUM_CONNECTION_TIME" in conn.reason_codes


def test_next_flight_leaves_before_arrival_is_missed():
    conn = evaluate_connection(inbound("2026-09-15T17:00:00Z"), outbound("2026-09-15T16:20:00Z"), mct_minutes=60)

    assert conn.available_connection_minutes == -40
    assert conn.status == "MISSED"
    assert "NEGATIVE_CONNECTION_WINDOW" in conn.reason_codes


@pytest.mark.parametrize("available,expected", [
    (-1, "MISSED"),
    (0, "LIKELY_MISSED"),
    (59, "LIKELY_MISSED"),
    (60, "HIGH_RISK"),
    (79, "HIGH_RISK"),
    (80, "MODERATE_RISK"),
    (104, "MODERATE_RISK"),
    (105, "SAFE"),
])
def test_status_thresholds(available, expected):
    status, _ = classify_connection(available, mct_minutes=60)
    assert status == expected


def test_missing_arrival_time_is_unknown():
    conn = evaluate_connection(inbound(None), outbound("2026-09-15T16:00:00Z"), mct_minutes=60)

    assert conn.status == "UNKNOWN"
    assert conn.reason_codes == ["MISSING_TIMING_DATA"]
    assert conn.available_connection_minutes == 0


def test_missing_departure_time_is_unknown():
    conn = evaluate_connection(inbound("2026-09-15T15:00:00Z"), outbound(None), mct_minutes=60)

    assert conn.status == "UNKNOWN"
    assert conn.reason_codes == ["MISSING_TIMING_DATA"]


def test_unreadable_time_is_unknown():
    conn = evaluate_connection(inbound("15:00 tomorrow"), outbound("2026-09-15T16:00:00Z"), mct_minutes=60)

    assert conn.status == "UNKNOWN"
    assert conn.reason_codes == ["INVALID_TIME_FORMAT"]


def test_cancelled_inbound_flight_misses_connection():
    conn = evaluate_connection(inbound(None, status="CANCELLED"), outbound("2026-09-15T16:00:00Z"), mct_minutes=60)

    assert conn.status == "MISSED"
    assert conn.reason_codes == ["INBOUND_FLIGHT_CANCELLED"]


def test_cancelled_outbound_flight_misses_connection():
    conn = evaluate_connection(inbound("2026-09-15T15:00:00Z"), outbound("2026-09-15T18:00:00Z", status="CANCELLED"), mct_minutes=60)

    assert conn.status == "MISSED"
    assert conn.reason_codes == ["OUTBOUND_FLIGHT_CANCELLED"]


def test_diverted_inbound_flight_is_likely_missed():
    conn = evaluate_connection(inbound("2026-09-15T15:00:00Z", status="DIVERTED"), outbound("2026-09-15T18:00:00Z"), mct_minutes=60)

    assert conn.status == "LIKELY_MISSED"
    assert conn.reason_codes == ["INBOUND_FLIGHT_DIVERTED"]


def test_legs_that_do_not_share_an_airport_are_unknown():
    conn = evaluate_connection(
        inbound("2026-09-15T15:00:00Z", destination="NRT"),
        outbound("2026-09-15T18:00:00Z", origin="HND"),
        mct_minutes=60,
    )

    assert conn.status == "UNKNOWN"
    assert conn.reason_codes == ["AIRPORT_MISMATCH"]
    assert conn.airport == "NRT/HND"


def test_actual_and_estimated_times_take_priority_over_scheduled():
    conn = evaluate_connection(
        {"flight_number": "UL001", "destination": "KUL", "scheduled_arrival": "2026-09-15T15:30:00Z",
         "estimated_arrival": "2026-09-15T16:00:00Z", "actual_arrival": "2026-09-15T16:10:00Z", "delay_minutes": 40},
        {"flight_number": "XX123", "origin": "KUL", "scheduled_departure": "2026-09-15T17:30:00Z",
         "estimated_departure": "2026-09-15T18:00:00Z", "delay_minutes": 30},
        mct_minutes=60,
    )

    assert conn.expected_arrival == "2026-09-15T16:10:00Z"
    assert conn.next_departure == "2026-09-15T18:00:00Z"
    assert conn.available_connection_minutes == 110
    assert conn.reason_codes == ["INBOUND_FLIGHT_DELAYED", "OUTBOUND_FLIGHT_DELAYED", "SUFFICIENT_TRANSFER_TIME"]


def test_known_inbound_delay_is_applied_when_only_scheduled_arrival_is_known():
    conn = evaluate_connection(
        {"flight_number": "UL001", "destination": "KUL", "status": "DELAYED", "delay_minutes": 90,
         "scheduled_arrival": "2026-09-15T15:30:00Z"},
        outbound("2026-09-15T17:30:00Z"),
        mct_minutes=60,
    )

    assert conn.expected_arrival == "2026-09-15T17:00:00Z"
    assert conn.available_connection_minutes == 30
    assert conn.status == "LIKELY_MISSED"
    assert "ARRIVAL_ESTIMATED_FROM_DELAY" in conn.reason_codes


def test_known_outbound_delay_is_applied_when_only_scheduled_departure_is_known():
    conn = evaluate_connection(inbound("2026-09-15T15:30:00Z"), outbound("2026-09-15T16:00:00Z", delay_minutes=60), mct_minutes=60)

    assert conn.next_departure == "2026-09-15T17:00:00Z"
    assert conn.available_connection_minutes == 90
    assert "DEPARTURE_ESTIMATED_FROM_DELAY" in conn.reason_codes


def test_naive_timestamps_are_treated_as_utc():
    conn = evaluate_connection(inbound("2026-09-15T15:00:00"), outbound("2026-09-15T17:00:00Z"), mct_minutes=60)

    assert conn.available_connection_minutes == 120


def test_connection_across_midnight():
    conn = evaluate_connection(inbound("2026-09-15T23:30:00Z"), outbound("2026-09-16T01:00:00Z"), mct_minutes=60)

    assert conn.available_connection_minutes == 90
    assert conn.status == "MODERATE_RISK"


def test_mixed_timezone_offsets():
    # 15:00 UTC arrival vs 22:30 at +05:30 (= 17:00 UTC) departure
    conn = evaluate_connection(inbound("2026-09-15T15:00:00Z"), outbound("2026-09-15T22:30:00+05:30"), mct_minutes=60)

    assert conn.available_connection_minutes == 120


@pytest.mark.asyncio
async def test_direct_flight_has_no_connections():
    state = JourneyState(flight_results=[inbound("2026-09-15T15:00:00Z")])
    result = await ConnectionAgent().execute(state)

    assert result.status == "success"
    assert state.connection_results == []


@pytest.mark.asyncio
async def test_every_connection_in_a_three_leg_journey_is_evaluated():
    state = JourneyState(flight_results=[
        inbound("2026-09-15T15:00:00Z"),
        outbound("2026-09-15T17:00:00Z", estimated_arrival="2026-09-16T01:00:00Z"),
        {"flight_number": "JL001", "origin": "NRT", "destination": "HND", "scheduled_departure": "2026-09-16T01:30:00Z"},
    ])
    result = await ConnectionAgent(default_mct_minutes=60).execute(state)

    assert [c["connection_index"] for c in state.connection_results] == [0, 1]
    assert [c["airport"] for c in state.connection_results] == ["KUL", "NRT"]
    assert [c["status"] for c in state.connection_results] == ["SAFE", "LIKELY_MISSED"]


@pytest.mark.asyncio
async def test_per_airport_minimum_connection_time():
    state = JourneyState(flight_results=[inbound("2026-09-15T15:00:00Z"), outbound("2026-09-15T16:30:00Z")])
    await ConnectionAgent(default_mct_minutes=60, mct_by_airport={"KUL": 120}).execute(state)

    conn = state.connection_results[0]
    assert conn["minimum_required_minutes"] == 120
    assert conn["status"] == "LIKELY_MISSED"


@pytest.mark.asyncio
async def test_unknown_connection_is_reported_as_partial_with_warning():
    state = JourneyState(flight_results=[inbound(None), outbound("2026-09-15T16:00:00Z")])
    result = await ConnectionAgent().execute(state)

    assert result.status == "partial"
    assert result.confidence == "low"
    assert "could not be assessed" in result.warnings[0]
    assert result.warnings[0] in state.warnings


@pytest.mark.asyncio
async def test_connection_result_keeps_fields_used_by_risk_agent_and_api():
    state = JourneyState(flight_results=[inbound("2026-09-15T15:30:00Z"), outbound("2026-09-15T16:00:00Z")])
    await ConnectionAgent().execute(state)

    conn = state.connection_results[0]
    for field in ["airport", "available_connection_minutes", "minimum_required_minutes", "buffer_minutes", "status", "reason_codes"]:
        assert field in conn


@pytest.mark.asyncio
async def test_mock_flight_to_connection_mini_flow():
    """MockFlightProvider -> Flight Agent (90 min delay) -> Connection Agent -> LIKELY_MISSED."""
    state = JourneyState(journey_legs=[
        {"flight_number": "UL001", "travel_date": "2026-09-15", "origin": "CMB", "destination": "KUL"},
        {"flight_number": "XX123", "travel_date": "2026-09-15", "origin": "KUL", "destination": "NRT"},
    ])
    await FlightAgent().execute(state)
    result = await ConnectionAgent(default_mct_minutes=60).execute(state)

    assert state.flight_results[0]["delay_minutes"] == 90
    conn = state.connection_results[0]
    assert result.status == "success"
    assert conn["airport"] == "KUL"
    assert conn["expected_arrival"] == "2026-09-15T17:00:00Z"
    assert conn["next_departure"] == "2026-09-15T17:30:00Z"
    assert conn["available_connection_minutes"] == 30
    assert conn["minimum_required_minutes"] == 60
    assert conn["buffer_minutes"] == -30
    assert conn["status"] == "LIKELY_MISSED"
    assert "INBOUND_FLIGHT_DELAYED" in conn["reason_codes"]


@pytest.mark.asyncio
async def test_safe_connection_mini_flow():
    state = JourneyState(journey_legs=[
        {"flight_number": "UL306", "travel_date": "2026-09-15", "origin": "CMB", "destination": "SIN"},
        {"flight_number": "SQ638", "travel_date": "2026-09-15", "origin": "SIN", "destination": "NRT"},
    ])
    await FlightAgent().execute(state)
    await ConnectionAgent().execute(state)

    assert state.connection_results[0]["available_connection_minutes"] == 120
    assert state.connection_results[0]["status"] == "SAFE"
