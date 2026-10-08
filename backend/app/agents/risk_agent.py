from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple, get_args

from app.agents.base import BaseAgent
from app.orchestrator.state import JourneyState
from app.risk.config import RiskConfig, confidence_label, get_risk_config, round_half_up
from app.risk.connection_risk import assess_connection, safe_text as _safe_text
from app.schemas.flight import FlightStatus
from app.schemas.journey import AgentResultSchema, RiskSummary
from app.schemas.risk import RiskComponent, RiskFactor

COMPONENTS = ("flight", "connection", "weather")
_LABELS = {"flight": "Flight", "connection": "Connection", "weather": "Weather"}
_FLIGHT_STATUSES = set(get_args(FlightStatus))


@dataclass
class _Assessed:
    """A scored component plus the notes it contributes to the journey result."""
    component: RiskComponent
    uncertainty: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    # Labels of legs/connections that trigger a minimum-score override.
    critical: List[str] = field(default_factory=list)


def _is_int(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)



def _level_text(level: str) -> str:
    return level.replace("_", " ").lower()


class RiskAgent(BaseAgent):
    """
    Journey Disruption Risk Agent: the aggregation layer after the Flight, Connection
    and Weather agents.

    It reads their outputs from JourneyState (flight_results, connection_results,
    weather_results), turns each agent's own assessment into a 0-100 component score
    using config/risk.yaml, and combines them deterministically:

        score = flight x w_flight + connection x w_connection + weather x w_weather

    It never calls a data provider, never recomputes flight or connection status from
    raw timestamps, and never uses an LLM for numbers. A component with no usable
    data is "missing" (score None, never 0): the remaining weights are re-normalised,
    confidence drops by the missing weight and the possible range is reported. With
    no usable component at all the level is UNKNOWN and no score is given.
    """
    def __init__(self, risk_config: Optional[RiskConfig] = None):
        super().__init__(name="risk_agent")
        self.config = risk_config or get_risk_config()

    async def execute(self, state: JourneyState) -> AgentResultSchema:
        legs = max(len(state.journey_legs), len(state.flight_results))
        assessed = {
            "flight": self._flight_component(state.flight_results, legs),
            "connection": self._connection_component(state.connection_results, legs - 1, state.flight_results),
            "weather": self._weather_component(state.weather_results),
        }
        summary = self._combine(assessed)
        state.risk_analysis = summary.model_dump()

        agent_status = {"complete": "success", "partial": "partial", "insufficient_data": "unavailable"}[summary.status]
        return self.create_result(
            status=agent_status,
            data={"risk_analysis": state.risk_analysis},
            trace_id=state.trace_id,
            confidence=summary.confidence_label or "unknown",
            warnings=summary.uncertainty,
        )

    # ------------------------------------------------------------------
    # Combination
    # ------------------------------------------------------------------

    def _combine(self, assessed: Dict[str, _Assessed]) -> RiskSummary:
        cfg = self.config
        weights = cfg.weights.as_dict()
        components = {name: a.component for name, a in assessed.items()}

        applicable = [n for n in COMPONENTS if components[n].status != "not_applicable"]
        available = [n for n in applicable if components[n].status == "available"]
        missing = [n for n in applicable if components[n].status == "missing"]
        applicable_weight = sum(weights[n] for n in applicable)

        uncertainty: List[str] = [u for n in COMPONENTS for u in assessed[n].uncertainty]
        warnings: List[str] = list(dict.fromkeys(w for n in COMPONENTS for w in assessed[n].warnings))
        thresholds = {
            "low_max": cfg.levels.low_max, "moderate_max": cfg.levels.moderate_max, "high_max": cfg.levels.high_max,
        }
        component_scores = {f"{n}_score": components[n].score for n in COMPONENTS}

        if not available:
            reasons = [f"{_LABELS[n]}: {components[n].reason}" for n in missing]
            return RiskSummary(
                score=None,
                level="UNKNOWN",
                status="insufficient_data",
                confidence=0.0,
                confidence_label="unknown",
                components=components,
                weights=weights,
                effective_weights={n: 0.0 for n in COMPONENTS},
                level_thresholds=thresholds,
                missing_data=missing,
                uncertainty=uncertainty,
                explanation=[
                    "Overall risk: unknown. No flight, connection or weather result could be scored, so no score is given."
                ] + reasons,
                warnings=warnings,
                **component_scores,
            )

        available_weight = sum(weights[n] for n in available)
        effective = {n: (weights[n] / available_weight if n in available else 0.0) for n in COMPONENTS}
        weighted = sum(components[n].score * effective[n] for n in available)
        score = round_half_up(weighted)

        floors = self._override_floors(assessed)
        applied_overrides: List[str] = []
        for floor, note in floors:
            if score < floor:
                score = floor
                applied_overrides.append(note)
        level = cfg.levels.level_for(score)

        if missing:
            # Range if every missing component scored 0 or 100, on the configured weights.
            known = sum(components[n].score * weights[n] for n in available)
            missing_weight = sum(weights[n] for n in missing)
            low = round_half_up(known / applicable_weight)
            high = round_half_up((known + 100 * missing_weight) / applicable_weight)
            for floor, _ in floors:
                low, high = max(low, floor), max(high, floor)
            names = ", ".join(_LABELS[n] for n in missing)
            uncertainty.insert(0, (
                f"{names} risk unavailable: the score uses the available components with re-normalised weights. "
                f"Depending on the missing data it could be {low}-{high}."
            ))

        # Each applicable component adds weight x its confidence; missing ones add nothing.
        confidence = round(sum(weights[n] * components[n].confidence for n in available) / applicable_weight, 2)

        top_factors = sorted(
            (
                RiskFactor(
                    factor=self._factor_name(n, assessed[n]),
                    component=n,
                    impact=components[n].score,
                    contribution=round(components[n].score * effective[n], 2),
                    reason=components[n].reason or "",
                )
                for n in available
            ),
            key=lambda f: (-f.contribution, COMPONENTS.index(f.component)),
        )

        explanation = [
            f"Overall risk: {_level_text(level)} ({score}/100). This is a decision-support score, not a probability."
        ]
        for f in top_factors:
            c = components[f.component]
            explanation.append(f"{_LABELS[f.component]} risk is {_level_text(c.level)} ({c.score}/100): {c.reason}")
        for n in missing:
            explanation.append(f"{_LABELS[n]} risk is unavailable: {components[n].reason}")
        for n in COMPONENTS:
            if components[n].status == "not_applicable":
                explanation.append(f"{_LABELS[n]} risk does not apply: {components[n].reason}")
        explanation.extend(applied_overrides)

        return RiskSummary(
            score=score,
            level=level,
            status="partial" if missing else "complete",
            confidence=confidence,
            confidence_label=confidence_label(confidence),
            components=components,
            weights=weights,
            effective_weights={n: round(w, 4) for n, w in effective.items()},
            weighted_score=round(weighted, 2),
            applied_overrides=applied_overrides,
            level_thresholds=thresholds,
            missing_data=missing,
            uncertainty=uncertainty,
            top_factors=top_factors,
            explanation=explanation,
            warnings=warnings,
            **component_scores,
        )

    def _override_floors(self, assessed: Dict[str, _Assessed]) -> List[Tuple[int, str]]:
        o = self.config.overrides
        floors = []
        if assessed["flight"].critical:
            floors.append((o.cancelled_flight_min_score, (
                f"Minimum score {o.cancelled_flight_min_score} applied: the Flight Agent reports "
                f"{', '.join(assessed['flight'].critical)} as cancelled."
            )))
        if assessed["connection"].critical:
            floors.append((o.impossible_connection_min_score, (
                f"Minimum score {o.impossible_connection_min_score} applied: the Connection Agent reports the connection "
                f"at {', '.join(assessed['connection'].critical)} as missed."
            )))
        return floors

    @staticmethod
    def _factor_name(name: str, a: _Assessed) -> str:
        if name == "flight":
            return "Flight cancellation" if a.critical else "Flight delay"
        return _LABELS[name]

    def _data_quality_factor(self, data_mode: str) -> float:
        """Confidence factor for where a Flight Agent result came from (FlightResult.data_mode)."""
        c = self.config.confidence
        if data_mode == "demo":
            return c.mock_data_factor
        if data_mode == "timetable":
            return c.estimated_times_factor
        return 1.0

    @staticmethod
    def _has_live_times(flight: Dict[str, Any]) -> bool:
        return any(flight.get(k) for k in ("estimated_departure", "estimated_arrival", "actual_departure", "actual_arrival"))

    # ------------------------------------------------------------------
    # Flight Agent -> flight component
    # ------------------------------------------------------------------

    def _flight_component(self, flights: List[Any], leg_count: int) -> _Assessed:
        """Worst leg wins. Legs with status UNKNOWN or invalid data are unavailable, never 'no delay'."""
        cfg = self.config.flight
        scored: List[Tuple[int, str, str]] = []  # (score, label, reason)
        unavailable: Dict[str, str] = {}
        statuses: Dict[str, str] = {}
        cancelled: List[str] = []
        delayed_estimates: List[str] = []
        data_modes: Dict[str, str] = {}
        quality: Dict[str, float] = {}

        for i, f in enumerate(flights):
            if not isinstance(f, dict):
                unavailable[f"leg {i + 1}"] = "invalid Flight Agent result"
                continue
            label = _safe_text(f.get("flight_number")) or f"leg {i + 1}"
            status = f.get("status")
            if status not in _FLIGHT_STATUSES:
                unavailable[label] = "unrecognised flight status"
                continue
            statuses[label] = status
            data_modes[label] = f.get("data_mode") or "none"
            quality[label] = self._data_quality_factor(data_modes[label])

            if status == "UNKNOWN":
                codes = [_safe_text(c, 32) for c in f.get("reason_codes") or [] if isinstance(c, str)]
                unavailable[label] = ", ".join(codes) or "status unknown"
            elif status == "CANCELLED":
                scored.append((cfg.cancelled_score, label, f"{label} is cancelled."))
                cancelled.append(label)
            elif status == "DIVERTED":
                scored.append((cfg.diverted_score, label, f"{label} has been diverted."))
            else:
                delay = f.get("delay_minutes")
                if not _is_int(delay) or delay < 0 or delay > cfg.max_plausible_delay_minutes:
                    unavailable[label] = "invalid delay_minutes"
                    continue
                # A published-timetable result carries no delay information yet: its delay of 0 is a
                # placeholder, not "on time" (see docs/handoff/flight-agent.md, data_mode).
                if data_modes[label] == "timetable" and delay == 0 and not self._has_live_times(f):
                    unavailable[label] = "published timetable only, no live delay information yet"
                    continue
                if delay > 0:
                    reason = f"{label} is delayed by {delay} minutes."
                    if status != "LANDED":
                        delayed_estimates.append(label)
                else:
                    reason = f"{label} is {_level_text(status)} with no reported delay."
                scored.append((cfg.score_for_delay(delay), label, reason))

        for i in range(len(flights), leg_count):
            unavailable[f"leg {i + 1}"] = "no Flight Agent result"

        details = {
            "flight_statuses": statuses,
            "data_modes": data_modes,
            "legs_scored": [label for _, label, _ in scored],
            "legs_unavailable": unavailable,
        }
        warnings = [f"Flight status unavailable for {label} ({reason})." for label, reason in unavailable.items()]

        if not scored:
            reason = (
                "Flight status unavailable for " + ", ".join(f"{k} ({v})" for k, v in unavailable.items()) + "."
                if unavailable else "The Flight Agent returned no results."
            )
            return _Assessed(RiskComponent(status="missing", confidence=0.0, reason=reason, details=details), warnings=warnings)

        worst_score, worst_label, worst_reason = max(scored, key=lambda s: s[0])
        details["worst_leg"] = worst_label
        uncertainty = [
            f"Flight status unavailable for {label} ({reason}); the flight score only covers {', '.join(details['legs_scored'])}."
            for label, reason in unavailable.items()
        ]
        if worst_label in delayed_estimates:
            uncertainty.append(f"The delay for {worst_label} is the current estimate and may change.")
        demo_legs = [label for _, label, _ in scored if data_modes.get(label) == "demo"]
        if demo_legs:
            uncertainty.append(f"Flight data for {', '.join(demo_legs)} is demo data, not live airline information.")

        coverage = len(scored) / (len(scored) + len(unavailable))
        data_quality = min(quality.get(label, 1.0) for _, label, _ in scored)
        return _Assessed(
            RiskComponent(
                status="available",
                score=worst_score,
                level=self.config.levels.level_for(worst_score),
                confidence=round(coverage * data_quality, 2),
                reason=worst_reason,
                details=details,
            ),
            uncertainty=uncertainty,
            warnings=warnings,
            critical=cancelled,
        )

    # ------------------------------------------------------------------
    # Connection Agent -> connection component
    # ------------------------------------------------------------------

    def _connection_component(self, connections: List[Any], expected: int, flights: Optional[List[Any]] = None) -> _Assessed:
        """
        Worst transfer wins. Each Connection Agent result is turned into a ConnectionRisk
        (app/risk/connection_risk.py); UNAVAILABLE transfers are reported, never scored.
        Confidence also reflects the Flight Agent data behind each transfer window
        (connection i is built from flights i and i + 1).
        """
        flights = flights or []
        if not connections:
            if expected <= 0:
                return _Assessed(RiskComponent(
                    status="not_applicable", confidence=1.0, reason="Direct flight: there is no connection to assess.",
                ))
            reason = "The Connection Agent returned no result for this multi-leg journey."
            return _Assessed(RiskComponent(status="missing", confidence=0.0, reason=reason), warnings=[reason])

        assessed = [assess_connection(c, i, self.config.connection) for i, c in enumerate(connections)]
        label = lambda r: r.airport or f"connection {r.connection_index + 1}"  # noqa: E731
        scored = [r for r in assessed if r.risk_score is not None]
        unavailable: Dict[str, str] = {
            label(r): ", ".join(r.reason_codes) or r.reason for r in assessed if r.risk_score is None
        }
        for i in range(len(connections), expected):
            unavailable[f"connection {i + 1}"] = "no Connection Agent result"

        details = {
            "connections": [r.model_dump() for r in assessed],
            "connection_statuses": {label(r): r.status for r in assessed},
            "connections_scored": [label(r) for r in scored],
            "connections_unavailable": unavailable,
        }
        warnings = [f"Connection at {k} could not be assessed ({v})." for k, v in unavailable.items()]

        if not scored:
            reason = "Connection could not be assessed: " + ", ".join(f"{k} ({v})" for k, v in unavailable.items()) + "."
            return _Assessed(RiskComponent(status="missing", confidence=0.0, reason=reason, details=details), warnings=warnings)

        worst = max(scored, key=lambda r: r.risk_score)
        details["worst_connection"] = label(worst)
        uncertainty = [
            f"Connection at {k} could not be assessed ({v}); the connection score only covers "
            f"{', '.join(details['connections_scored'])}."
            for k, v in unavailable.items()
        ]

        def modes(r) -> List[str]:
            legs = flights[r.connection_index:r.connection_index + 2]
            return [f.get("data_mode") or "none" for f in legs if isinstance(f, dict)]

        if any("timetable" in modes(r) for r in scored):
            uncertainty.append(
                f"The connection window at {label(worst)} is based on published schedules; "
                "delays are not known yet and may shorten it."
            )
        data_quality = min(
            (min((self._data_quality_factor(m) for m in modes(r)), default=1.0) for r in scored), default=1.0
        )
        coverage = len(scored) / (len(scored) + len(unavailable))
        return _Assessed(
            RiskComponent(
                status="available",
                score=worst.risk_score,
                level=self.config.levels.level_for(worst.risk_score),
                confidence=round(coverage * data_quality, 2),
                reason=worst.reason,
                details=details,
            ),
            uncertainty=uncertainty,
            warnings=warnings,
            critical=[label(r) for r in scored if r.status == "MISSED"],
        )

    # ------------------------------------------------------------------
    # Weather Agent -> weather component
    # ------------------------------------------------------------------

    def _weather_component(self, weather_results: List[Any]) -> _Assessed:
        """
        The worst available airport score is the weather score, used as the Weather Agent
        calculated it. Airports without usable data are reported, never scored; if no
        airport has data the component is "missing".
        """
        scored: List[Tuple[int, float, str, List[str]]] = []
        unavailable: List[Tuple[str, str]] = []
        warnings: List[str] = []
        for w in weather_results:
            if not isinstance(w, dict):
                unavailable.append(("an airport", "Invalid Weather Agent result."))
                continue
            airport = _safe_text(w.get("airport"), 3) or "an airport"
            warnings.extend(x for x in w.get("warnings") or [] if isinstance(x, str))
            score = w.get("weather_score", w.get("weather_risk_score"))  # legacy key
            usable = _is_number(score) and 0 <= score <= 100
            if w.get("status", "available") == "available" and usable:
                confidence = w.get("confidence", 1.0)
                confidence = confidence if _is_number(confidence) and 0 <= confidence <= 1 else 1.0
                conditions = [c for c in w.get("conditions") or [] if isinstance(c, str)]
                scored.append((round_half_up(score), float(confidence), airport, conditions))
            else:
                reasons = [x for x in w.get("warnings") or [] if isinstance(x, str)]
                unavailable.append((airport, reasons[0] if reasons else f"Weather data unavailable for {airport}."))

        details: Dict[str, Any] = {
            "airports_scored": [a for _, _, a, _ in scored],
            "airports_unavailable": {a: r for a, r in unavailable},
        }

        if not scored:
            if unavailable:
                reason = f"Weather unavailable for {', '.join(a for a, _ in unavailable)}. {unavailable[0][1]}"
            else:
                reason = "No weather data was provided for this journey."
            return _Assessed(
                RiskComponent(status="missing", score=None, level=None, confidence=0.0, reason=reason, details=details),
                warnings=warnings,
            )

        worst_score, _, worst_airport, conditions = max(scored, key=lambda s: s[0])
        reason = f"Highest airport weather risk: {worst_airport}"
        if conditions:
            reason += f" ({', '.join(conditions[:3])})"
        # Partial coverage lowers confidence in proportion to the airports without data.
        confidence = min(c for _, c, _, _ in scored) * len(scored) / (len(scored) + len(unavailable))
        uncertainty = [
            f"Weather unavailable for {a}: {r} The weather score only covers {', '.join(details['airports_scored'])}."
            for a, r in unavailable
        ]
        return _Assessed(
            RiskComponent(
                status="available",
                score=worst_score,
                level=self.config.levels.level_for(worst_score),
                confidence=round(confidence, 2),
                reason=reason,
                details=details,
            ),
            uncertainty=uncertainty,
            warnings=warnings,
        )
