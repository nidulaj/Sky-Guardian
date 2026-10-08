import logging
from typing import Optional

from app.agents.base import BaseAgent
from app.agents.recovery_facts import build_fact_sheet
from app.agents.recovery_template import render_markdown, render_template
from app.orchestrator.state import JourneyState
from app.schemas.journey import AgentResultSchema

logger = logging.getLogger(__name__)


class RecoveryAgent(BaseAgent):
    """
    Passenger Recovery Recommendation Agent.
    Builds a deterministic fact sheet from the flight, connection, weather, risk, policy and
    alternative results, then renders an explainable recovery plan grounded only in those facts.
    """
    def __init__(self, llm_provider=None):
        super().__init__(name="recovery_agent")
        self.llm_provider = llm_provider

    async def execute(self, state: JourneyState) -> AgentResultSchema:
        facts = build_fact_sheet(state)
        plan = render_template(facts)

        state.recovery_plan = plan.model_dump()
        state.recommendation_mode = "template"
        state.recommendation_text = render_markdown(plan, facts)

        return self.create_result(
            status="success",
            data={
                "recommendation": state.recommendation_text,
                "recovery_plan": state.recovery_plan,
                "generation_mode": "template",
                "grounded_policy_count": len(facts.policies),
                "risk_score": facts.risk.score,
                "conn_status": facts.primary_connection.status if facts.primary_connection else None,
            },
            trace_id=state.trace_id,
            confidence="high" if facts.policies else "medium",
        )
