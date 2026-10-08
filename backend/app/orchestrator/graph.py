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

        # Step 4: Risk Agent (runs after Flight, Connection and Weather results are in state)
        await self.risk_agent.execute(state)

        # Step 5: Conditional Routing
        # score is None when the Risk Agent had no usable data; that alone does not trigger recovery.
        risk_score = state.risk_analysis.get("score") if state.risk_analysis else None
        threshold = self.risk_agent.config.triggers.recovery_trigger_threshold
        needs_recovery = (
            (risk_score is not None and risk_score >= threshold) or
            any(c.get("status") in ["HIGH_RISK", "LIKELY_MISSED", "MISSED"] for c in state.connection_results)
        )

        if needs_recovery:
            # Step 5a: Policy Agent
            await self.policy_agent.execute(state)
            # Step 5b: Alternative Agent
            await self.alternative_agent.execute(state)

        # Step 6: Recovery Agent
        await self.recovery_agent.execute(state)

        state.workflow_status = "COMPLETED"
        state.updated_at = datetime.now(timezone.utc).isoformat()

        state.is_demo_data = any(f.get("data_mode") == "demo" for f in state.flight_results) or any(
            w.get("is_mock") and w.get("status") == "available" for w in state.weather_results
        )

        telemetry_sources = [
            {"name": f["source"], "type": "Aviation Data",
             "verified": f.get("data_mode") in ("live", "timetable") and f.get("status") != "UNKNOWN"}
            for f in state.flight_results if f.get("source")
        ] + [
            {"name": w["source"], "type": "Weather Forecast",
             "verified": not w.get("is_mock", False) and w.get("status") == "available"}
            for w in state.weather_results if w.get("source")
        ]

        # Merge telemetry with any evidence-derived policy sources
        combined_sources = []
        seen_names = set()

        for s in [*telemetry_sources, *state.sources]:
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
