from app.orchestrator.state import JourneyState
from app.orchestrator.routing import should_trigger_recovery
from app.agents.flight_agent import FlightAgent
from app.agents.connection_agent import ConnectionAgent
from app.agents.weather_agent import WeatherAgent
from app.agents.risk_agent import RiskAgent
from app.agents.policy_agent import PolicyAgent
from app.agents.alternative_agent import AlternativeAgent
from app.agents.recovery_agent import RecoveryAgent
from app.config import settings
from app.llm import get_llm_provider
from app.schemas.journey import AgentRun
from langgraph.graph import StateGraph, START, END
from typing import TypedDict
from datetime import datetime, timezone
import asyncio
import logging
import time

logger = logging.getLogger(__name__)

# Passenger-safe warning added when an agent step fails or times out. Provider errors,
# stack traces and keys are only logged, never returned.
FAILURE_WARNINGS = {
    "flight_agent": "Flight status could not be retrieved; the assessment uses reduced information.",
    "connection_agent": "Connection timing could not be calculated.",
    "weather_agent": "Weather data unavailable; risk assessed with reduced confidence.",
    "risk_agent": "The disruption risk could not be assessed.",
    "policy_agent": "Policy information could not be verified.",
    "alternative_agent": "Alternative flight search could not be completed. Ask the airline for current options.",
    "recovery_agent": "A recovery summary could not be generated.",
}

DISCLAIMER = (
    "SkyGuardian AI provides travel disruption guidance based on available schedule estimates. "
    "Confirm critical travel updates with your carrier."
)

# Graph node name -> SupervisorOrchestrator attribute holding that agent.
AGENT_NODES = {
    "flight": "flight_agent",
    "connection": "connection_agent",
    "weather": "weather_agent",
    "risk": "risk_agent",
    "policy": "policy_agent",
    "alternatives": "alternative_agent",
    "recovery": "recovery_agent",
}


class WorkflowState(TypedDict):
    # The agents update JourneyState in place, so the graph carries the same object
    # from node to node rather than merging per-field updates.
    journey: JourneyState


class SupervisorOrchestrator:
    """
    Supervisor Orchestrator, run as a LangGraph state graph:

        START -> flight -> connection -> weather -> risk -> recovery_gate
        recovery_gate -(recovery needed)-> policy -> alternatives -> recovery
        recovery_gate -(not needed)--------------------------------> recovery
        recovery -> finalize -> END

    Recovery is needed when a flight is cancelled, a connection is at risk, the risk score
    reaches the configured threshold or the passenger asked for alternatives
    (see routing.should_trigger_recovery). ORCHESTRATOR_ENGINE=sequential runs the same
    steps without LangGraph.

    Each agent runs in isolation: a failure or timeout is recorded in state.agent_runs with a
    passenger-safe warning, and the workflow continues with the data it has.
    """

    def __init__(self):
        self.flight_agent = FlightAgent()
        self.connection_agent = ConnectionAgent()
        self.weather_agent = WeatherAgent()
        self.risk_agent = RiskAgent()
        self.policy_agent = PolicyAgent()
        self.alternative_agent = AlternativeAgent()
        self.recovery_agent = RecoveryAgent(llm_provider=get_llm_provider(settings))
        self.graph = self._build_graph()

    def _build_graph(self):
        builder = StateGraph(WorkflowState)
        for node, agent_name in AGENT_NODES.items():
            builder.add_node(node, self._agent_node(agent_name))
        builder.add_node("recovery_gate", self._graph_step(self._route))
        builder.add_node("finalize", self._graph_step(self._finalize))

        builder.add_edge(START, "flight")
        builder.add_edge("flight", "connection")
        builder.add_edge("connection", "weather")
        builder.add_edge("weather", "risk")
        builder.add_edge("risk", "recovery_gate")
        builder.add_conditional_edges(
            "recovery_gate",
            lambda s: "policy" if s["journey"].recovery_triggered else "recovery",
            {"policy": "policy", "recovery": "recovery"},
        )
        builder.add_edge("policy", "alternatives")
        builder.add_edge("alternatives", "recovery")
        builder.add_edge("recovery", "finalize")
        builder.add_edge("finalize", END)
        return builder.compile()

    def _agent_node(self, agent_name: str):
        async def node(s: WorkflowState) -> WorkflowState:
            await self._run_agent(agent_name, s["journey"])
            return {"journey": s["journey"]}
        return node

    @staticmethod
    def _graph_step(step):
        async def node(s: WorkflowState) -> WorkflowState:
            step(s["journey"])
            return {"journey": s["journey"]}
        return node

    def mermaid(self) -> str:
        """Mermaid diagram of the supervisor graph, for the README and report."""
        return self.graph.get_graph().draw_mermaid()

    async def _run_agent(self, name: str, state: JourneyState) -> AgentRun:
        # Looked up at call time so tests (and callers) can replace self.<agent>.
        agent = getattr(self, name)
        started_at = datetime.now(timezone.utc).isoformat()
        start = time.perf_counter()
        try:
            result = await asyncio.wait_for(agent.execute(state), timeout=settings.AGENT_TIMEOUT_SECONDS)
            run = AgentRun(
                agent=name,
                status=getattr(result, "status", "success"),
                confidence=getattr(result, "confidence", None),
                warnings=list(getattr(result, "warnings", []) or []),
                started_at=started_at,
            )
        except Exception as exc:
            reason = "timed out" if isinstance(exc, asyncio.TimeoutError) else type(exc).__name__
            logger.exception("Agent %s failed (%s) for trace_id=%s", name, reason, state.trace_id)
            message = FAILURE_WARNINGS.get(name, "A workflow step could not be completed.")
            state.warnings.append(message)
            run = AgentRun(agent=name, status="error", warnings=[message], started_at=started_at,
                           error=f"{name.replace('_', ' ')} {reason}")
            if name == "alternative_agent":
                state.alternative_options, state.recommended_option = [], None
                state.alternative_search = {"status": "unavailable", "warnings": [message]}
        run.duration_ms = round((time.perf_counter() - start) * 1000)
        state.agent_runs.append(run)
        return run

    def _route(self, state: JourneyState) -> None:
        """Recovery gate: decide whether the Policy and Alternative agents run."""
        threshold = self.risk_agent.config.triggers.recovery_trigger_threshold
        state.recovery_triggered, state.recovery_reasons = should_trigger_recovery(state, threshold)
        state.alternative_options, state.recommended_option = [], None
        state.alternative_search = {"status": "not_needed"}
        if not state.recovery_triggered:
            for name in ("policy_agent", "alternative_agent"):
                state.agent_runs.append(AgentRun(agent=name, status="skipped"))

    async def run_workflow(self, state: JourneyState) -> JourneyState:
        logger.info(f"Starting journey analysis workflow for journey_id: {state.journey_id}, trace_id: {state.trace_id}")
        state.workflow_status = "IN_PROGRESS"
        if settings.ORCHESTRATOR_ENGINE == "sequential":
            return await self._run_sequential(state)
        result = await self.graph.ainvoke({"journey": state})
        return result["journey"]

    async def _run_sequential(self, state: JourneyState) -> JourneyState:
        """Same steps as the graph without LangGraph (fallback and parity testing)."""
        for name in ("flight_agent", "connection_agent", "weather_agent", "risk_agent"):
            await self._run_agent(name, state)
        self._route(state)
        if state.recovery_triggered:
            await self._run_agent("policy_agent", state)
            await self._run_agent("alternative_agent", state)
        await self._run_agent("recovery_agent", state)
        self._finalize(state)
        return state

    def _finalize(self, state: JourneyState) -> None:
        if not state.recommendation_text:
            state.recommendation_text = (
                "A recovery summary could not be generated. Check your flight status directly with your airline."
            )

        state.workflow_status = "PARTIAL" if any(r.status == "error" for r in state.agent_runs) else "COMPLETED"
        state.updated_at = datetime.now(timezone.utc).isoformat()

        state.is_demo_data = state.uses_demo_data()

        telemetry_sources = [
            {"name": f["source"], "type": "Aviation Data",
             "verified": f.get("data_mode") in ("live", "timetable") and f.get("status") != "UNKNOWN"}
            for f in state.flight_results if f.get("source")
        ] + [
            {"name": w["source"], "type": "Weather Forecast",
             "verified": not w.get("is_mock", False) and w.get("status") == "available"}
            for w in state.weather_results if w.get("source")
        ]

        # Policy sources are rebuilt from the evidence itself: an item is verified only when the
        # evidence says so, never because it came from the Policy Agent.
        policy_sources = [
            {"name": ev["title"], "type": "Policy Document", "verified": bool(ev.get("verified", False)),
             "url": ev.get("source_url", ""), "retrieved_at": ev.get("retrieved_at")}
            for ev in state.policy_evidence if ev.get("title")
        ]
        other_sources = [s for s in state.sources if s.get("type") != "Policy Document"]

        combined_sources = []
        seen_names = set()
        for s in [*telemetry_sources, *other_sources, *policy_sources]:
            if s.get("name") and s["name"] not in seen_names:
                combined_sources.append(s)
                seen_names.add(s["name"])
        state.sources = combined_sources

        if DISCLAIMER not in state.warnings:
            state.warnings.append(DISCLAIMER)
