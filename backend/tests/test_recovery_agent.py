"""Recovery Agent: deterministic template branches, and (below) the grounded LLM path."""
import re

import pytest

from app.agents.recovery_agent import RecoveryAgent
from app.orchestrator.state import JourneyState


def flight(number, origin, destination, status="ON_TIME", delay=0, airline="SriLankan Airlines", data_mode="live"):
    return {"flight_number": number, "origin": origin, "destination": destination, "status": status,
            "delay_minutes": delay, "airline": airline, "data_mode": data_mode}


def connection(airport, status, available, required=60, codes=("BELOW_MINIMUM_CONNECTION_TIME",), inbound="UL001"):
    return {"airport": airport, "status": status, "available_connection_minutes": available,
            "minimum_required_minutes": required, "buffer_minutes": available - required,
            "reason_codes": list(codes), "inbound_flight": inbound, "connection_index": 0}


def demo_state(**overrides):
    fields = dict(
        origin="CMB", destination="NRT",
        flight_results=[flight("UL001", "CMB", "KUL", "DELAYED", 90),
                        flight("XX123", "KUL", "NRT", airline="Malaysia Airlines")],
        connection_results=[connection("KUL", "LIKELY_MISSED", 30)],
        risk_analysis={"score": 73, "level": "HIGH"},
        policy_evidence=[{"title": "Connection Protection", "airline": "SriLankan Airlines",
                          "snippet": "Rebooking on the next available flight.", "verified": True}],
        recovery_triggered=True, recovery_reasons=["CONNECTION_AT_RISK", "RISK_ABOVE_THRESHOLD"],
    )
    return JourneyState(**{**fields, **overrides})


async def recover(state, provider=None):
    result = await RecoveryAgent(llm_provider=provider).execute(state)
    return state, result


@pytest.mark.asyncio
async def test_connection_at_risk_uses_carrier_from_flight_data():
    state, result = await recover(demo_state())
    text = state.recommendation_text
    assert "UL001 from CMB to KUL is currently delayed by 90 minutes" in text
    assert "estimated at 30 minutes" in text and "minimum required connection time of 60 minutes" in text
    assert "**LIKELY MISSED**" in text and "73/100 (HIGH RISK)" in text
    assert "SriLankan Airlines transit transfer desk upon arrival at KUL" in text
    assert "No feasible alternative was verified" in text
    assert state.recovery_plan["policy_citations"] == ["P1"]
    assert "[P1] Connection Protection (SriLankan Airlines)" in text
    assert state.recommendation_mode == "template" and result.data["generation_mode"] == "template"


@pytest.mark.asyncio
async def test_carrier_is_not_hard_coded():
    state = demo_state(flight_results=[flight("SQ638", "SIN", "NRT", "DELAYED", 120, airline="Singapore Airlines"),
                                       flight("JL001", "NRT", "HND", airline="JAL")],
                       connection_results=[connection("NRT", "MISSED", -20, codes=("NEGATIVE_CONNECTION_WINDOW",), inbound="SQ638")],
                       policy_evidence=[])
    state, _ = await recover(state)
    assert "Singapore Airlines" in state.recommendation_text
    assert "SriLankan" not in state.recommendation_text and "Malaysia" not in state.recommendation_text


@pytest.mark.asyncio
async def test_unknown_connection_window_never_shows_zero_minutes():
    unknown = {"airport": "KUL", "status": "HIGH_RISK", "available_connection_minutes": 0, "minimum_required_minutes": 60,
               "buffer_minutes": 0, "reason_codes": ["MISSING_TIMING_DATA"], "inbound_flight": "UL001"}
    state, _ = await recover(demo_state(connection_results=[unknown]))
    assert not re.search(r"\b0 minutes", state.recommendation_text)
    assert "connection time at KUL could not be calculated" in state.recommendation_text


@pytest.mark.asyncio
async def test_cancelled_flight_branch():
    state = JourneyState(flight_results=[flight("UL504", "CMB", "LHR", "CANCELLED")], risk_analysis={"score": 100, "level": "VERY_HIGH"},
                         alternative_options=[{"route_summary": "CMB -> LHR (UL505)", "data_mode": "demo",
                                               "ranking_reasons": ["Direct flight; no onward transfer."]}],
                         recovery_triggered=True)
    state.recommended_option = state.alternative_options[0]
    state, _ = await recover(state)
    plan = state.recovery_plan
    assert plan["headline"] == "Flight UL504 is reported as cancelled"
    assert "DEMO DATA, not bookable" in plan["recommended_action"] and "CMB -> LHR (UL505)" in plan["recommended_action"]
    assert plan["why_this_option"] == "Ranked first because: Direct flight; no onward transfer."
    assert "Policy information could not be verified." in plan["uncertainty"]
    assert not re.search(r"\b0 minutes", state.recommendation_text)


@pytest.mark.asyncio
async def test_unknown_risk_branch():
    state = JourneyState(flight_results=[flight("UL001", "CMB", "KUL", "UNKNOWN", data_mode="none")],
                         risk_analysis={"score": None, "level": "UNKNOWN", "missing_data": ["flight", "weather"]})
    state, _ = await recover(state)
    assert "could not assess the disruption risk" in state.recommendation_text
    assert state.recovery_plan["headline"] == "Disruption risk could not be assessed"


@pytest.mark.asyncio
async def test_single_leg_low_risk_has_no_connection_or_policy_noise():
    state = JourneyState(origin="CMB", destination="SIN", flight_results=[flight("UL306", "CMB", "SIN")],
                         risk_analysis={"score": 4, "level": "LOW"})
    state, _ = await recover(state)
    plan = state.recovery_plan
    assert plan["headline"] == "No critical disruption identified"
    assert plan["impact"] == "This is a direct flight, so there is no connection to miss."
    assert "Policy information could not be verified." not in plan["uncertainty"]


@pytest.mark.asyncio
async def test_multi_connection_reports_the_worst_one():
    state = demo_state(
        flight_results=[flight("UL001", "CMB", "SIN"), flight("SQ638", "SIN", "NRT", "DELAYED", 100, airline="Singapore Airlines"),
                        flight("JL001", "NRT", "HND", airline="JAL")],
        connection_results=[connection("SIN", "SAFE", 120, codes=("SUFFICIENT_TRANSFER_TIME",)),
                            connection("NRT", "LIKELY_MISSED", 25, inbound="SQ638")])
    state, _ = await recover(state)
    assert state.recovery_plan["headline"] == "Your connection at NRT is likely missed"
    assert "Singapore Airlines transit transfer desk upon arrival at NRT" in state.recommendation_text


@pytest.mark.asyncio
async def test_passenger_request_on_safe_journey_describes_alternatives():
    state = JourneyState(origin="CMB", destination="NRT", flight_results=[flight("UL306", "CMB", "SIN"), flight("SQ638", "SIN", "NRT")],
                         connection_results=[connection("SIN", "SAFE", 120, codes=("SUFFICIENT_TRANSFER_TIME",))],
                         risk_analysis={"score": 4, "level": "LOW"}, alternatives_requested=True, recovery_triggered=True)
    state, _ = await recover(state)
    assert "No feasible alternative was verified" in state.recovery_plan["recommended_action"]
    assert "remains sufficient: an estimated 120 minutes against a 60-minute minimum" in state.recovery_plan["impact"]
