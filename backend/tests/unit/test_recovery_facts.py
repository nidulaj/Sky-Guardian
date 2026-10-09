from app.agents.recovery_facts import build_fact_sheet
from app.orchestrator.state import JourneyState


def flight(number, origin, destination, status="ON_TIME", delay=0, airline="SriLankan Airlines", data_mode="live", **extra):
    return {"flight_number": number, "origin": origin, "destination": destination, "status": status,
            "delay_minutes": delay, "airline": airline, "data_mode": data_mode,
            "scheduled_departure": "2026-09-15T10:00:00+05:30", "scheduled_arrival": "2026-09-15T15:30:00+08:00", **extra}


def connection(airport, status, available=30, required=60, codes=("BELOW_MINIMUM_CONNECTION_TIME",), inbound="UL001", outbound="XX123"):
    return {"airport": airport, "status": status, "available_connection_minutes": available,
            "minimum_required_minutes": required, "buffer_minutes": available - required,
            "reason_codes": list(codes), "inbound_flight": inbound, "outbound_flight": outbound, "connection_index": 0}


def demo_state(**overrides):
    fields = dict(
        origin="CMB", destination="NRT", preferred_language="en",
        flight_results=[flight("UL001", "CMB", "KUL", "DELAYED", 90),
                        flight("XX123", "KUL", "NRT", airline="Malaysia Airlines")],
        connection_results=[connection("KUL", "LIKELY_MISSED")],
        risk_analysis={"score": 73, "level": "HIGH", "missing_data": [],
                       "top_factors": [{"factor": "Connection likely missed"}, {"factor": "Flight delay"}]},
    )
    return JourneyState(**{**fields, **overrides})


def test_disrupted_leg_and_carrier_come_from_flight_data():
    facts = build_fact_sheet(demo_state(), risk_threshold=60)
    assert facts.disrupted_flight.flight_number == "UL001"
    assert facts.carrier_to_contact == "SriLankan Airlines"
    assert facts.connection_at_risk and facts.risk_above_threshold
    assert facts.risk.top_factors == ["Connection likely missed", "Flight delay"]
    assert facts.risk.is_probability is False


def test_cancelled_leg_is_the_disrupted_flight_even_if_another_is_delayed():
    state = demo_state(flight_results=[flight("UL001", "CMB", "KUL", "DELAYED", 30),
                                       flight("XX123", "KUL", "NRT", "CANCELLED", airline="Malaysia Airlines")])
    facts = build_fact_sheet(state, risk_threshold=60)
    assert facts.disrupted_flight.flight_number == "XX123"
    assert facts.carrier_to_contact == "Malaysia Airlines"
    assert facts.disrupted_flight.delay_minutes is None  # cancelled: no delay figure


def test_worst_connection_is_primary_across_all_connections():
    state = demo_state(connection_results=[connection("SIN", "SAFE", 120, 60, ("SUFFICIENT_TRANSFER_TIME",)),
                                           connection("KUL", "MISSED", -10, 60, ("NEGATIVE_CONNECTION_WINDOW",))])
    facts = build_fact_sheet(state, risk_threshold=60)
    assert len(facts.connections) == 2
    assert facts.primary_connection.airport == "KUL" and facts.primary_connection.status == "MISSED"


def test_unmeasured_connection_and_delay_stay_unknown_not_zero():
    state = demo_state(
        flight_results=[flight("UL001", "CMB", "KUL", "UNKNOWN", 0, data_mode="none")],
        connection_results=[{"airport": "KUL", "status": "UNKNOWN", "minimum_required_minutes": 60,
                             "available_connection_minutes": 0, "buffer_minutes": 0, "reason_codes": ["MISSING_TIMING_DATA"]}],
        risk_analysis={"score": None, "level": "UNKNOWN", "missing_data": ["flight", "weather"]},
    )
    facts = build_fact_sheet(state, risk_threshold=60)
    assert facts.flights[0].delay_minutes is None
    assert facts.primary_connection.available_minutes is None and facts.primary_connection.buffer_minutes is None
    assert facts.primary_connection.required_minutes == 60
    assert facts.risk.score is None and facts.risk.level == "UNKNOWN"
    assert not facts.risk_above_threshold


def test_policies_are_numbered_trimmed_and_unverified_by_default():
    state = demo_state(policy_evidence=[
        {"title": "CoC", "airline": "SriLankan Airlines", "snippet": "x" * 2000, "verified": True},
        {"title": "Paraphrase", "snippet": "Short text"},
    ])
    facts = build_fact_sheet(state, risk_threshold=60)
    assert facts.policy_ids == ["P1", "P2"]
    assert len(facts.policies[0].snippet) == 600 and facts.policies[0].verified is True
    assert facts.policies[1].verified is False


def test_options_keep_price_and_seats_unknown():
    options = [{"route_summary": f"Route {i}", "data_mode": "demo", "price": "UNKNOWN",
                "availability_status": "UNKNOWN", "ranking_reasons": ["a", "b", "c", "d"]} for i in range(4)]
    facts = build_fact_sheet(demo_state(alternative_options=options, recommended_option=options[0]), risk_threshold=60)
    assert facts.recommended_option.route_summary == "Route 0"
    assert [o.route_summary for o in facts.other_options] == ["Route 1", "Route 2"]
    assert facts.recommended_option.price == facts.recommended_option.seat_availability == "UNKNOWN"
    assert len(facts.recommended_option.ranking_reasons) == 3
    assert facts.is_demo_data is True


def test_language_and_weather_wording():
    state = demo_state(preferred_language="si", weather_results=[
        {"airport": "KUL", "status": "available", "weather_risk": "HIGH", "conditions": ["Active thunderstorms"]},
        {"airport": "NRT", "status": "unavailable"},
    ])
    facts = build_fact_sheet(state, risk_threshold=60)
    assert (facts.language, facts.language_name) == ("si", "Sinhala")
    assert [w.airport for w in facts.weather] == ["KUL"]
    assert "not confirmed as the cause" in facts.weather[0].note


def test_single_leg_has_no_connection():
    facts = build_fact_sheet(JourneyState(flight_results=[flight("UL504", "CMB", "LHR", "CANCELLED")]), risk_threshold=60)
    assert facts.primary_connection is None and facts.connections == []
    assert facts.cancelled_flights[0].flight_number == "UL504"
    assert (facts.origin, facts.destination) == ("CMB", "LHR")
