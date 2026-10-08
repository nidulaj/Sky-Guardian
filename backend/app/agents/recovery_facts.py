"""
Deterministic fact sheet for the Recovery Agent.

build_fact_sheet(state) collects the verified facts from the other agents' results. It is the
only input the recovery LLM sees, and the template fallback renders from it too. Pure function:
no I/O, never invents a value; anything not measured stays None ("unknown").
"""
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel

from app.orchestrator.state import JourneyState
from app.risk.config import get_risk_config

SNIPPET_LIMIT = 600
AT_RISK_CONNECTIONS = {"HIGH_RISK", "LIKELY_MISSED", "MISSED"}
# Worst first; used to pick the connection the passenger most needs to hear about.
CONNECTION_SEVERITY = {"MISSED": 5, "LIKELY_MISSED": 4, "HIGH_RISK": 3, "MODERATE_RISK": 2, "UNKNOWN": 1, "SAFE": 0}
# Connection Agent reason codes whose minute fields are measured (see risk/connection_risk.py).
TIMED_CONNECTION_CODES = {
    "NEGATIVE_CONNECTION_WINDOW", "BELOW_MINIMUM_CONNECTION_TIME", "TIGHT_TRANSFER_BUFFER",
    "MODERATE_BUFFER", "SUFFICIENT_TRANSFER_TIME",
}
LANGUAGE_NAMES = {"en": "English", "si": "Sinhala", "ta": "Tamil"}


class FlightFact(BaseModel):
    flight_number: str
    airline: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    status: str = "UNKNOWN"
    # None when the delay was not measured (unknown status or no data), never a default 0.
    delay_minutes: Optional[int] = None
    scheduled_departure: Optional[str] = None
    expected_departure: Optional[str] = None
    expected_arrival: Optional[str] = None
    data_mode: Optional[str] = None


class ConnectionFact(BaseModel):
    airport: Optional[str] = None
    inbound_flight: Optional[str] = None
    outbound_flight: Optional[str] = None
    # None when the window could not be calculated (no placeholder zeros).
    available_minutes: Optional[int] = None
    required_minutes: Optional[int] = None
    buffer_minutes: Optional[int] = None
    status: str = "UNKNOWN"


class RiskFact(BaseModel):
    score: Optional[int] = None
    level: str = "UNKNOWN"
    is_probability: Literal[False] = False
    top_factors: List[str] = []
    missing_data: List[str] = []


class WeatherFact(BaseModel):
    airport: str
    severity: Optional[str] = None
    conditions: List[str] = []
    note: str = "Weather may increase disruption risk; it is not confirmed as the cause of any delay."


class PolicyFact(BaseModel):
    id: str
    airline: Optional[str] = None
    title: Optional[str] = None
    policy_type: Optional[str] = None
    source_url: Optional[str] = None
    snippet: str = ""
    verified: bool = False
    data_mode: Optional[str] = None


class OptionFact(BaseModel):
    route_summary: str
    departure: Optional[str] = None
    arrival: Optional[str] = None
    connections: Optional[int] = None
    ranking_score: Optional[float] = None
    ranking_reasons: List[str] = []
    data_mode: Optional[str] = None
    price: str = "UNKNOWN"
    seat_availability: str = "UNKNOWN"


class RecoveryFacts(BaseModel):
    origin: Optional[str] = None
    destination: Optional[str] = None
    language: str = "en"
    language_name: str = "English"
    flights: List[FlightFact] = []
    connections: List[ConnectionFact] = []
    primary_connection: Optional[ConnectionFact] = None
    disrupted_flight: Optional[FlightFact] = None
    risk: RiskFact = RiskFact()
    risk_threshold: int = 60
    weather: List[WeatherFact] = []
    policies: List[PolicyFact] = []
    recommended_option: Optional[OptionFact] = None
    other_options: List[OptionFact] = []
    recovery_triggered: bool = False
    recovery_reasons: List[str] = []
    alternatives_requested: bool = False
    is_demo_data: bool = False
    carrier_to_contact: Optional[str] = None

    @property
    def cancelled_flights(self) -> List[FlightFact]:
        return [f for f in self.flights if f.status == "CANCELLED"]

    @property
    def connection_at_risk(self) -> bool:
        return self.primary_connection is not None and self.primary_connection.status in AT_RISK_CONNECTIONS

    @property
    def risk_above_threshold(self) -> bool:
        return self.risk.score is not None and self.risk.score >= self.risk_threshold

    @property
    def policy_ids(self) -> List[str]:
        return [p.id for p in self.policies]


def _int_or_none(value: Any) -> Optional[int]:
    return value if isinstance(value, int) and not isinstance(value, bool) else None


def _flight_fact(f: Dict[str, Any]) -> FlightFact:
    status = f.get("status") or "UNKNOWN"
    measured = status not in ("UNKNOWN", "CANCELLED") and f.get("data_mode") not in (None, "none")
    return FlightFact(
        flight_number=str(f.get("flight_number") or "unknown flight"),
        airline=f.get("airline"),
        origin=f.get("origin"),
        destination=f.get("destination"),
        status=status,
        delay_minutes=_int_or_none(f.get("delay_minutes")) if measured else None,
        scheduled_departure=f.get("scheduled_departure"),
        expected_departure=f.get("actual_departure") or f.get("estimated_departure") or f.get("scheduled_departure"),
        expected_arrival=f.get("actual_arrival") or f.get("estimated_arrival") or f.get("scheduled_arrival"),
        data_mode=f.get("data_mode"),
    )


def _connection_fact(c: Dict[str, Any]) -> ConnectionFact:
    timed = bool(TIMED_CONNECTION_CODES.intersection(c.get("reason_codes") or []))
    return ConnectionFact(
        airport=c.get("airport"),
        inbound_flight=c.get("inbound_flight"),
        outbound_flight=c.get("outbound_flight"),
        available_minutes=_int_or_none(c.get("available_connection_minutes")) if timed else None,
        required_minutes=_int_or_none(c.get("minimum_required_minutes")),
        buffer_minutes=_int_or_none(c.get("buffer_minutes")) if timed else None,
        status=c.get("status") or "UNKNOWN",
    )


def _option_fact(o: Dict[str, Any]) -> OptionFact:
    return OptionFact(
        route_summary=str(o.get("route_summary") or "alternative route"),
        departure=o.get("departure"),
        arrival=o.get("arrival"),
        connections=_int_or_none(o.get("connections")),
        ranking_score=o.get("ranking_score"),
        ranking_reasons=list(o.get("ranking_reasons") or [])[:3],
        data_mode=o.get("data_mode"),
        price=str(o.get("price") or "UNKNOWN"),
        seat_availability=str(o.get("availability_status") or "UNKNOWN"),
    )


def _disrupted_flight(flights: List[FlightFact], primary: Optional[ConnectionFact]) -> Optional[FlightFact]:
    """The leg the passenger should raise with the airline: cancelled/diverted first, then the inbound
    leg of an at-risk connection, then the most delayed leg."""
    for f in flights:
        if f.status in ("CANCELLED", "DIVERTED"):
            return f
    if primary is not None and primary.status in AT_RISK_CONNECTIONS and primary.inbound_flight:
        for f in flights:
            if f.flight_number == primary.inbound_flight:
                return f
    delayed = [f for f in flights if f.delay_minutes]
    if delayed:
        return max(delayed, key=lambda f: f.delay_minutes)
    if primary is not None and primary.status in AT_RISK_CONNECTIONS and flights:
        return flights[0]
    return None


def build_fact_sheet(state: JourneyState, risk_threshold: Optional[int] = None) -> RecoveryFacts:
    flights = [_flight_fact(f) for f in state.flight_results if isinstance(f, dict)]
    connections = [_connection_fact(c) for c in state.connection_results if isinstance(c, dict)]
    primary = max(connections, key=lambda c: CONNECTION_SEVERITY.get(c.status, 1), default=None)
    disrupted = _disrupted_flight(flights, primary)

    risk = state.risk_analysis or {}
    score = _int_or_none(risk.get("score"))
    risk_fact = RiskFact(
        score=score,
        level=risk.get("level") or ("UNKNOWN" if score is None else "LOW"),
        top_factors=[str(f.get("factor") or f.get("reason")) for f in risk.get("top_factors") or [] if isinstance(f, dict)][:3],
        missing_data=list(risk.get("missing_data") or []),
    )

    weather = [
        WeatherFact(airport=w["airport"], severity=w.get("weather_risk"), conditions=list(w.get("conditions") or [])[:3])
        for w in state.weather_results
        if isinstance(w, dict) and w.get("airport") and w.get("status", "available") == "available"
    ]

    policies = [
        PolicyFact(
            id=f"P{i}",
            airline=ev.get("airline"),
            title=ev.get("title"),
            policy_type=ev.get("policy_type"),
            source_url=ev.get("source_url"),
            snippet=str(ev.get("snippet") or "").strip()[:SNIPPET_LIMIT],
            verified=bool(ev.get("verified", False)),
            data_mode=ev.get("data_mode"),
        )
        for i, ev in enumerate((e for e in state.policy_evidence if isinstance(e, dict)), start=1)
    ]

    options = [o for o in state.alternative_options if isinstance(o, dict)]
    recommended = state.recommended_option or (options[0] if options else None)
    others = [o for o in options if o != recommended][:2]

    carrier = disrupted.airline if disrupted and disrupted.airline else None
    if carrier is None and len({f.airline for f in flights if f.airline}) == 1:
        carrier = next(f.airline for f in flights if f.airline)

    language = state.preferred_language or "en"
    return RecoveryFacts(
        origin=state.origin or (flights[0].origin if flights else None),
        destination=state.destination or (flights[-1].destination if flights else None),
        language=language,
        language_name=LANGUAGE_NAMES.get(language, "English"),
        flights=flights,
        connections=connections,
        primary_connection=primary,
        disrupted_flight=disrupted,
        risk=risk_fact,
        risk_threshold=risk_threshold if risk_threshold is not None else get_risk_config().triggers.recovery_trigger_threshold,
        weather=weather,
        policies=policies,
        recommended_option=_option_fact(recommended) if recommended else None,
        other_options=[_option_fact(o) for o in others],
        recovery_triggered=state.recovery_triggered,
        recovery_reasons=list(state.recovery_reasons),
        alternatives_requested=state.alternatives_requested,
        is_demo_data=state.uses_demo_data(),
        carrier_to_contact=carrier,
    )
