import asyncio
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from pydantic import ValidationError

from app.agents.alternative_agent import AlternativeAgent
from app.agents.recovery_agent import RecoveryAgent
from app.config import settings
from app.orchestrator.state import JourneyState
from app.providers.flight.aviationstack import AviationStackFlightProvider
from app.providers.flight.base import FlightDataUnavailableError
from app.providers.flight.cache import FlightCache
from app.providers.flight.settings import flight_settings
from app.providers.flight.search import MockFlightSearch, ScheduleFlightSearch, UnavailableFlightSearch, get_flight_search_provider
from app.ranking.alternative_ranker import rank_alternatives
from app.ranking.config import RankingConfig
from app.ranking.filters import reject_reason
from app.schemas.alternative import AlternativeCandidate, AlternativeSearchRequest, AlternativeSearchResult
from app.schemas.flight import FlightResult

NOW = datetime(2026, 10, 8, 10, tzinfo=timezone.utc)
CONFIG = RankingConfig()
QUERY = AlternativeSearchRequest(origin="KUL", destination="NRT", earliest_departure=NOW + timedelta(hours=1), latest_departure=NOW + timedelta(hours=49))


def flight(**updates):
    data = dict(flight_number="MH088", origin="KUL", destination="NRT", status="SCHEDULED",
                scheduled_departure="2026-10-08T12:00:00Z", scheduled_arrival="2026-10-08T19:00:00Z",
                source="Test schedule provider", data_mode="live", retrieved_at=NOW.isoformat())
    return FlightResult(**(data | updates))


def candidate(**updates):
    return AlternativeCandidate(legs=[flight(**updates)])


def connection_candidate(minutes=80):
    first = flight(destination="SIN", scheduled_arrival="2026-10-08T13:00:00Z")
    departure = datetime(2026, 10, 8, 13, tzinfo=timezone.utc) + timedelta(minutes=minutes)
    second = flight(flight_number="SQ638", origin="SIN", scheduled_departure=departure.isoformat(),
                    scheduled_arrival=(departure + timedelta(hours=7)).isoformat())
    return AlternativeCandidate(legs=[first, second])


def disrupted_state():
    return JourneyState(origin="CMB", destination="NRT", flight_results=[
        flight(flight_number="UL001", origin="CMB", destination="KUL", status="DELAYED",
               scheduled_departure="2026-10-08T10:00:00Z", scheduled_arrival="2026-10-08T15:30:00Z",
               estimated_arrival="2026-10-08T17:00:00Z", delay_minutes=90).model_dump(),
        flight(flight_number="XX123", scheduled_departure="2026-10-08T17:30:00Z", scheduled_arrival="2026-10-09T01:00:00Z").model_dump(),
    ], connection_results=[{"status": "LIKELY_MISSED", "connection_index": 0}], risk_analysis={"score": 73})


@pytest.mark.parametrize("updates,reason", [
    *[({"status": status}, "FLIGHT_NOT_BOARDABLE") for status in ["CANCELLED", "DEPARTED", "LANDED", "UNKNOWN", "DIVERTED"]],
    ({"actual_departure": "2026-10-08T09:00:00Z"}, "FLIGHT_NOT_BOARDABLE"),
    ({"scheduled_departure": "2026-10-08T09:00:00Z"}, "OUTSIDE_DEPARTURE_WINDOW"),
    ({"scheduled_departure": "2026-10-08T10:59:00Z"}, "OUTSIDE_DEPARTURE_WINDOW"),
    ({"scheduled_departure": "2026-10-08T12:00:00"}, "INVALID_TIMING"),
    ({"scheduled_arrival": None}, "INVALID_TIMING"),
    ({"scheduled_arrival": "2026-10-08T11:00:00Z"}, "INVALID_TIMING"),
    ({"scheduled_arrival": "2026-10-11T11:00:00Z"}, "EXCESSIVE_DURATION"),
    ({"retrieved_at": "2026-10-08T09:44:59Z"}, "STALE_SCHEDULE"),
    ({"retrieved_at": "2026-10-08T11:00:00Z"}, "STALE_SCHEDULE"),
    ({"data_mode": "none"}, "UNVERIFIED_SCHEDULE"),
    ({"reason_codes": ["TIMEZONE_UNVERIFIED"]}, "UNVERIFIED_SCHEDULE"),
    ({"origin": "CMB"}, "ROUTE_MISMATCH"),
    ({"destination": "LHR"}, "ROUTE_MISMATCH"),
])
def test_invalid_candidates_are_filtered_before_ranking(updates, reason):
    assert reject_reason(candidate(**updates), QUERY, CONFIG, NOW) == reason


def test_transfer_threshold_includes_configured_margin():
    assert reject_reason(connection_candidate(79), QUERY, CONFIG, NOW) == "INSUFFICIENT_CONNECTION"
    assert reject_reason(connection_candidate(80), QUERY, CONFIG, NOW) is None
    assert reject_reason(connection_candidate(80), QUERY, RankingConfig(max_stops=0), NOW) == "TOO_MANY_STOPS"


def test_airport_change_and_loops_are_rejected():
    route = connection_candidate()
    route.legs[1].origin = "BKK"
    assert reject_reason(route, QUERY, CONFIG, NOW) == "AIRPORT_MISMATCH"
    route.legs[0].destination = "KUL"
    route.legs[1].origin = "KUL"
    assert reject_reason(route, QUERY, CONFIG, NOW) == "ROUTE_LOOP"


def test_offsets_and_date_rollover_are_compared_as_instants():
    route = candidate(scheduled_departure="2026-10-09T00:00:00+09:00", scheduled_arrival="2026-10-09T07:00:00+09:00")
    assert reject_reason(route, QUERY, CONFIG, NOW) is None


@pytest.mark.asyncio
async def test_ranking_is_deterministic_auditable_and_deduplicated():
    first, second = candidate(), candidate(flight_number="MH089")
    results = []
    for candidates in [[second, first, first], [first, second, first]]:
        options, rejected = await rank_alternatives(AlternativeSearchResult(candidates=candidates), QUERY, CONFIG, NOW)
        assert rejected == {"DUPLICATE": 1}
        assert [option.rank for option in options] == [1, 2]
        for option in options:
            assert option.price == option.availability_status == option.policy_eligibility == "UNKNOWN"
            assert option.risk_missing_data == ["weather"]
            assert option.risk_confidence != "high"
            expected = round(100 * sum(option.ranking_factors[k] * w for k, w in CONFIG.weights.items()), 2)
            assert abs(option.ranking_score - expected) <= 0.01
        results.append([option.option_id for option in options])
    assert results[0] == results[1]


@pytest.mark.asyncio
async def test_ranking_preferences_are_configuration_not_llm_choices():
    fast = candidate(flight_number="MH100", scheduled_arrival="2026-10-08T17:00:00Z", status="DELAYED", delay_minutes=90)
    slow = candidate(flight_number="MH200", scheduled_arrival="2026-10-08T21:00:00Z")
    data = AlternativeSearchResult(candidates=[fast, slow])
    normal, _ = await rank_alternatives(data, QUERY, CONFIG, NOW)
    assert normal[0].legs[0].flight_number == "MH200"
    speed = RankingConfig(weights={key: float(key == "arrival_quality") for key in CONFIG.weights})
    changed, _ = await rank_alternatives(data, QUERY, speed, NOW)
    assert changed[0].legs[0].flight_number == "MH100"


@pytest.mark.parametrize("updates", [{"weights": {"cost": 1}}, {"weights": dict(CONFIG.weights, stops=0.9)},
                                     {"weights": dict(CONFIG.weights, stops=float("nan"))}, {"transfer_airports": ["SIN", "KUL", "DOH"]}])
def test_invalid_ranking_configuration_fails_fast(updates):
    with pytest.raises(ValidationError):
        RankingConfig(**updates)


def test_search_contract_rejects_personal_attributes_and_naive_times():
    with pytest.raises(ValidationError):
        AlternativeSearchRequest(**QUERY.model_dump(), gender="female")
    with pytest.raises(ValidationError):
        AlternativeSearchRequest(**(QUERY.model_dump() | {"earliest_departure": NOW.replace(tzinfo=None)}))


def test_recovery_context_uses_delayed_arrival_not_original_origin():
    query, _ = AlternativeAgent(provider=UnavailableFlightSearch())._search_context(disrupted_state(), NOW)
    assert query.origin == "KUL" and query.destination == "NRT"
    assert query.earliest_departure == datetime(2026, 10, 8, 18, 20, tzinfo=timezone.utc)


def test_cancelled_inbound_recovers_at_origin_not_unreachable_transfer():
    state = disrupted_state()
    state.flight_results[0]["status"] = "CANCELLED"
    query, _ = AlternativeAgent(provider=UnavailableFlightSearch())._search_context(state, NOW)
    assert query.origin == "CMB" and query.earliest_departure == NOW + timedelta(hours=1)


def test_earlier_missed_connection_precedes_later_cancellation():
    state = disrupted_state()
    state.flight_results += [flight(flight_number="ZZ555", origin="NRT", destination="LAX", status="CANCELLED").model_dump()]
    state.destination = "LAX"
    query, _ = AlternativeAgent(provider=UnavailableFlightSearch())._search_context(state, NOW)
    assert query.origin == "KUL" and query.destination == "LAX"


@pytest.mark.asyncio
async def test_demo_agent_returns_future_options_and_preserves_other_state():
    state = disrupted_state()
    before = state.model_copy(deep=True)
    agent = AlternativeAgent(provider=MockFlightSearch(CONFIG, now=lambda: NOW), now=lambda: NOW)
    result = await agent.execute(state)
    assert result.status == "partial"
    assert state.alternative_options and state.recommended_option == state.alternative_options[0]
    assert state.flight_results == before.flight_results and state.risk_analysis == before.risk_analysis
    assert state.policy_evidence == before.policy_evidence
    assert all(option["data_mode"] == "demo" for option in state.alternative_options)
    assert all(not source["verified"] for source in state.sources)
    assert all(datetime.fromisoformat(option["departure"]) >= NOW for option in state.alternative_options)


@pytest.mark.asyncio
@pytest.mark.parametrize("mode", ["failure", "timeout", "empty", "all_requests_failed", "unexpected_error"])
async def test_unavailable_or_empty_search_clears_stale_recommendations(mode):
    class Provider:
        name = "TestProvider"

        async def search(self, query):
            if mode == "failure":
                raise FlightDataUnavailableError("request?access_key=private-secret")
            if mode == "unexpected_error":
                raise RuntimeError("request?access_key=private-secret")
            if mode == "timeout":
                await asyncio.sleep(1)
            return AlternativeSearchResult(available=mode != "all_requests_failed")

    state = disrupted_state()
    state.alternative_options, state.recommended_option = [{"old": True}], {"old": True}
    await AlternativeAgent(provider=Provider(), config=RankingConfig(timeout_seconds=0.01), now=lambda: NOW).execute(state)
    assert state.alternative_options == [] and state.recommended_option is None
    assert state.alternative_search["status"] == ("no_results" if mode == "empty" else "unavailable")
    assert "private-secret" not in str(state.model_dump())


@pytest.mark.asyncio
async def test_missing_or_diverted_context_does_not_search():
    class Provider:
        name = "Never called"

        async def search(self, query):
            pytest.fail("Unverified recovery location must not start a search")

    for state in [JourneyState(), disrupted_state()]:
        if state.flight_results:
            state.flight_results[0]["status"] = "DIVERTED"
        await AlternativeAgent(provider=Provider(), now=lambda: NOW).execute(state)
        assert state.alternative_search["status"] == "unavailable"


@pytest.mark.asyncio
async def test_bounded_schedule_search_supports_partial_failures():
    class Departures:
        def __init__(self):
            self.calls = []

        async def search_departures(self, airport, day):
            self.calls.append((airport, day))
            if airport != "KUL":
                raise FlightDataUnavailableError("unavailable")
            return [flight()]

    provider = Departures()
    result = await ScheduleFlightSearch(provider, RankingConfig(max_provider_requests=4)).search(QUERY)
    assert len(provider.calls) == 4
    assert result.candidates and not result.complete and result.available
    assert any("unavailable" in warning for warning in result.warnings)


def test_live_search_never_selects_mock_when_key_is_missing(monkeypatch):
    monkeypatch.setattr(settings, "ALTERNATIVE_PROVIDER", "auto")
    monkeypatch.setattr(settings, "USE_MOCK_FLIGHTS", False)
    monkeypatch.setattr(settings, "FLIGHT_PROVIDER", "auto")
    monkeypatch.setattr(settings, "FLIGHT_API_KEY", "mock_key")
    monkeypatch.setattr(flight_settings, "AERODATABOX_API_KEY", "")
    assert isinstance(get_flight_search_provider(CONFIG), UnavailableFlightSearch)


@pytest.mark.asyncio
async def test_aviationstack_departure_search_filters_records_and_reuses_cache():
    calls = []
    record = {"flight_date": "2026-10-08", "flight_status": "scheduled", "flight": {"iata": "MH088"},
              "departure": {"iata": "KUL", "scheduled": "2026-10-08T20:00:00+00:00", "timezone": "Asia/Kuala_Lumpur"},
              "arrival": {"iata": "NRT", "scheduled": "2026-10-09T04:00:00+00:00", "timezone": "Asia/Tokyo"}}

    def respond(request):
        calls.append(request)
        return httpx.Response(200, json={"data": [record, "malformed", record | {"flight_date": "2026-10-07"}, record | {"departure": {"iata": "CMB"}}]})

    cache = FlightCache()
    provider = AviationStackFlightProvider(api_key="test-key", transport=httpx.MockTransport(respond), cache=cache)
    first = await provider.search_departures("KUL", "2026-10-08")
    second = await provider.search_departures("KUL", "2026-10-08")
    assert len(calls) == 1 and len(first) == len(second) == 1
    assert first[0].scheduled_departure == "2026-10-08T12:00:00Z"
    assert calls[0].url.params["dep_iata"] == "KUL" and calls[0].url.params["limit"] == "100"
    assert cache.calls_this_month("AviationStack") == 1


@pytest.mark.asyncio
async def test_recovery_does_not_invent_alternatives_or_free_rebooking():
    state = disrupted_state()
    await RecoveryAgent().execute(state)
    assert "No feasible alternative was verified" in state.recommendation_text
    assert "complimentary rebooking" not in state.recommendation_text
    assert "safest route" not in state.recommendation_text


@pytest.mark.asyncio
async def test_original_unverified_timing_does_not_start_a_search():
    state = disrupted_state()
    state.flight_results[0]["reason_codes"] = ["TIMEZONE_UNVERIFIED"]
    await AlternativeAgent(provider=UnavailableFlightSearch(), now=lambda: NOW).execute(state)
    assert state.alternative_search["status"] == "unavailable"
    assert "origin" not in state.alternative_search
