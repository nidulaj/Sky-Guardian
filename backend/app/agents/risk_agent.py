from app.agents.base import BaseAgent
from app.orchestrator.state import JourneyState
from app.schemas.journey import AgentResultSchema

class RiskAgent(BaseAgent):
    """
    Journey Disruption Risk Agent.
    Computes deterministic risk score:
    journey_risk = (flight_score * 0.40) + (connection_score * 0.35) + (weather_score * 0.25)
    """
    def __init__(self, flight_weight: float = 0.40, connection_weight: float = 0.35, weather_weight: float = 0.25):
        super().__init__(name="risk_agent")
        self.w_flight = flight_weight
        self.w_conn = connection_weight
        self.w_weather = weather_weight

    async def execute(self, state: JourneyState) -> AgentResultSchema:
        # Calculate Flight Score (0 - 100)
        flight_scores = []
        for f in state.flight_results:
            status = f.get("status", "UNKNOWN")
            delay = f.get("delay_minutes", 0)
            if status == "CANCELLED":
                flight_scores.append(100)
            elif status == "DIVERTED":
                flight_scores.append(90)
            elif delay >= 120:
                flight_scores.append(90)
            elif delay >= 60:
                flight_scores.append(80)
            elif delay >= 30:
                flight_scores.append(50)
            elif delay > 0:
                flight_scores.append(30)
            else:
                flight_scores.append(10)
        
        flight_score = max(flight_scores) if flight_scores else 10.0

        # Calculate Connection Score (0 - 100)
        conn_scores = []
        if not state.connection_results:
            connection_score = 0.0 # Direct flight
        else:
            for c in state.connection_results:
                status = c.get("status", "UNKNOWN")
                if status == "MISSED":
                    conn_scores.append(100)
                elif status == "LIKELY_MISSED":
                    conn_scores.append(90)
                elif status == "HIGH_RISK":
                    conn_scores.append(75)
                elif status == "MODERATE_RISK":
                    conn_scores.append(45)
                elif status == "SAFE":
                    conn_scores.append(10)
                else:
                    conn_scores.append(50)
            connection_score = max(conn_scores) if conn_scores else 10.0

        # Calculate Weather Score (0 - 100)
        weather_scores = [w.get("weather_risk_score", 15) for w in state.weather_results]
        weather_score = max(weather_scores) if weather_scores else 15.0

        # Weighted Total
        total_risk = (flight_score * self.w_flight) + (connection_score * self.w_conn) + (weather_score * self.w_weather)
        risk_int = int(round(total_risk))

        if risk_int >= 80:
            level = "VERY_HIGH"
        elif risk_int >= 60:
            level = "HIGH"
        elif risk_int >= 30:
            level = "MODERATE"
        else:
            level = "LOW"

        risk_analysis = {
            "score": risk_int,
            "level": level,
            "is_probability": False,
            "flight_score": flight_score,
            "connection_score": connection_score,
            "weather_score": weather_score,
            "weights": {
                "flight": self.w_flight,
                "connection": self.w_conn,
                "weather": self.w_weather
            }
        }

        state.risk_analysis = risk_analysis

        return self.create_result(
            status="success",
            data={"risk_analysis": risk_analysis},
            trace_id=state.trace_id,
            confidence="high"
        )
