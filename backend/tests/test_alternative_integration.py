from datetime import date

import httpx
import pytest

from app.api import journeys
from app.main import app
from app.providers.flight.base import FlightDataUnavailableError


def payload(legs):
    return {"language": "en", "legs": [{"flight_number": number, "origin": origin, "destination": destination,
                                          "travel_date": date.today().isoformat()} for number, origin, destination in legs]}


@pytest.mark.asyncio
async def test_live_search_failure_does_not_break_journey_or_invent_options(monkeypatch):
    class FailingProvider:
        name = "Live search unavailable"

        async def search(self, query):
            raise FlightDataUnavailableError("quota exhausted")

    monkeypatch.setattr(journeys.orchestrator.alternative_agent, "provider", FailingProvider())
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post('/api/journeys/analyze', json=payload([('UL001', 'CMB', 'KUL'), ('XX123', 'KUL', 'NRT')]))
    assert response.status_code == 200
    result = response.json()
    assert result["alternatives"] == [] and result["alternative_search"]["status"] == "unavailable"
    assert result["risk"]["score"] == 73
    assert "No feasible alternative was verified" in result["recommendation"]


@pytest.mark.asyncio
async def test_cancelled_direct_flight_triggers_route_specific_search():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post('/api/journeys/analyze', json=payload([('UL504', 'CMB', 'LHR')]))
    assert response.status_code == 200
    result = response.json()
    assert result["alternative_search"]["origin"] == "CMB"
    assert result["alternative_search"]["destination"] == "LHR"
    assert result["alternatives"]
    for option in result["alternatives"]:
        assert option["legs"][-1]["destination"] == "LHR"
        assert option["availability_status"] == option["price"] == "UNKNOWN"


@pytest.mark.asyncio
async def test_safe_connection_does_not_search_alternatives():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post('/api/journeys/analyze', json=payload([('UL306', 'CMB', 'SIN'), ('SQ638', 'SIN', 'NRT')]))
    assert response.status_code == 200
    result = response.json()
    assert result["alternatives"] == [] and result["alternative_search"]["status"] == "not_needed"
