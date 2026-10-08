import hashlib
from collections import Counter
from datetime import datetime

from app.agents.connection_agent import ConnectionAgent
from app.agents.risk_agent import RiskAgent
from app.providers.airports import get_airport
from app.orchestrator.state import JourneyState
from app.ranking.config import RankingConfig
from app.ranking.filters import aware_time, candidate_times, reject_reason
from app.ranking.scoring import score_option
from app.schemas.alternative import AlternativeOption, AlternativeSearchRequest, AlternativeSearchResult


async def rank_alternatives(result: AlternativeSearchResult, query: AlternativeSearchRequest,
                            config: RankingConfig, now: datetime) -> tuple[list[AlternativeOption], dict[str, int]]:
    options, rejected, seen = [], Counter(), set()
    for candidate in result.candidates[:config.max_candidates]:
        reason = reject_reason(candidate, query, config, now)
        if reason:
            rejected[reason] += 1
            continue
        times = candidate_times(candidate)
        signature = "|".join(f"{leg.flight_number}:{leg.origin}:{leg.destination}:{dep.isoformat()}:{arr.isoformat()}"
                             for leg, (dep, arr) in zip(candidate.legs, times))
        if signature in seen:
            rejected["DUPLICATE"] += 1
            continue
        seen.add(signature)
        snapshot = JourneyState(journey_legs=[leg.model_dump() for leg in candidate.legs],
                                flight_results=[leg.model_dump() for leg in candidate.legs])
        await ConnectionAgent(default_mct_minutes=config.minimum_connection_minutes).execute(snapshot)
        # Original-trip weather is not a forecast for a different route/departure time.
        await RiskAgent().execute(snapshot)
        risk = snapshot.risk_analysis or {}
        modes = {leg.data_mode for leg in candidate.legs}
        mode = "demo" if "demo" in modes else "timetable" if "timetable" in modes else "live"
        warnings = ["Seat availability, fare and ticket-specific rebooking eligibility have not been verified.",
                    "Connection minimums are configured prototype values; confirm terminal, immigration and baggage requirements with the airline.",
                    "Alternative-time weather was not retrieved; disruption risk has reduced confidence."]
        if mode == "demo":
            warnings.insert(0, "DEMO DATA: these sample schedules are not real, bookable flights.")
        warnings.extend(risk.get("uncertainty", []))
        for leg in candidate.legs:
            for side, code in (("origin", leg.origin), ("destination", leg.destination)):
                airport = get_airport(code)
                if airport:
                    setattr(leg, f"{side}_timezone", airport.timezone)
                    setattr(leg, f"{side}_city", airport.city)
        option = AlternativeOption(
            option_id="alt-" + hashlib.sha256(signature.encode()).hexdigest()[:12],
            route_summary=" -> ".join([query.origin] + [f"{leg.destination} ({leg.flight_number})" for leg in candidate.legs]),
            legs=candidate.legs, departure=times[0][0].isoformat(), arrival=times[-1][1].isoformat(),
            duration_minutes=int((times[-1][1] - times[0][0]).total_seconds() // 60), connections=len(candidate.legs) - 1,
            connection_safety=snapshot.connection_results, risk_score=risk.get("score"), risk_level=risk.get("level", "UNKNOWN"),
            risk_confidence=risk.get("confidence_label") or "unknown", risk_missing_data=risk.get("missing_data", []),
            ranking_config_version=config.version, warnings=list(dict.fromkeys(warnings)), data_mode=mode,
            retrieved_at=min(aware_time(leg.retrieved_at) for leg in candidate.legs).isoformat(),
            sources=[{"name": leg.source, "type": "Alternative flight schedule", "verified": leg.data_mode != "demo"}
                     for leg in candidate.legs],
        )
        options.append(score_option(option, config, query.earliest_departure))
    options.sort(key=lambda option: (-option.ranking_score, option.arrival, option.departure, option.option_id))
    for rank, option in enumerate(options, 1):
        option.rank = rank
    return options[:config.max_results], dict(rejected)
