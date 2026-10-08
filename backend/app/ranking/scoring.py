from app.ranking.config import RankingConfig
from app.ranking.filters import aware_time
from app.schemas.alternative import AlternativeOption


def score_option(option: AlternativeOption, config: RankingConfig, earliest_departure) -> AlternativeOption:
    buffers = [connection["buffer_minutes"] for connection in option.connection_safety]
    arrival_minutes = (aware_time(option.arrival) - earliest_departure).total_seconds() / 60
    factors = {
        "disruption_risk": 0 if option.risk_score is None else (100 - option.risk_score) / 100,
        "travel_duration": max(0, 1 - option.duration_minutes / config.max_duration_minutes),
        "arrival_quality": max(0, 1 - arrival_minutes / (config.search_window_hours * 60 + config.max_duration_minutes)),
        "stops": 1 if not option.connections else 0,
        "connection_safety": 1 if not buffers else min(1, min(buffers) / config.target_connection_buffer_minutes),
    }
    option.ranking_factors = {key: round(value, 6) for key, value in factors.items()}
    option.ranking_weights = dict(config.weights)
    option.ranking_score = round(100 * sum(factors[key] * weight for key, weight in config.weights.items()), 2)
    option.ranking_reasons = [
        "Direct flight; no onward transfer." if not buffers else f"Minimum transfer buffer: {min(buffers)} minutes above the configured connection minimum.",
        f"Total itinerary duration: {option.duration_minutes} minutes.",
        f"Arrival is {int(arrival_minutes)} minutes after the earliest feasible departure.",
        f"Estimated disruption score: {option.risk_score}/100; not a probability." if option.risk_score is not None else "Disruption risk could not be assessed; no risk-quality bonus applied.",
        "Price, seat availability and ticket-specific rebooking eligibility are unknown and do not receive a ranking bonus.",
    ]
    return option
