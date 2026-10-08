from typing import Any, Dict, List, Tuple

from app.agents.base import BaseAgent
from app.orchestrator.state import JourneyState
from app.risk.config import confidence_label
from app.schemas.journey import AgentResultSchema
from app.schemas.risk import RiskComponent

class RiskAgent(BaseAgent):
    """
    Journey Disruption Risk Agent.
    Computes deterministic risk score:
    journey_risk = (flight_score * 0.40) + (connection_score * 0.35) + (weather_score * 0.25)

    Missing data is never scored. A component with no usable data (e.g. no weather
    forecast for the travel date) gets status "missing" and score None; the journey
    score is the weighted average of the available components (weights re-normalised,
    reported as effective_weights), overall confidence drops by the missing component's
    weight, and the possible score range is reported in uncertainty.
    """
    def __init__(self, flight_weight: float = 0.40, connection_weight: float = 0.35, weather_weight: float = 0.25):
        super().__init__(name="risk_agent")
        self.w_flight = flight_weight
        self.w_conn = connection_weight
        self.w_weather = weather_weight

    async def execute(self, state: JourneyState) -> AgentResultSchema:
        # Calculate Flight Score (0 - 100)
        flight_scores = []
        for f in state.flight_results:
            status = f.get("status", "UNKNOWN")
            delay = f.get("delay_minutes", 0)
            if status == "CANCELLED":
                flight_scores.append(100)
            elif status == "DIVERTED":
                flight_scores.append(90)
            elif delay >= 120:
                flight_scores.append(90)
            elif delay >= 60:
                flight_scores.append(80)
            elif delay >= 30:
                flight_scores.append(50)
            elif delay > 0:
                flight_scores.append(30)
            else:
                flight_scores.append(10)
        
        flight_score = max(flight_scores) if flight_scores else 10.0

        # Calculate Connection Score (0 - 100)
        conn_scores = []
        if not state.connection_results:
            connection_score = 0.0 # Direct flight
        else:
            for c in state.connection_results:
                status = c.get("status", "UNKNOWN")
                if status == "MISSED":
                    conn_scores.append(100)
                elif status == "LIKELY_MISSED":
                    conn_scores.append(90)
                elif status == "HIGH_RISK":
                    conn_scores.append(75)
                elif status == "MODERATE_RISK":
                    conn_scores.append(45)
                elif status == "SAFE":
                    conn_scores.append(10)
                else:
                    conn_scores.append(50)
            connection_score = max(conn_scores) if conn_scores else 10.0

        # Weather Score (0 - 100), or None when no airport has usable weather data
        weather_component, weather_uncertainty = self._weather_component(state.weather_results)

        components: Dict[str, RiskComponent] = {
            "flight": RiskComponent(
                status="available", score=int(flight_score), level=self._level(int(flight_score)), confidence=1.0
            ),
            "connection": RiskComponent(
                status="available", score=int(connection_score), level=self._level(int(connection_score)), confidence=1.0
            ),
            "weather": weather_component,
        }
        weights = {"flight": self.w_flight, "connection": self.w_conn, "weather": self.w_weather}

        # Weighted Total over the available components only
        available = [name for name, c in components.items() if c.status == "available"]
        available_weight = sum(weights[name] for name in available)
        effective_weights = {
            name: (weights[name] / available_weight if name in available else 0.0) for name in weights
        }
        total_risk = sum(components[name].score * effective_weights[name] for name in available)
        risk_int = int(total_risk + 0.5)
        level = self._level(risk_int)

        missing = [name for name, c in components.items() if c.status == "missing"]
        uncertainty = list(weather_uncertainty)
        if missing:
            # Bounds if each missing component were 0 (lower) or 100 (upper), on the original weights.
            known = sum(components[name].score * weights[name] for name in available)
            missing_weight = sum(weights[name] for name in missing)
            low, high = int(round(known)), int(round(known + 100 * missing_weight))
            uncertainty.insert(0, (
                f"{', '.join(m.capitalize() for m in missing)} risk unavailable: the score uses the available "
                f"components with re-normalised weights. Depending on the missing data it could be {low}-{high}."
            ))

        # Each component contributes its weight x its own confidence; missing components contribute 0.
        confidence = round(sum(weights[name] * c.confidence for name, c in components.items()), 2)

        risk_analysis = {
            "score": risk_int,
            "level": level,
            "is_probability": False,
            "status": "partial" if missing else "complete",
            "flight_score": flight_score,
            "connection_score": connection_score,
            "weather_score": weather_component.score,
            "weights": weights,
            "effective_weights": {name: round(w, 4) for name, w in effective_weights.items()},
            "confidence": confidence,
            "confidence_label": confidence_label(confidence),
            "components": {name: c.model_dump() for name, c in components.items()},
            "missing_data": missing,
            "uncertainty": uncertainty,
        }

        state.risk_analysis = risk_analysis

        return self.create_result(
            status="partial" if missing else "success",
            data={"risk_analysis": risk_analysis},
            trace_id=state.trace_id,
            confidence=confidence_label(confidence),
            warnings=uncertainty,
        )

    @staticmethod
    def _level(score: int) -> str:
        if score >= 80:
            return "VERY_HIGH"
        if score >= 60:
            return "HIGH"
        if score >= 30:
            return "MODERATE"
        return "LOW"

    def _weather_component(self, weather_results: List[Dict[str, Any]]) -> Tuple[RiskComponent, List[str]]:
        """
        The worst available airport score is the weather score. Airports without usable
        data are reported, never scored; if no airport has data the component is "missing".
        """
        scored: List[Tuple[int, float, str]] = []
        unavailable: List[Tuple[str, str]] = []
        for w in weather_results:
            airport = w.get("airport") or "an airport"
            score = w.get("weather_score", w.get("weather_risk_score"))  # legacy key
            usable = isinstance(score, (int, float)) and not isinstance(score, bool) and 0 <= score <= 100
            if w.get("status", "available") == "available" and usable:
                confidence = w.get("confidence", 1.0)
                confidence = confidence if isinstance(confidence, (int, float)) and 0 <= confidence <= 1 else 1.0
                scored.append((int(score), float(confidence), airport))
            else:
                reasons = w.get("warnings") or []
                unavailable.append((airport, reasons[0] if reasons else f"Weather data unavailable for {airport}."))

        details: Dict[str, Any] = {
            "airports_scored": [a for _, _, a in scored],
            "airports_unavailable": {a: r for a, r in unavailable},
        }

        if not scored:
            if unavailable:
                reason = f"Weather unavailable for {', '.join(a for a, _ in unavailable)}. {unavailable[0][1]}"
            else:
                reason = "No weather data was provided for this journey."
            return RiskComponent(status="missing", score=None, level=None, confidence=0.0, reason=reason, details=details), []

        worst_score, _, worst_airport = max(scored)
        # Partial coverage lowers confidence in proportion to the airports without data.
        confidence = min(c for _, c, _ in scored) * len(scored) / (len(scored) + len(unavailable))
        uncertainty = [
            f"Weather unavailable for {a}: {r} The weather score only covers {', '.join(details['airports_scored'])}."
            for a, r in unavailable
        ]
        return RiskComponent(
            status="available",
            score=worst_score,
            level=self._level(worst_score),
            confidence=round(confidence, 2),
            reason=f"Highest airport weather risk: {worst_airport}",
            details=details,
        ), uncertainty
