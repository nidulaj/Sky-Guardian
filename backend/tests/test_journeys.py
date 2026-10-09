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
        # Flight 65 (90 min delay) x 0.40 + connection 90 (LIKELY_MISSED) x 0.35 + weather 60 (KUL, mock) x 0.25
        # = 26 + 31.5 + 15 = 72.5 -> 73 (round half up)
        assert data["risk"]["score"] == 73
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
        # The carrier to contact comes from the delayed inbound flight's data, not a hard-coded fallback.
        delayed = next(f for f in data["flight_statuses"] if f["flight_number"] == "UL001")
        plan = data["recovery_plan"]
        assert plan["contact"] == delayed["airline"] == "SriLankan Airlines"
        assert plan["headline"] == "Your connection at KUL is likely missed"
        assert set(plan["policy_citations"]) == {f"P{i}" for i in range(1, len(data["policy_evidence"]) + 1)}
        assert data["recommendation_mode"] == "template"
        assert plan["headline"] in data["recommendation"]
