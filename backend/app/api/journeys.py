from fastapi import APIRouter, HTTPException
from app.schemas.journey import JourneyAnalyzeRequest, JourneyAnalysisResponse, RiskSummary, ConnectionSummary
from app.orchestrator.state import JourneyState
from app.orchestrator.graph import SupervisorOrchestrator
from datetime import datetime

router = APIRouter(prefix="/api/journeys", tags=["Journeys"])

orchestrator = SupervisorOrchestrator()

_CONNECTION_ISSUES = {
    "MISSED": "Your connection at {airport} will be missed.",
    "LIKELY_MISSED": "Your connection at {airport} is likely to be missed.",
    "HIGH_RISK": "Your connection at {airport} is very tight.",
}
_CONNECTION_ORDER = ["MISSED", "LIKELY_MISSED", "HIGH_RISK"]


def _primary_issue(flights: list, connections: list, risk_level: str) -> str:
    """One-line headline for the result, worst problem first, consistent with the risk level."""
    def name(f: dict) -> str:
        return f"Flight {f['flight_number']}" if f.get("flight_number") else "A flight"

    for status, text in (("CANCELLED", "is cancelled"), ("DIVERTED", "has been diverted")):
        hit = next((f for f in flights if f.get("status") == status), None)
        if hit:
            return f"{name(hit)} {text}."
    for status in _CONNECTION_ORDER:
        conn = next((c for c in connections if c.get("status") == status), None)
        if conn:
            return _CONNECTION_ISSUES[status].format(airport=conn.get("airport") or "the transfer airport")
    delayed = [f for f in flights if (f.get("delay_minutes") or 0) > 0]
    if delayed:
        worst = max(delayed, key=lambda f: f["delay_minutes"])
        return f"{name(worst)} is delayed {worst['delay_minutes']} min."
    if risk_level == "UNKNOWN":
        return "Not enough data to assess this journey."
    if risk_level in ("HIGH", "VERY_HIGH"):
        return "Disruption risk is high for this journey."
    if risk_level == "MODERATE":
        return "Some disruption risk. Keep an eye on this journey."
    return "No major disruption found."

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

    # The Risk Agent stores a RiskSummary; without one the risk is unknown, never a default low score.
    if final_state.risk_analysis:
        risk_summary = RiskSummary.model_validate(final_state.risk_analysis)
    else:
        risk_summary = RiskSummary(
            score=None,
            level="UNKNOWN",
            status="insufficient_data",
            confidence=0.0,
            confidence_label="unknown",
            explanation=["Overall risk: unknown. The risk assessment did not run."],
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

    primary_issue = _primary_issue(final_state.flight_results, final_state.connection_results, risk_summary.level)

    return JourneyAnalysisResponse(
        journey_id=final_state.journey_id,
        trace_id=final_state.trace_id,
        journey_status="INSUFFICIENT_DATA" if risk_summary.level == "UNKNOWN" else risk_summary.level + "_RISK",
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
