from functools import lru_cache
from typing import Optional

from app.providers.weather.base import ForecastTimeUnavailable, WeatherDataProvider, WeatherProviderError
from app.providers.weather.mock import MockWeatherProvider
from app.providers.weather.open_meteo import OpenMeteoWeatherProvider

_ALIASES = {
    "mock": "mock",
    "open_meteo": "open_meteo",
    "open-meteo": "open_meteo",
    "openmeteo": "open_meteo",
}


@lru_cache(maxsize=None)
def _build_provider(key: str) -> WeatherDataProvider:
    if key == "open_meteo":
        from app.config import settings
        return OpenMeteoWeatherProvider(
            base_url=settings.OPEN_METEO_BASE_URL,
            timeout_seconds=settings.WEATHER_TIMEOUT_SECONDS,
            cache_ttl_seconds=settings.WEATHER_CACHE_TTL_SECONDS,
        )
    return MockWeatherProvider()


def get_weather_provider(name: Optional[str] = None) -> WeatherDataProvider:
    """
    Provider selected by WEATHER_PROVIDER (or `name`). Instances are shared so the
    Open-Meteo response cache is reused by the journey workflow and the weather API.
    An unknown name fails fast rather than silently falling back to mock data.
    """
    if name is None:
        from app.config import settings
        name = settings.WEATHER_PROVIDER
    key = _ALIASES.get((name or "").strip().lower())
    if key is None:
        raise ValueError(f"Unsupported WEATHER_PROVIDER {name!r}; expected one of: mock, open_meteo")
    return _build_provider(key)


__all__ = [
    "ForecastTimeUnavailable",
    "MockWeatherProvider",
    "OpenMeteoWeatherProvider",
    "WeatherDataProvider",
    "WeatherProviderError",
    "get_weather_provider",
]
