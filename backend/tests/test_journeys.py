import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_cmb_kul_tokyo_demo_journey():
    payload = {
        "language": "en",
        "legs": [
            {
                "flight_number": "UL001",
                "travel_date": "2026-09-15",
                "origin": "CMB",
                "destination": "KUL"
            },
            {
                "flight_number": "XX123",
                "travel_date": "2026-09-15",
                "origin": "KUL",
                "destination": "NRT"
            }
        ]
    }
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/journeys/analyze", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        # Verify Journey Status & Risk
        assert data["journey_status"] == "HIGH_RISK"
        assert data["risk"]["score"] == 79
        assert data["risk"]["level"] == "HIGH"
        assert data["risk"]["is_probability"] is False
        
        # Verify Connection Calculation
        assert data["connection"] is not None
        assert data["connection"]["available_minutes"] == 30
        assert data["connection"]["minimum_required_minutes"] == 60
        assert data["connection"]["status"] == "LIKELY_MISSED"
        
        # Verify Alternatives & Recommendations
        assert len(data["alternatives"]) > 0
        assert len(data["policy_evidence"]) > 0
        assert "SriLankan Airlines" in data["recommendation"]
