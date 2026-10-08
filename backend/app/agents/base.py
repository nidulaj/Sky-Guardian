from abc import ABC, abstractmethod
from typing import Dict, Any
from app.orchestrator.state import JourneyState
from app.schemas.journey import AgentResultSchema
from datetime import datetime, timezone

class BaseAgent(ABC):
    def __init__(self, name: str):
        self.name = name

    @abstractmethod
    async def execute(self, state: JourneyState) -> AgentResultSchema:
        """Executes agent logic on the shared journey state and returns a structured AgentResultSchema."""
        pass

    def create_result(
        self,
        status: str,
        data: Dict[str, Any],
        trace_id: str,
        confidence: str = "high",
        evidence: list = None,
        warnings: list = None,
        source_timestamp: str = None
    ) -> AgentResultSchema:
        now_iso = datetime.now(timezone.utc).isoformat()
        return AgentResultSchema(
            agent=self.name,
            status=status,
            data=data,
            confidence=confidence,
            evidence=evidence or [],
            warnings=warnings or [],
            source_timestamp=source_timestamp or now_iso,
            generated_at=now_iso,
            trace_id=trace_id
        )
