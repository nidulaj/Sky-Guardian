"""
Deterministic weather risk scoring.

score = precipitation group + wind + visibility + official alerts, clamped to 0-100.

Rain, snow/ice and thunderstorms form one correlated "precipitation group": the
strongest of them counts fully and the others are scaled by
weather.precipitation_group_correlation_factor, so a thunderstorm with heavy rain is
not counted as two independent hazards. Missing measurements are never scored as
zero-hazard silently; they are listed in missing_data and reduce confidence.
"""
from typing import Dict, List, Optional

from app.risk.config import RiskConfig, round_half_up
from app.schemas.weather import WeatherAssessment, WeatherFactors, WeatherObservation

_ALERT_RANK = {"advisory": 0, "warning": 1, "severe": 2}


def _precipitation_score(obs: WeatherObservation, cfg: RiskConfig, conditions: List[str]) -> Optional[float]:
    p_cfg = cfg.weather.precipitation
    rate = obs.precipitation_mm_per_hr
    if rate is None:
        return None
    # Precipitation that falls as snow is labelled generically; snow is scored separately.
    noun = "precipitation" if obs.snow_ice not in (None, "NONE") else "rainfall"
    if rate <= 0:
        return 0
    if rate <= p_cfg.light_max_mm_per_hr:
        conditions.append(f"Light {noun} ({rate:g} mm/h)")
        return p_cfg.light_score
    if rate <= p_cfg.moderate_max_mm_per_hr:
        conditions.append(f"Moderate {noun} ({rate:g} mm/h)")
        return p_cfg.moderate_score
    conditions.append(f"Heavy {noun} ({rate:g} mm/h)")
    return p_cfg.heavy_score


def _thunderstorm_score(obs: WeatherObservation, cfg: RiskConfig, conditions: List[str]) -> Optional[float]:
    t_cfg = cfg.weather.thunderstorm
    if obs.thunderstorm is None:
        return None
    if obs.thunderstorm == "ACTIVE":
        conditions.append("Active thunderstorms")
        return t_cfg.active_score
    if obs.thunderstorm == "POSSIBLE":
        conditions.append("Thunderstorms possible")
        return t_cfg.possible_score
    return 0


def _snow_ice_score(obs: WeatherObservation, cfg: RiskConfig, conditions: List[str]) -> Optional[float]:
    s_cfg = cfg.weather.snow_ice
    if obs.snow_ice is None:
        return None
    if obs.snow_ice == "FREEZING":
        conditions.append("Freezing precipitation / icing")
        return s_cfg.freezing_score
    if obs.snow_ice == "HEAVY":
        conditions.append("Heavy snow")
        return s_cfg.heavy_score
    if obs.snow_ice == "LIGHT":
        conditions.append("Light snow")
        return s_cfg.light_score
    return 0


def _wind_score(obs: WeatherObservation, cfg: RiskConfig, conditions: List[str]) -> Optional[float]:
    w_cfg = cfg.weather.wind
    sustained, gust = obs.wind_speed_kt, obs.wind_gust_kt
    if sustained is None and gust is None:
        return None

    parts = []
    if sustained is not None:
        parts.append(f"sustained {sustained:g} kt")
    if gust is not None:
        parts.append(f"gusts {gust:g} kt")
    detail = ", ".join(parts)

    def _reaches(sustained_limit: float, gust_limit: float) -> bool:
        return (sustained is not None and sustained >= sustained_limit) or (gust is not None and gust >= gust_limit)

    if _reaches(w_cfg.severe_sustained_kt, w_cfg.severe_gust_kt):
        conditions.append(f"Severe wind ({detail})")
        return w_cfg.severe_score
    if _reaches(w_cfg.strong_sustained_kt, w_cfg.strong_gust_kt):
        conditions.append(f"Strong wind ({detail})")
        return w_cfg.strong_score
    return 0


def _visibility_score(obs: WeatherObservation, cfg: RiskConfig, conditions: List[str]) -> Optional[float]:
    v_cfg = cfg.weather.visibility
    vis = obs.visibility_km
    if vis is None:
        return None
    if vis < v_cfg.very_low_below_km:
        conditions.append(f"Very low visibility ({vis:g} km)")
        return v_cfg.very_low_score
    if vis < v_cfg.reduced_below_km:
        conditions.append(f"Reduced visibility ({vis:g} km)")
        return v_cfg.reduced_score
    return 0


def _alert_score(obs: WeatherObservation, cfg: RiskConfig, conditions: List[str]) -> Optional[float]:
    a_cfg = cfg.weather.alerts
    if obs.alerts is None:
        return None
    if not obs.alerts:
        return 0
    for alert in obs.alerts:
        conditions.append(f"Weather alert: {alert.event} ({alert.severity})")
    worst = max(obs.alerts, key=lambda a: _ALERT_RANK[a.severity]).severity
    return {"advisory": a_cfg.advisory_score, "warning": a_cfg.warning_score, "severe": a_cfg.severe_score}[worst]


def _lead_time_factor(obs: WeatherObservation, cfg: RiskConfig) -> float:
    if obs.forecast_time is None or obs.forecast_time.tzinfo is None or obs.retrieved_at.tzinfo is None:
        return 1.0
    hours_ahead = (obs.forecast_time - obs.retrieved_at).total_seconds() / 3600
    factor = 1.0
    for rule in sorted(cfg.weather.lead_time_factors, key=lambda r: r.beyond_hours):
        if hours_ahead > rule.beyond_hours:
            factor = rule.factor
    return factor


def score_weather(obs: WeatherObservation, cfg: RiskConfig) -> WeatherAssessment:
    conditions: List[str] = []
    raw: Dict[str, Optional[float]] = {
        "precipitation": _precipitation_score(obs, cfg, conditions),
        "thunderstorm": _thunderstorm_score(obs, cfg, conditions),
        "snow_ice": _snow_ice_score(obs, cfg, conditions),
        "wind": _wind_score(obs, cfg, conditions),
        "visibility": _visibility_score(obs, cfg, conditions),
        "alerts": _alert_score(obs, cfg, conditions),
    }
    missing = [name for name, value in raw.items() if value is None]
    known = {name: value for name, value in raw.items() if value is not None}

    factors = WeatherFactors(
        rain=(raw["precipitation"] or 0) >= cfg.weather.precipitation.moderate_score and obs.snow_ice in (None, "NONE"),
        strong_wind=(raw["wind"] or 0) > 0,
        thunderstorm=obs.thunderstorm in ("POSSIBLE", "ACTIVE"),
        low_visibility=(raw["visibility"] or 0) > 0,
        snow_ice=obs.snow_ice in ("LIGHT", "HEAVY", "FREEZING"),
        severe_alert=any(a.severity in ("warning", "severe") for a in (obs.alerts or [])),
    )

    warnings: List[str] = []
    if obs.is_mock:
        warnings.append(f"Weather for {obs.airport} is mock/demo data, not a live forecast.")

    if not known:
        return WeatherAssessment(
            score=None,
            level=None,
            conditions=[],
            factors=factors,
            component_scores={},
            missing_data=[f"weather.{name}" for name in missing],
            confidence=0.0,
            warnings=warnings + [f"No usable weather measurements for {obs.airport}."],
        )

    group = [known[name] for name in ("precipitation", "thunderstorm", "snow_ice") if name in known]
    group_score = 0.0
    if group:
        strongest = max(group)
        group_score = strongest + cfg.weather.precipitation_group_correlation_factor * (sum(group) - strongest)

    total = group_score + known.get("wind", 0) + known.get("visibility", 0) + known.get("alerts", 0)
    score = max(0, min(100, round_half_up(total)))

    confidence = cfg.weather.base_confidence - cfg.weather.missing_field_confidence_penalty * len(missing)
    if obs.is_mock:
        confidence *= cfg.confidence.mock_data_factor
    confidence *= _lead_time_factor(obs, cfg)
    confidence = round(max(0.0, min(1.0, confidence)), 2)

    component_scores = {name: float(value) for name, value in known.items()}
    component_scores["precipitation_group"] = round(group_score, 2)

    if not conditions:
        conditions.append(obs.condition_text or "No significant weather hazards reported")

    return WeatherAssessment(
        score=score,
        level=cfg.levels.level_for(score),
        conditions=conditions,
        factors=factors,
        component_scores=component_scores,
        missing_data=[f"weather.{name}" for name in missing],
        confidence=confidence,
        warnings=warnings,
    )
