"""Journey analyze request validation (blueprint 15.2): malformed input is rejected with 422."""
import pytest
from httpx import AsyncClient, ASGITransport
from pydantic import ValidationError

from app.main import app
from app.schemas.journey import FlightLegInput, JourneyAnalyzeRequest


def leg(**overrides):
    return {"flight_number": "UL001", "travel_date": "2026-09-15", "origin": "CMB", "destination": "KUL", **overrides}


def test_values_are_normalised():
    parsed = FlightLegInput(**leg(flight_number=" ul 001 ", origin=" cmb", destination="kul "))
    assert (parsed.flight_number, parsed.origin, parsed.destination) == ("UL001", "CMB", "KUL")


@pytest.mark.parametrize("flight_number", ["UL001", "SQ638", "U21234A", "9W12", "ALK225"])
def test_valid_flight_numbers(flight_number):
    assert FlightLegInput(**leg(flight_number=flight_number)).flight_number == flight_number


@pytest.mark.parametrize("overrides", [
    {"flight_number": "<script>"}, {"flight_number": "bad!"}, {"flight_number": "306"},
    {"flight_number": "12345"}, {"flight_number": "UL12345"},
    {"origin": "CM"}, {"origin": "CMBX"}, {"destination": "K1L"}, {"destination": "CMB"},
    {"travel_date": "2026-02-30"}, {"travel_date": "15/09/2026"}, {"travel_date": "20260915"},
])
def test_invalid_legs_rejected(overrides):
    with pytest.raises(ValidationError):
        FlightLegInput(**leg(**overrides))


def test_leg_count_bounds():
    with pytest.raises(ValidationError):
        JourneyAnalyzeRequest(legs=[])
    with pytest.raises(ValidationError):
        JourneyAnalyzeRequest(legs=[leg()] * 5)
    assert len(JourneyAnalyzeRequest(legs=[leg()] * 4).legs) == 4


@pytest.mark.asyncio
async def test_api_returns_422_for_malformed_leg():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/journeys/analyze", json={"legs": [leg(flight_number="<script>")]})
    assert response.status_code == 422
