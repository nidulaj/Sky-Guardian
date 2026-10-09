"""
Deterministic recovery plan ("Standard summary"): the baseline, and the fallback whenever the
LLM is not configured or its output fails validation. Renders only from RecoveryFacts.
"""
from typing import Dict, List, Optional

from app.agents.recovery_facts import ConnectionFact, FlightFact, RecoveryFacts
from app.schemas.recovery import RecoveryPlan

NO_POLICY = "Policy information could not be verified."
UNVERIFIED_POLICY = "Some policy text shown is not verified as the airline's official wording."
FEES_STEP = "Ask whether any fees, meals or accommodation apply; none are guaranteed by this assessment."


def _label(status: str) -> str:
    return status.replace("_", " ")


def _route(f: FlightFact) -> str:
    return f"{f.flight_number} from {f.origin or 'your origin'} to {f.destination or 'your destination'}"


def _risk_phrase(facts: RecoveryFacts) -> str:
    if facts.risk.score is None:
        return "an Estimated Journey Disruption Risk Score that could not be calculated"
    return f"an Estimated Journey Disruption Risk Score of **{facts.risk.score}/100 ({facts.risk.level} RISK)**"


def _carrier(facts: RecoveryFacts) -> str:
    return facts.carrier_to_contact or "your airline"


def _alternative_advice(facts: RecoveryFacts) -> str:
    option = facts.recommended_option
    if option is None:
        return f"No feasible alternative was verified. Ask {_carrier(facts)} for current rebooking options."
    advice = (f"The top-ranked schedule option is {option.route_summary}. Confirm seats, price, ticket eligibility "
              f"and your departure airport with {_carrier(facts)} before acting.")
    if option.data_mode == "demo":
        advice = "The alternatives below are DEMO DATA, not bookable flights. " + advice
    return advice


def _why_option(facts: RecoveryFacts) -> str:
    option = facts.recommended_option
    if option is None or not option.ranking_reasons:
        return ""
    reasons = [r.strip().rstrip(".") for r in option.ranking_reasons if r.strip()]
    return "Ranked first because: " + "; ".join(reasons) + "." if reasons else ""


def _connection_window(c: ConnectionFact) -> str:
    airport = c.airport or "your transfer airport"
    if c.available_minutes is None:
        return f"The connection time at {airport} could not be calculated."
    if c.required_minutes is not None and c.available_minutes < c.required_minutes:
        return (f"Your remaining connection window at {airport} is estimated at {c.available_minutes} minutes, "
                f"which is below the airport's minimum required connection time of {c.required_minutes} minutes.")
    required = f" against a {c.required_minutes}-minute minimum" if c.required_minutes is not None else ""
    return f"Your connection window at {airport} is estimated at {c.available_minutes} minutes{required}."


def _uncertainty(facts: RecoveryFacts) -> List[str]:
    notes: List[str] = []
    if facts.risk.score is None:
        notes.append("The overall disruption risk could not be scored with the data available.")
    elif facts.risk.missing_data:
        notes.append("Some data was unavailable (" + ", ".join(facts.risk.missing_data) + "), so the estimate is less certain.")
    if any(c.available_minutes is None for c in facts.connections):
        notes.append("At least one connection time could not be calculated.")
    needs_recovery = (facts.recovery_triggered or facts.cancelled_flights
                      or facts.connection_at_risk or facts.risk_above_threshold)
    if not facts.policies and needs_recovery:
        notes.append(NO_POLICY)
    elif any(not p.verified for p in facts.policies):
        notes.append(UNVERIFIED_POLICY)
    if facts.recommended_option is not None:
        notes.append("Seat availability and fares for alternative flights are unknown.")
    if facts.is_demo_data:
        notes.append("This check uses demo data, not live flight information.")
    return notes


def render_template(facts: RecoveryFacts) -> RecoveryPlan:
    carrier = _carrier(facts)
    connection = facts.primary_connection
    disrupted = facts.disrupted_flight
    citations = facts.policy_ids
    common = dict(policy_citations=citations, uncertainty=_uncertainty(facts), contact=carrier)

    if facts.cancelled_flights:
        flight = facts.cancelled_flights[0]
        later = any(f.status != "CANCELLED" for f in facts.flights[facts.flights.index(flight) + 1:])
        return RecoveryPlan(
            headline=f"Flight {flight.flight_number} is reported as cancelled",
            what_happened=f"Your flight {_route(flight)} is reported as **CANCELLED**.",
            impact="You will need a new flight for this part of your journey."
                   + (" Your later flights may also be affected." if later else ""),
            recommended_action=_alternative_advice(facts),
            why_this_option=_why_option(facts),
            next_steps=[
                f"Contact {carrier} or its service desk at {flight.origin or 'the airport'} to confirm your rebooking options.",
                "Ask which rebooking rules apply to your ticket.",
                FEES_STEP,
            ],
            **common,
        )

    if facts.connection_at_risk:
        airport = connection.airport or "your transfer airport"
        if disrupted and disrupted.delay_minutes:
            happened = f"Your flight {_route(disrupted)} is currently delayed by {disrupted.delay_minutes} minutes."
        elif disrupted:
            happened = f"Your flight {_route(disrupted)} is experiencing schedule disruption."
        else:
            happened = "A flight on your journey is experiencing schedule disruption."
        return RecoveryPlan(
            headline=f"Your connection at {airport} is {_label(connection.status).lower()}",
            what_happened=happened,
            impact=(f"{_connection_window(connection)} Consequently, your connection is classified as "
                    f"**{_label(connection.status)}** with {_risk_phrase(facts)}."),
            recommended_action=_alternative_advice(facts),
            why_this_option=_why_option(facts),
            next_steps=[
                f"Proceed to the {carrier} transit transfer desk upon arrival at {airport}.",
                "Present your boarding pass and ask which rebooking rules apply to your ticket.",
                FEES_STEP,
            ],
            **common,
        )

    if facts.risk_above_threshold:
        factors = f" Main factors: {', '.join(facts.risk.top_factors)}." if facts.risk.top_factors else ""
        return RecoveryPlan(
            headline=f"Elevated disruption risk: {facts.risk.score}/100 ({facts.risk.level})",
            what_happened=f"Your journey ({facts.origin} to {facts.destination}) has {_risk_phrase(facts)}.{factors}",
            impact="No connection is confirmed at risk, but disruption is more likely than usual. This is an estimate, not a probability.",
            recommended_action=_alternative_advice(facts),
            why_this_option=_why_option(facts),
            next_steps=[
                f"Check your flight status with {carrier} before you leave for the airport.",
                "Keep your booking reference ready in case you need to rebook.",
                FEES_STEP,
            ],
            **common,
        )

    if facts.risk.score is None:
        return RecoveryPlan(
            headline="Disruption risk could not be assessed",
            what_happened=("SkyGuardian could not assess the disruption risk for this journey because the flight, "
                           "connection and weather information needed was unavailable."),
            impact="Please check your flight status directly with your airline.",
            recommended_action=_alternative_advice(facts) if facts.alternatives_requested
                               else f"Check your flight status directly with {carrier}.",
            why_this_option=_why_option(facts) if facts.alternatives_requested else "",
            next_steps=[f"Check your flight status with {carrier} before you travel."],
            **common,
        )

    if connection is None:
        impact = "This is a direct flight, so there is no connection to miss." if len(facts.flights) <= 1 \
            else "No connection data was available for this journey."
    elif connection.available_minutes is None:
        impact = _connection_window(connection)
    else:
        required = f" against a {connection.required_minutes}-minute minimum" if connection.required_minutes is not None else ""
        impact = (f"Your connection window at {connection.airport or 'your transfer airport'} remains sufficient: "
                  f"an estimated {connection.available_minutes} minutes{required}.")
    return RecoveryPlan(
        headline="No critical disruption identified",
        what_happened=(f"Your journey ({facts.origin} to {facts.destination}) is operating with {_risk_phrase(facts)}. "
                       "No critical schedule disruption has been identified."),
        impact=impact,
        recommended_action=_alternative_advice(facts) if facts.alternatives_requested
                           else "No action is needed now. Check your flight status again before you leave for the airport.",
        why_this_option=_why_option(facts) if facts.alternatives_requested else "",
        next_steps=[f"Check your flight status with {carrier} on the day of travel."],
        **common,
    )


def render_markdown(plan: RecoveryPlan, facts: Optional[RecoveryFacts] = None) -> str:
    """Plain text with **bold** only, for the existing SafeRichText recommendation view."""
    titles: Dict[str, str] = {}
    if facts is not None:
        titles = {p.id: f"{p.title or 'Policy'}" + (f" ({p.airline})" if p.airline else "") for p in facts.policies}
    parts = [f"**{plan.headline}**", f"{plan.what_happened} {plan.impact}".strip(),
             f"**Recommended action:** {plan.recommended_action}"]
    if plan.why_this_option:
        parts.append(f"**Why this option:** {plan.why_this_option}")
    if plan.next_steps:
        parts.append("**Next steps:**\n" + "\n".join(f"{i}. {step}" for i, step in enumerate(plan.next_steps, 1)))
    if plan.policy_citations:
        parts.append("**Policy evidence:**\n" + "\n".join(f"[{c}] {titles.get(c, c)}" for c in plan.policy_citations))
    if plan.uncertainty:
        parts.append("**Please note:**\n" + "\n".join(f"- {note}" for note in plan.uncertainty))
    if plan.contact:
        parts.append(f"**Contact:** {plan.contact}")
    return "\n\n".join(parts)
