import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from app.agents.base import BaseAgent
from app.airports import get_airport, normalize_airport_code
from app.orchestrator.state import JourneyState
from app.providers.weather import WeatherDataProvider, WeatherProviderError, get_weather_provider
from app.risk.config import RiskConfig, confidence_label, get_risk_config
from app.risk.time_utils import try_parse_utc_timestamp
from app.risk.weather_scoring import score_weather
from app.schemas.journey import AgentResultSchema
from app.schemas.weather import AirportWeatherResult

logger = logging.getLogger(__name__)

# (target time, label) pairs; a None time means "current conditions".
_TargetTime = Tuple[Optional[datetime], str]


class WeatherAgent(BaseAgent):
    """
    Aviation Weather Context Agent.

    For every origin, transfer and destination airport:
    airport -> coordinates -> weather provider -> WeatherObservation
    -> existing weather scoring -> WeatherAssessment -> AirportWeatherResult.
    """
    def __init__(self, provider: Optional[WeatherDataProvider] = None, risk_config: Optional[RiskConfig] = None):
        super().__init__(name="weather_agent")
        self.provider = provider or get_weather_provider()
        self.risk_config = risk_config or get_risk_config()

    async def execute(self, state: JourneyState) -> AgentResultSchema:
        targets = self._collect_targets(state)

        results: List[AirportWeatherResult] = await asyncio.gather(*(
            self.assess_airport(code, roles=roles, target_times=times)
            for code, (roles, times) in targets.items()
        ))

        weather_results = [self._to_state_dict(r) for r in results]
        state.weather_results = weather_results

        available = [r for r in results if r.status == "available"]
        if not results or len(available) == len(results):
            status = "success"
        elif available:
            status = "partial"
        else:
            status = "unavailable"
        confidence = confidence_label(min(r.confidence for r in available)) if available else "unknown"
        warnings = [w for r in results for w in r.warnings]

        return self.create_result(
            status=status,
            data={"weather_results": weather_results},
            trace_id=state.trace_id,
            confidence=confidence,
            warnings=warnings,
        )

    async def assess_airport(
        self,
        airport_code: str,
        roles: Optional[List[str]] = None,
        target_times: Optional[List[_TargetTime]] = None,
    ) -> AirportWeatherResult:
        """
        Weather result for one airport. Never raises for data problems: unknown airports
        and provider failures come back as status="unavailable" with a warning.
        When several target times are given (e.g. arrival and onward departure at a
        transfer airport), the highest-risk hour is reported.
        """
        code = normalize_airport_code(airport_code)
        roles = roles or []
        airport = get_airport(code)
        if airport is None:
            return self._unavailable(code, roles, f"Airport {code or '(blank)'} is not in the airport coordinate table.")

        best: Optional[AirportWeatherResult] = None
        errors: List[str] = []
        for target_time, label in target_times or [(None, "current conditions")]:
            try:
                observation = await self.provider.get_observation(airport, target_time)
            except WeatherProviderError as exc:
                errors.append(str(exc))
                continue
            except Exception:
                logger.exception("Unexpected weather provider failure for %s", code)
                errors.append(f"Weather data for {code} could not be processed.")
                continue

            assessment = score_weather(observation, self.risk_config)
            result = AirportWeatherResult(
                airport=code,
                status="available" if assessment.score is not None else "unavailable",
                roles=roles,
                weather_risk=assessment.level,
                weather_score=assessment.score,
                conditions=assessment.conditions,
                factors=assessment.factors,
                component_scores=assessment.component_scores,
                observation=observation,
                forecast_window=self._forecast_window(observation.forecast_time, label),
                source=observation.source,
                is_mock=observation.is_mock,
                confidence=assessment.confidence,
                missing_data=assessment.missing_data,
                warnings=assessment.warnings,
                retrieved_at=observation.retrieved_at.isoformat(),
            )
            if best is None or self._score_rank(result) > self._score_rank(best):
                best = result

        if best is None:
            return self._unavailable(code, roles, *errors)
        if errors:
            best.warnings = best.warnings + errors
        return best

    def _collect_targets(self, state: JourneyState) -> Dict[str, Tuple[List[str], List[_TargetTime]]]:
        """Airports in journey order with their roles and the flight times to forecast."""
        # Flight Agent results carry estimated times; fall back to the requested legs.
        legs = [f for f in state.flight_results if f.get("origin") or f.get("destination")] or state.journey_legs
        targets: Dict[str, Tuple[List[str], List[_TargetTime]]] = {}

        def add(code: Any, role: str, time_value: Any, label: str) -> None:
            code = normalize_airport_code(code if isinstance(code, str) else None)
            if not code:
                return
            roles, times = targets.setdefault(code, ([], []))
            if role not in roles:
                roles.append(role)
            when = try_parse_utc_timestamp(time_value)
            if when is not None or not times:
                # Without flight times, fall back to a single current-conditions check.
                times[:] = [t for t in times if t[0] is not None]
                times.append((when, label))

        last = len(legs) - 1
        for i, leg in enumerate(legs):
            dep = leg.get("estimated_departure") or leg.get("scheduled_departure")
            arr = leg.get("estimated_arrival") or leg.get("scheduled_arrival")
            add(leg.get("origin"), "origin" if i == 0 else "transfer", dep, "departure")
            add(leg.get("destination"), "destination" if i == last else "transfer", arr, "arrival")
        return targets

    def _unavailable(self, code: str, roles: List[str], *reasons: str) -> AirportWeatherResult:
        safe_code = code if len(code) == 3 and code.isalpha() else "XXX"
        return AirportWeatherResult(
            airport=safe_code,
            status="unavailable",
            roles=roles,
            source=self.provider.name,
            is_mock=self.provider.is_mock,
            confidence=0.0,
            missing_data=["weather"],
            warnings=list(reasons) or [f"Weather data for {code} is unavailable."],
        )

    @staticmethod
    def _score_rank(result: AirportWeatherResult) -> int:
        return -1 if result.weather_score is None else result.weather_score

    @staticmethod
    def _forecast_window(forecast_time: Optional[datetime], label: str) -> Optional[str]:
        if forecast_time is None:
            return None
        return f"Hourly forecast for {forecast_time.isoformat(timespec='minutes')} ({label})"

    @staticmethod
    def _to_state_dict(result: AirportWeatherResult) -> Dict[str, Any]:
        data = result.model_dump(mode="json")
        # Legacy keys still read by the current Risk Agent; omitted when there is no score
        # so the Risk Agent falls back to its default instead of failing on None.
        if result.weather_score is not None:
            data["weather_risk_score"] = result.weather_score
        data["condition"] = result.observation.condition_text if result.observation else None
        data["timestamp"] = datetime.now(timezone.utc).isoformat()
        return data
