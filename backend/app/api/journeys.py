import uuid
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends

from app.schemas.journey import JourneyAnalyzeRequest, JourneyAnalysisResponse, RiskSummary, ConnectionSummary
from app.orchestrator.state import JourneyState
from app.orchestrator.graph import SupervisorOrchestrator
from app.api.auth import get_current_user, get_optional_user, get_supabase

logger = logging.getLogger(__name__)

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
# In-memory history fallback (user_id -> list of records) in case Supabase table is not yet migrated
_IN_MEMORY_HISTORY: Dict[str, List[Dict[str, Any]]] = {}

def _save_to_history(record: Dict[str, Any]):
    user_id = record.get("user_id")
    if not user_id:
        return

    # 1. Update in-memory cache for immediate responsiveness
    if user_id not in _IN_MEMORY_HISTORY:
        _IN_MEMORY_HISTORY[user_id] = []
    _IN_MEMORY_HISTORY[user_id].insert(0, record)
    _IN_MEMORY_HISTORY[user_id] = _IN_MEMORY_HISTORY[user_id][:50]

    # 2. Persist to Supabase
    try:
        sb = get_supabase()
        sb.table("journey_history").insert(record).execute()
        logger.info(f"Journey check saved to Supabase for passenger user_id={user_id}")
    except Exception as e:
        logger.warning(
            f"Could not persist journey history to Supabase table 'journey_history' ({e}). "
            "Data kept safely in session memory. (Ensure migration SQL has been executed in Supabase)"
        )

@router.post("/analyze", response_model=JourneyAnalysisResponse)
async def analyze_journey(
    request: JourneyAnalyzeRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_user),
):
    # Initialize Journey State from request legs
    legs_data = [leg.dict() for leg in request.legs]
    origin = legs_data[0]["origin"] if legs_data else ""
    destination = legs_data[-1]["destination"] if legs_data else ""

    state = JourneyState(
        preferred_language=request.language,
        origin=origin,
        destination=destination,
        journey_legs=legs_data,
        alternatives_requested=request.request_alternatives,
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

    response = JourneyAnalysisResponse(
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
        alternative_search=final_state.alternative_search,
        recommendation=final_state.recommendation_text,
        recovery_plan=final_state.recovery_plan,
        recommendation_mode=final_state.recommendation_mode,
        sources=final_state.sources,
        warnings=final_state.warnings,
        is_demo_data=final_state.is_demo_data,
        last_updated=final_state.updated_at,
        workflow_status=final_state.workflow_status,
        workflow_trace=final_state.agent_runs,
        recovery_triggered=final_state.recovery_triggered,
        recovery_reasons=final_state.recovery_reasons,
    )

    # If the request is from an authenticated passenger, record in journey history
    if current_user and current_user.get("user_id"):
        user_id = current_user["user_id"]

        # Determine via airport
        via_airport = None
        if len(legs_data) == 2:
            via_airport = legs_data[0].get("destination") or legs_data[1].get("origin")
        elif len(legs_data) > 2:
            via_airport = ", ".join([l.get("destination", "") for l in legs_data[:-1] if l.get("destination")])

        # Formulate human-readable description
        if via_airport:
            places = f"{origin} to {destination} via {via_airport}"
        else:
            places = f"{origin} to {destination}, direct"

        flights_str = " · ".join([l.get("flight_number", "") for l in legs_data if l.get("flight_number")])
        travel_date = legs_data[0].get("travel_date", "") if legs_data else ""

        # Determine status code and status label
        if connection_summary and connection_summary.status in ["LIKELY_MISSED", "MISSED", "HIGH_RISK", "MODERATE_RISK"]:
            status_code = connection_summary.status
        elif risk_summary.level in ["VERY_HIGH", "HIGH"]:
            status_code = "HIGH_RISK"
        elif risk_summary.level == "MODERATE":
            status_code = "MODERATE_RISK"
        else:
            status_code = "ON_TIME"

        status_label_map = {
            "LIKELY_MISSED": "Connection likely missed",
            "MISSED": "Connection missed",
            "HIGH_RISK": "High risk",
            "MODERATE_RISK": "Moderate risk",
            "ON_TIME": "Connection OK",
            "SAFE": "All clear",
            "CANCELLED": "Flight cancelled",
            "DELAYED": "Flight delayed",
            "UNKNOWN": "Status unknown",
        }
        status_label = status_label_map.get(status_code, status_code.replace("_", " ").title())

        # Determine outcome: 'attention' vs 'clear'
        outcome = (
            "attention"
            if status_code in ["LIKELY_MISSED", "MISSED", "HIGH_RISK", "MODERATE_RISK", "CANCELLED"]
            or risk_summary.level in ["HIGH", "VERY_HIGH", "MODERATE"]
            else "clear"
        )

        # Determine finding text
        if primary_issue and primary_issue != "No critical disruption identified.":
            finding = primary_issue
        elif risk_summary.explanation and len(risk_summary.explanation) > 0:
            finding = risk_summary.explanation[0]
        else:
            finding = "All flights assessed with no critical disruption."

        next_step = final_state.recommendation_text or "No action needed. Check again on the day of travel."

        history_record = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "journey_id": final_state.journey_id,
            "trace_id": final_state.trace_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "travel_date": travel_date,
            "from_airport": origin,
            "via_airport": via_airport,
            "to_airport": destination,
            "places": places,
            "flights": flights_str,
            "status": status_code,
            "status_label": status_label,
            "outcome": outcome,
            "finding": finding,
            "next_step": next_step,
            "risk_score": risk_summary.score,
            "risk_level": risk_summary.level,
            "legs": legs_data,
            "analysis_data": {
                "journey_status": response.journey_status,
                "primary_issue": response.primary_issue,
                "recommendation": response.recommendation,
                "risk": risk_summary.dict(),
            }
        }

        _save_to_history(history_record)

    return response

@router.get("/history", response_model=List[Dict[str, Any]])
async def get_journey_history(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Fetch history of journey checks performed by the authenticated passenger."""
    user_id = current_user["user_id"]

    # 1. Try Supabase
    try:
        sb = get_supabase()
        res = (
            sb.table("journey_history")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )
        if res.data is not None and len(res.data) > 0:
            return res.data
    except Exception as e:
        logger.warning(f"Failed to query Supabase journey_history ({e}), falling back to session cache.")

    # 2. Fallback to in-memory cache
    return _IN_MEMORY_HISTORY.get(user_id, [])

@router.delete("/history/{item_id}")
async def delete_journey_history_item(item_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    """Delete a single history record for the authenticated passenger."""
    user_id = current_user["user_id"]

    # Delete from Supabase
    try:
        sb = get_supabase()
        sb.table("journey_history").delete().eq("id", item_id).eq("user_id", user_id).execute()
    except Exception as e:
        logger.warning(f"Failed to delete item from Supabase journey_history ({e})")

    # Delete from in-memory cache
    if user_id in _IN_MEMORY_HISTORY:
        _IN_MEMORY_HISTORY[user_id] = [h for h in _IN_MEMORY_HISTORY[user_id] if h.get("id") != item_id]

    return {"status": "success", "message": "History item deleted successfully."}

@router.delete("/history")
async def clear_journey_history(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Clear all journey checks for the authenticated passenger."""
    user_id = current_user["user_id"]

    # Clear from Supabase
    try:
        sb = get_supabase()
        sb.table("journey_history").delete().eq("user_id", user_id).execute()
    except Exception as e:
        logger.warning(f"Failed to clear history from Supabase ({e})")

    # Clear from in-memory cache
    if user_id in _IN_MEMORY_HISTORY:
        _IN_MEMORY_HISTORY[user_id] = []

    return {"status": "success", "message": "All journey history cleared successfully."}

@router.get("/{journey_id}")
async def get_journey(journey_id: str):
    # Endpoint stub for journey retrieval by ID
    return {
        "journey_id": journey_id,
        "status": "COMPLETED",
        "message": "Journey details fetched successfully."
    }

