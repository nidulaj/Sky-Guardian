from app.agents.base import BaseAgent
from app.orchestrator.state import JourneyState
from app.schemas.journey import AgentResultSchema
from datetime import datetime

class WeatherAgent(BaseAgent):
    """
    Aviation Weather Context Agent.
    Retrieves weather conditions at origin, transfer, and destination airports.
    """
    def __init__(self):
        super().__init__(name="weather_agent")

    async def execute(self, state: JourneyState) -> AgentResultSchema:
        weather_results = []
        airports = set()
        
        for leg in state.journey_legs:
            if leg.get("origin"):
                airports.add(leg.get("origin"))
            if leg.get("destination"):
                airports.add(leg.get("destination"))
                
        for apt in sorted(list(airports)):
            # Mock weather response for demonstration
            if apt == "KUL":
                weather_results.append({
                    "airport": "KUL",
                    "condition": "Scattered Thunderstorms",
                    "severity": "MODERATE",
                    "weather_risk_score": 60,
                    "warnings": ["Current weather conditions at KUL may increase disruption risk."],
                    "source": "MockWeatherProvider",
                    "timestamp": datetime.utcnow().isoformat()
                })
            elif apt == "NRT" or apt == "HND":
                weather_results.append({
                    "airport": apt,
                    "condition": "Clear / Light Wind",
                    "severity": "LOW",
                    "weather_risk_score": 15,
                    "warnings": [],
                    "source": "MockWeatherProvider",
                    "timestamp": datetime.utcnow().isoformat()
                })
            else:
                weather_results.append({
                    "airport": apt,
                    "condition": "Partly Cloudy",
                    "severity": "LOW",
                    "weather_risk_score": 20,
                    "warnings": [],
                    "source": "MockWeatherProvider",
                    "timestamp": datetime.utcnow().isoformat()
                })
                
        state.weather_results = weather_results
        
        return self.create_result(
            status="success",
            data={"weather_results": weather_results},
            trace_id=state.trace_id,
            confidence="high"
        )
