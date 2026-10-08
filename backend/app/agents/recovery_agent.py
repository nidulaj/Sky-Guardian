import logging
from typing import List, Optional, Tuple

from pydantic import ValidationError

from app.agents.base import BaseAgent
from app.agents.recovery_facts import RecoveryFacts, build_fact_sheet
from app.agents.recovery_prompt import build_system_prompt, build_user_message
from app.agents.recovery_template import render_markdown, render_template
from app.llm import LLMError
from app.orchestrator.state import JourneyState
from app.schemas.journey import AgentResultSchema
from app.schemas.recovery import RECOVERY_PLAN_SCHEMA, RecoveryPlan

logger = logging.getLogger(__name__)

LLM_FALLBACK_WARNING = "AI explanation unavailable; showing standard summary."


class RecoveryAgent(BaseAgent):
    """
    Passenger Recovery Recommendation Agent.
    Builds a deterministic fact sheet from the flight, connection, weather, risk, policy and
    alternative results. With an LLM provider configured, it asks for a plan grounded only in
    those facts and keeps it if it validates; otherwise (or on any failure) it renders the
    deterministic template.
    """
    def __init__(self, llm_provider=None):
        super().__init__(name="recovery_agent")
        self.llm_provider = llm_provider

    async def _llm_plan(self, facts: RecoveryFacts, trace_id: str) -> Tuple[Optional[RecoveryPlan], List[str]]:
        """Return (plan, errors). plan is None when the LLM output cannot be used."""
        try:
            raw = await self.llm_provider.generate_json(
                build_system_prompt(facts), build_user_message(facts), RECOVERY_PLAN_SCHEMA)
            return RecoveryPlan.model_validate(raw), []
        except LLMError as exc:
            errors = [str(exc)]
        except ValidationError as exc:
            errors = [f"schema: {err['loc']} {err['msg']}" for err in exc.errors()][:5]
        except Exception as exc:  # provider bug: never let it break the recommendation
            errors = [f"unexpected {type(exc).__name__}"]
        logger.warning("Recovery LLM output rejected for trace_id=%s: %s", trace_id, errors)
        return None, errors

    async def execute(self, state: JourneyState) -> AgentResultSchema:
        facts = build_fact_sheet(state)
        plan, mode, errors, warnings = None, "template", [], []

        if self.llm_provider is not None:
            plan, errors = await self._llm_plan(facts, state.trace_id)
            if plan is not None:
                mode = "llm"
            else:
                warnings.append(LLM_FALLBACK_WARNING)
                state.warnings.append(LLM_FALLBACK_WARNING)
        if plan is None:
            plan = render_template(facts)

        state.recovery_plan = plan.model_dump()
        state.recommendation_mode = mode
        state.recommendation_text = render_markdown(plan, facts)

        return self.create_result(
            status="success",
            data={
                "recommendation": state.recommendation_text,
                "recovery_plan": state.recovery_plan,
                "generation_mode": mode,
                "model": getattr(self.llm_provider, "model", None) if self.llm_provider else None,
                "validation_errors": errors,
                "grounded_policy_count": len(facts.policies),
                "risk_score": facts.risk.score,
                "conn_status": facts.primary_connection.status if facts.primary_connection else None,
            },
            trace_id=state.trace_id,
            confidence="high" if facts.policies else "medium",
            warnings=warnings,
        )
