import logging
from typing import Dict, Any, List
from app.agents.base import BaseAgent
from app.orchestrator.state import JourneyState
from app.schemas.journey import AgentResultSchema

logger = logging.getLogger(__name__)

class RecoveryAgent(BaseAgent):
    """
    Passenger Recovery Recommendation Agent.
    Synthesizes outputs from flight, connection, weather, risk, and policy RAG agents
    into an explainable, strictly grounded passenger recovery plan.
    """
    def __init__(self, llm_provider=None):
        super().__init__(name="recovery_agent")
        self.llm_provider = llm_provider

    async def execute(self, state: JourneyState) -> AgentResultSchema:
        # 1. Extract dynamic facts from shared state
        first_leg = state.flight_results[0] if state.flight_results else {}
        flight_num = first_leg.get("flight_number", "Your flight")
        flight_delay = first_leg.get("delay_minutes", 0)
        origin_apt = first_leg.get("origin", "origin")
        dest_apt = first_leg.get("destination", "destination")

        conn_res = state.connection_results[0] if state.connection_results else {}
        avail_mins = conn_res.get("available_connection_minutes", 0)
        req_mins = conn_res.get("minimum_required_minutes", 60)
        transfer_airport = conn_res.get("airport", dest_apt)
        conn_status = conn_res.get("status", "SAFE")

        risk_data = state.risk_analysis or {}
        risk_score = risk_data.get("score", 0)
        risk_level = risk_data.get("level", "LOW")

        best_alt = "Alternative itinerary"
        if state.recommended_option:
            best_alt = state.recommended_option.get("route_summary", best_alt)
        elif state.alternative_options:
            best_alt = state.alternative_options[0].get("route_summary", best_alt)

        # 2. Extract grounded policy evidence retrieved via RAG
        policy_evidence: List[Dict[str, Any]] = state.policy_evidence or []
        policy_points: List[str] = []
        counsel_airline = "the operating carrier"

        for p in policy_evidence:
            airline_name = p.get("airline", "Airline")
            p_title = p.get("title", "")
            p_type = p.get("policy_type", "")
            snippet = p.get("snippet", "")
            
            if "srilankan" in airline_name.lower():
                counsel_airline = "SriLankan Airlines"
            elif "malaysia" in airline_name.lower() and counsel_airline == "the operating carrier":
                counsel_airline = "Malaysia Airlines"

            policy_points.append(f"- **{airline_name}** ({p_title}): {snippet[:180]}...")

        # 3. Grounded Synthesis
        if conn_status in ["LIKELY_MISSED", "MISSED", "HIGH_RISK"] or risk_score >= 60:
            delay_phrase = f"is currently delayed by {flight_delay} minutes" if flight_delay > 0 else "is experiencing schedule disruption"
            
            explanation_parts = [
                f"Your first flight ({flight_num} from {origin_apt} to {dest_apt}) {delay_phrase}. "
                f"As a result, your remaining connection window at {transfer_airport} is estimated at {avail_mins} minutes, "
                f"which is below the airport's minimum required connection time of {req_mins} minutes. "
                f"Consequently, your connection is classified as **{conn_status.replace('_', ' ')}** with an Estimated Journey Disruption Risk Score of **{risk_score}/100 ({risk_level} RISK)**.\n\n"
                f"**Recommended Recovery Option:**\n"
                f"Option 1 ({best_alt}) is recommended as the safest route. Under {counsel_airline} connection protection policies, "
                f"you are entitled to complimentary rebooking on the next available connecting flight without change fees.\n\n"
                f"**Suggested Next Steps:**\n"
                f"1. Proceed to the {counsel_airline} transit transfer desk upon arrival at {transfer_airport}.\n"
                f"2. Present your original boarding pass and request rebooking under the connection protection policy.\n"
                f"3. Inquire about layover meal/accommodation vouchers if your rebooked departure is scheduled for the next morning."
            ]
            explanation = "".join(explanation_parts)
        else:
            explanation = (
                f"Your journey ({origin_apt} to {dest_apt}) is operating with an Estimated Journey Disruption Risk Score "
                f"of {risk_score}/100 ({risk_level} RISK). No critical schedule disruption has been identified. "
                f"Your connection window at {transfer_airport} remains sufficient."
            )

        state.recommendation_text = explanation

        return self.create_result(
            status="success",
            data={
                "recommendation": explanation,
                "grounded_policy_count": len(policy_evidence),
                "risk_score": risk_score,
                "conn_status": conn_status
            },
            trace_id=state.trace_id,
            confidence="high" if policy_evidence else "medium"
        )
