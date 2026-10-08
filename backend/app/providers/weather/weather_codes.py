"""
WMO weather interpretation codes (as returned by Open-Meteo) -> readable conditions
and the hazard states used by WeatherObservation.

This is the only weather-code table in the project; the frontend shows the
condition text the backend sends rather than keeping its own copy.
"""
from typing import Dict, Optional

from app.schemas.weather import SnowIceState, ThunderstormState

WMO_CONDITIONS: Dict[int, str] = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Heavy drizzle",
    56: "Light freezing drizzle",
    57: "Heavy freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snowfall",
    73: "Moderate snowfall",
    75: "Heavy snowfall",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
}

_THUNDERSTORM_CODES = {95, 96, 99}
_FREEZING_CODES = {56, 57, 66, 67}
# Moderate snowfall is grouped with heavy: the scoring has no middle band and
# moderate snow already slows de-icing and runway clearing.
_HEAVY_SNOW_CODES = {73, 75, 86}
_LIGHT_SNOW_CODES = {71, 77, 85}


def describe_weather_code(code: Optional[int]) -> Optional[str]:
    if code is None:
        return None
    return WMO_CONDITIONS.get(code, f"Unknown weather code ({code})")


def thunderstorm_state(code: Optional[int]) -> Optional[ThunderstormState]:
    """None when the code is missing, so scoring records it as missing data."""
    if code is None:
        return None
    return "ACTIVE" if code in _THUNDERSTORM_CODES else "NONE"


def snow_ice_state(code: Optional[int]) -> Optional[SnowIceState]:
    if code is None:
        return None
    if code in _FREEZING_CODES:
        return "FREEZING"
    if code in _HEAVY_SNOW_CODES:
        return "HEAVY"
    if code in _LIGHT_SNOW_CODES:
        return "LIGHT"
    return "NONE"
