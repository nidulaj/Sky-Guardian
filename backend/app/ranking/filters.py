from datetime import datetime, timedelta, timezone

from app.agents.connection_agent import _expected_time, evaluate_connection
from app.ranking.config import RankingConfig
from app.schemas.alternative import AlternativeCandidate, AlternativeSearchRequest


def aware_time(value: str | None) -> datetime:
    if not value:
        raise ValueError("missing timestamp")
    result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if result.utcoffset() is None:
        raise ValueError("timestamp timezone is missing")
    return result.astimezone(timezone.utc)


def candidate_times(candidate: AlternativeCandidate):
    return [(aware_time(_expected_time(leg.model_dump(), "departure")[0]),
             aware_time(_expected_time(leg.model_dump(), "arrival")[0])) for leg in candidate.legs]


def verified_expected_time(flight: dict, kind: str) -> datetime:
    if "TIMEZONE_UNVERIFIED" in flight.get("reason_codes", []):
        raise ValueError("unverified timezone")
    for field in (f"actual_{kind}", f"estimated_{kind}", f"scheduled_{kind}"):
        if flight.get(field):
            aware_time(flight[field])
            break
    return aware_time(_expected_time(flight, kind)[0])


def reject_reason(candidate: AlternativeCandidate, query: AlternativeSearchRequest, config: RankingConfig, now: datetime) -> str | None:
    legs = candidate.legs
    if legs[0].origin != query.origin or legs[-1].destination != query.destination:
        return "ROUTE_MISMATCH"
    if len(legs) - 1 > config.max_stops:
        return "TOO_MANY_STOPS"
    if any(l.status in {"CANCELLED", "DIVERTED", "DEPARTED", "LANDED", "UNKNOWN"} or l.actual_departure for l in legs):
        return "FLIGHT_NOT_BOARDABLE"
    if any(l.data_mode == "none" or not l.source or "TIMEZONE_UNVERIFIED" in l.reason_codes for l in legs):
        return "UNVERIFIED_SCHEDULE"
    try:
        for leg in legs:
            for field in ("scheduled_departure", "scheduled_arrival", "estimated_departure", "estimated_arrival"):
                if getattr(leg, field):
                    aware_time(getattr(leg, field))
            age = (now - aware_time(leg.retrieved_at)).total_seconds()
            if age > config.max_snapshot_age_seconds or age < -60:
                return "STALE_SCHEDULE"
        times = candidate_times(candidate)
    except (ValueError, TypeError, OverflowError):
        return "INVALID_TIMING"
    if any(arr <= dep for dep, arr in times):
        return "INVALID_TIMING"
    if times[0][0] < max(now, query.earliest_departure) or times[0][0] > query.latest_departure:
        return "OUTSIDE_DEPARTURE_WINDOW"
    if times[-1][1] - times[0][0] > timedelta(minutes=config.max_duration_minutes):
        return "EXCESSIVE_DURATION"
    airports = [legs[0].origin] + [l.destination for l in legs]
    if len(set(airports)) != len(airports):
        return "ROUTE_LOOP"
    for inbound, outbound in zip(legs, legs[1:]):
        if inbound.destination != outbound.origin:
            return "AIRPORT_MISMATCH"
        connection = evaluate_connection(inbound.model_dump(), outbound.model_dump(), config.minimum_connection_minutes)
        if connection.status == "UNKNOWN" or connection.buffer_minutes < config.minimum_connection_margin_minutes:
            return "INSUFFICIENT_CONNECTION"
    return None
