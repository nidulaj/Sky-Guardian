from fastapi import APIRouter, HTTPException
from app.schemas.journey import JourneyAnalyzeRequest, JourneyAnalysisResponse, RiskSummary, ConnectionSummary
from app.orchestrator.state import JourneyState
from app.orchestrator.graph import SupervisorOrchestrator
from datetime import datetime

router = APIRouter(prefix="/api/journeys", tags=["Journeys"])

orchestrator = SupervisorOrchestrator()

@router.post("/analyze", response_model=JourneyAnalysisResponse)
async def analyze_journey(request: JourneyAnalyzeRequest):
    # Initialize Journey State from request legs
    legs_data = [leg.dict() for leg in request.legs]
    origin = legs_data[0]["origin"] if legs_data else ""
    destination = legs_data[-1]["destination"] if legs_data else ""

    state = JourneyState(
        preferred_language=request.language,
        origin=origin,
        destination=destination,
        journey_legs=legs_data
    )

    # Execute orchestrator agent workflow
    final_state = await orchestrator.run_workflow(state)

    # Format risk summary
    risk_data = final_state.risk_analysis or {
        "score": 0,
        "level": "LOW",
        "is_probability": False,
        "flight_score": 0,
        "connection_score": 0,
        "weather_score": None
    }

    risk_summary = RiskSummary(
        score=risk_data["score"],
        level=risk_data["level"],
        is_probability=False,
        flight_score=risk_data["flight_score"],
        connection_score=risk_data["connection_score"],
        weather_score=risk_data.get("weather_score"),
        status=risk_data.get("status", "complete"),
        confidence=risk_data.get("confidence"),
        confidence_label=risk_data.get("confidence_label"),
        components=risk_data.get("components", {}),
        weights=risk_data.get("weights", {}),
        effective_weights=risk_data.get("effective_weights", {}),
        missing_data=risk_data.get("missing_data", []),
        uncertainty=risk_data.get("uncertainty", [])
    )

    # Format connection summary if present
    connection_summary = None
    if final_state.connection_results:
        c_res = final_state.connection_results[0]
        connection_summary = ConnectionSummary(
            available_minutes=c_res.get("available_connection_minutes", 0),
            minimum_required_minutes=c_res.get("minimum_required_minutes", 60),
            buffer_minutes=c_res.get("buffer_minutes", 0),
            status=c_res.get("status", "UNKNOWN"),
            reason_codes=c_res.get("reason_codes", [])
        )

    primary_issue = "Connection time may be insufficient." if connection_summary and connection_summary.status in ["HIGH_RISK", "LIKELY_MISSED", "MISSED"] else "No critical disruption identified."

    return JourneyAnalysisResponse(
        journey_id=final_state.journey_id,
        trace_id=final_state.trace_id,
        journey_status=risk_summary.level + "_RISK",
        risk=risk_summary,
        primary_issue=primary_issue,
        connection=connection_summary,
        flight_statuses=final_state.flight_results,
        weather_conditions=final_state.weather_results,
        policy_evidence=final_state.policy_evidence,
        alternatives=final_state.alternative_options,
        recommendation=final_state.recommendation_text,
        sources=final_state.sources,
        warnings=final_state.warnings,
        is_demo_data=final_state.is_demo_data,
        last_updated=final_state.updated_at
    )

@router.get("/{journey_id}")
async def get_journey(journey_id: str):
    # Endpoint stub for journey retrieval by ID
    return {
        "journey_id": journey_id,
        "status": "COMPLETED",
        "message": "Journey details fetched successfully."
    }
