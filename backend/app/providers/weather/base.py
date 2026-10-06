from abc import ABC, abstractmethod
from datetime import datetime, timedelta, timezone
from typing import List, Optional

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

    async def get_hourly_observations(
        self, airport: Airport, start_time: Optional[datetime] = None, hours: int = 12
    ) -> List[WeatherObservation]:
        """
        Consecutive hourly observations starting at the hour nearest start_time. Providers
        with a native hourly series override this; the default asks hour by hour and
        stops at the end of the available forecast.
        """
        start = (start_time or datetime.now(timezone.utc)).replace(minute=0, second=0, microsecond=0)
        observations: List[WeatherObservation] = []
        for h in range(hours):
            try:
                observations.append(await self.get_observation(airport, start + timedelta(hours=h)))
            except ForecastTimeUnavailable:
                if not observations:
                    raise
                break
        return observations
