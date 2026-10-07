import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.providers.airports import get_airport, search_airports, airport_timezone
from app.orchestrator.state import JourneyState
from app.agents.flight_agent import FlightAgent


def codes(query, limit=5):
    return [a.iata for a in search_airports(query, limit)]


@pytest.mark.parametrize("query,first", [
    ("colombo", "CMB"),      # main airport before Ratmalana (RML)
    ("Colombo", "CMB"),
    ("cmb", "CMB"),
    ("kuala lumpur", "KUL"),
    ("singapore", "SIN"),
    ("delhi", "DEL"),
    ("zürich", "ZRH"),       # accents ignored
    ("zurich", "ZRH"),
    ("narita", "NRT"),
])
def test_search_puts_the_expected_airport_first(query, first):
    assert codes(query)[0] == first


def test_city_with_several_airports_lists_them_all():
    assert {"HND", "NRT"} <= set(codes("tokyo"))
    assert {"LHR", "LGW"} <= set(codes("london", 8))


@pytest.mark.parametrize("query", ["", "a", " "])
def test_too_short_queries_return_nothing(query):
    assert search_airports(query) == []


def test_limit_is_respected_and_capped():
    assert len(search_airports("international", 3)) == 3
    assert len(search_airports("international", 500)) == 20


def test_get_airport_details_and_cleaned_name():
    cmb = get_airport("cmb")
    assert cmb.iata == "CMB" and cmb.city == "Colombo" and cmb.country == "LK"
    assert cmb.timezone == "Asia/Colombo"
    assert "Apt" not in cmb.name and cmb.name.count("Airport") == 1
    assert cmb.major is True
    assert get_airport("QQQ") is None
    assert get_airport(None) is None
    assert airport_timezone("NRT") == "Asia/Tokyo"


@pytest.mark.asyncio
async def test_search_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        ok = await client.get("/api/airports/search", params={"q": "colombo"})
        short = await client.get("/api/airports/search", params={"q": "c"})
        long = await client.get("/api/airports/search", params={"q": "x" * 65})
        one = await client.get("/api/airports/cmb")
        missing = await client.get("/api/airports/QQQ")
        bad = await client.get("/api/airports/<script>")

    assert ok.status_code == 200 and ok.json()[0]["iata"] == "CMB"
    assert ok.json()[0]["timezone"] == "Asia/Colombo"
    assert short.status_code == 422 and long.status_code == 422
    assert one.status_code == 200 and one.json()["city"] == "Colombo"
    assert missing.status_code == 404 and bad.status_code == 404


@pytest.mark.asyncio
async def test_flight_agent_rejects_airport_codes_that_do_not_exist():
    state = JourneyState(journey_legs=[{"flight_number": "UL001", "travel_date": "2026-09-15", "origin": "QQQ", "destination": "KUL"}])
    await FlightAgent().execute(state)

    flight = state.flight_results[0]
    assert flight["status"] == "UNKNOWN"
    assert flight["reason_codes"] == ["UNKNOWN_AIRPORT"]


@pytest.mark.asyncio
async def test_flight_results_carry_airport_names_and_timezones():
    state = JourneyState(journey_legs=[{"flight_number": "UL001", "travel_date": "2026-09-15", "origin": "CMB", "destination": "KUL"}])
    await FlightAgent().execute(state)

    flight = state.flight_results[0]
    assert flight["origin_city"] == "Colombo" and flight["destination_city"] == "Kuala Lumpur"
    assert flight["origin_timezone"] == "Asia/Colombo" and flight["destination_timezone"] == "Asia/Kuala_Lumpur"
    assert flight["data_mode"] == "demo"
