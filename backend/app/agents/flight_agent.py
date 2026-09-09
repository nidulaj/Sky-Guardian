from app.agents.base import BaseAgent
from app.orchestrator.state import JourneyState
from app.schemas.journey import AgentResultSchema
from app.providers.flight.mock import MockFlightProvider

class FlightAgent(BaseAgent):
    def __init__(self, provider=None):
        super().__init__(name="flight_agent")
        self.provider = provider or MockFlightProvider()

    async def execute(self, state: JourneyState) -> AgentResultSchema:
        flight_results = []
        warnings = []
        
        for leg in state.journey_legs:
            flight_num = leg.get("flight_number")
            date = leg.get("travel_date")
            origin = leg.get("origin")
            dest = leg.get("destination")
            
            try:
                result = await self.provider.get_flight_status(flight_num, date, origin, dest)
                flight_results.append(result)
            except Exception as e:
                warnings.append(f"Could not retrieve status for {flight_num}: {str(e)}")
                flight_results.append({
                    "flight_number": flight_num,
                    "origin": origin,
                    "destination": dest,
                    "status": "UNKNOWN",
                    "delay_minutes": 0,
                    "source": "Error"
                })
        
        state.flight_results = flight_results
        
        return self.create_result(
            status="success" if flight_results else "unavailable",
            data={"flight_results": flight_results},
            trace_id=state.trace_id,
            confidence="high",
            warnings=warnings
        )
