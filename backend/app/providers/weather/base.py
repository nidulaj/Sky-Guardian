from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional

from app.airports import Airport
from app.schemas.weather import WeatherObservation


class WeatherProviderError(Exception):
    """
    Weather data could not be retrieved or used.

    The message is shown to users and the Risk Agent as a warning, so it must not
    contain stack traces, URLs with credentials or raw provider payloads.
    """


class ForecastTimeUnavailable(WeatherProviderError):
    """The provider returned data, but not for the requested time."""


class WeatherDataProvider(ABC):
    name: str = "WeatherDataProvider"
    is_mock: bool = False

    @abstractmethod
    async def get_observation(self, airport: Airport, target_time: Optional[datetime] = None) -> WeatherObservation:
        """
        Weather for one airport at the forecast hour nearest target_time (a timezone-aware
        datetime; None means the current hour). Raises WeatherProviderError on failure.
        """
