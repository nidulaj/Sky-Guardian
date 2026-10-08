from app.orchestrator.state import JourneyState
from app.agents.flight_agent import FlightAgent
from app.agents.connection_agent import ConnectionAgent
from app.agents.weather_agent import WeatherAgent
from app.agents.risk_agent import RiskAgent
from app.agents.policy_agent import PolicyAgent
from app.agents.alternative_agent import AlternativeAgent
from app.agents.recovery_agent import RecoveryAgent
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)


class SupervisorOrchestrator:
    """
    Supervisor Orchestrator enforcing controlled sequential execution flow:
    1. Flight Agent
    2. Connection Agent
    3. Weather Agent
    4. Risk Agent
    5. Conditional Routing (if risk >= 60 or connection at risk -> Policy & Alternative Agents)
    6. Recovery Agent
    """

    def __init__(self):
        self.flight_agent = FlightAgent()
        self.connection_agent = ConnectionAgent()
        self.weather_agent = WeatherAgent()
        self.risk_agent = RiskAgent()
        self.policy_agent = PolicyAgent()
        self.alternative_agent = AlternativeAgent()
        self.recovery_agent = RecoveryAgent()

    async def run_workflow(self, state: JourneyState) -> JourneyState:
        logger.info(f"Starting journey analysis workflow for journey_id: {state.journey_id}, trace_id: {state.trace_id}")
        state.workflow_status = "IN_PROGRESS"

        # Step 1: Flight Agent
        await self.flight_agent.execute(state)

        # Step 2: Connection Agent
        await self.connection_agent.execute(state)

        # Step 3: Weather Agent
        await self.weather_agent.execute(state)

        # Step 4: Risk Agent
        await self.risk_agent.execute(state)

        # Step 5: Conditional Routing
        risk_score = state.risk_analysis.get("score", 0) if state.risk_analysis else 0
        conn_status = state.connection_results[0].get("status") if state.connection_results else "SAFE"

        needs_recovery = risk_score >= 60 or conn_status in ["HIGH_RISK", "LIKELY_MISSED", "MISSED"]

        if needs_recovery:
            # Step 5a: Policy Agent
            await self.policy_agent.execute(state)
            # Step 5b: Alternative Agent
            await self.alternative_agent.execute(state)

        # Step 6: Recovery Agent
        await self.recovery_agent.execute(state)

        state.workflow_status = "COMPLETED"
        state.updated_at = datetime.now(timezone.utc).isoformat()

        # Base telemetry sources from workflow providers
        telemetry_sources = [
            {"name": "MockFlightProvider", "type": "Aviation Data", "verified": True},
            {"name": self.weather_agent.provider.name, "type": "Weather Forecast", "verified": True},
        ]

        # Merge telemetry with any evidence-derived policy sources
        combined_sources = list(telemetry_sources)
        seen_names = {s["name"] for s in combined_sources}

        for s in state.sources:
            if s.get("name") and s["name"] not in seen_names:
                combined_sources.append(s)
                seen_names.add(s["name"])

        for pe in state.policy_evidence:
            title = pe.get("title")
            if title and title not in seen_names:
                combined_sources.append({"name": title, "type": "Policy Document", "verified": True})
                seen_names.add(title)

        state.sources = combined_sources

        state.warnings.append(
            "SkyGuardian AI provides travel disruption guidance based on available schedule estimates. Confirm critical travel updates with your carrier."
        )

        return state
