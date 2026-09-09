from app.agents.base import BaseAgent
from app.orchestrator.state import JourneyState
from app.schemas.journey import AgentResultSchema
from datetime import datetime

class ConnectionAgent(BaseAgent):
    """
    Connection Feasibility Agent.
    Evaluates connection feasibility using deterministic arithmetic:
    available_connection_time = next_flight_departure - previous_flight_expected_arrival
    """
    def __init__(self, default_mct_minutes: int = 60):
        super().__init__(name="connection_agent")
        self.default_mct_minutes = default_mct_minutes

    async def execute(self, state: JourneyState) -> AgentResultSchema:
        connection_results = []
        warnings = []
        
        flights = state.flight_results
        if len(flights) < 2:
            # Single-leg journey, no connection calculation needed
            state.connection_results = []
            return self.create_result(
                status="success",
                data={"connection_results": [], "note": "Direct flight, no transfer connections required."},
                trace_id=state.trace_id,
                confidence="high"
            )

        for i in range(len(flights) - 1):
            leg_a = flights[i]
            leg_b = flights[i+1]
            
            arr_str = leg_a.get("estimated_arrival") or leg_a.get("scheduled_arrival")
            dep_str = leg_b.get("estimated_departure") or leg_b.get("scheduled_departure")
            
            airport = leg_a.get("destination")
            mct = self.default_mct_minutes
            
            if not arr_str or not dep_str:
                connection_results.append({
                    "connection_index": i,
                    "airport": airport,
                    "available_connection_minutes": 0,
                    "minimum_required_minutes": mct,
                    "buffer_minutes": -mct,
                    "status": "UNKNOWN",
                    "reason_codes": ["MISSING_TIMING_DATA"]
                })
                continue
            
            try:
                arr_dt = datetime.fromisoformat(arr_str.replace("Z", "+00:00"))
                dep_dt = datetime.fromisoformat(dep_str.replace("Z", "+00:00"))
                
                avail_mins = int((dep_dt - arr_dt).total_seconds() / 60)
                buffer_mins = avail_mins - mct
                
                reasons = []
                if leg_a.get("delay_minutes", 0) > 0:
                    reasons.append("INBOUND_FLIGHT_DELAYED")
                
                if avail_mins < 0:
                    status = "MISSED"
                    reasons.append("NEGATIVE_CONNECTION_WINDOW")
                elif avail_mins < mct:
                    status = "LIKELY_MISSED"
                    reasons.append("BELOW_MINIMUM_CONNECTION_TIME")
                elif avail_mins < mct + 20:
                    status = "HIGH_RISK"
                    reasons.append("TIGHT_TRANSFER_BUFFER")
                elif avail_mins < mct + 45:
                    status = "MODERATE_RISK"
                    reasons.append("MODERATE_BUFFER")
                else:
                    status = "SAFE"
                    reasons.append("SUFFICIENT_TRANSFER_TIME")
                
                connection_results.append({
                    "connection_index": i,
                    "airport": airport,
                    "available_connection_minutes": avail_mins,
                    "minimum_required_minutes": mct,
                    "buffer_minutes": buffer_mins,
                    "status": status,
                    "reason_codes": reasons
                })
            except Exception as e:
                warnings.append(f"Failed to calculate connection timing at {airport}: {str(e)}")
                connection_results.append({
                    "connection_index": i,
                    "airport": airport,
                    "available_connection_minutes": 0,
                    "minimum_required_minutes": mct,
                    "buffer_minutes": 0,
                    "status": "UNKNOWN",
                    "reason_codes": ["CALCULATION_ERROR"]
                })
        
        state.connection_results = connection_results
        
        return self.create_result(
            status="success",
            data={"connection_results": connection_results},
            trace_id=state.trace_id,
            confidence="high",
            warnings=warnings
        )
