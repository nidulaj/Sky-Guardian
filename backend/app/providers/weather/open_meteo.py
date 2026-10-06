"""
Open-Meteo forecast provider (https://open-meteo.com). No API key is needed.

One request per airport returns the hourly forecast; it is cached for
cache_ttl_seconds so a journey with several flights through the same airport, or
repeated Home page refreshes, do not each call Open-Meteo.
"""
import logging
import math
import ssl
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

import httpx
from pydantic import ValidationError

from app.airports import Airport
from app.providers.weather.base import ForecastTimeUnavailable, WeatherDataProvider, WeatherProviderError
from app.providers.weather.weather_codes import describe_weather_code, snow_ice_state, thunderstorm_state
from app.schemas.weather import WeatherObservation

logger = logging.getLogger(__name__)

DEFAULT_BASE_URL = "https://api.open-meteo.com/v1/forecast"

HOURLY_VARIABLES = [
    "temperature_2m",
    "precipitation",
    "weather_code",
    "visibility",
    "wind_speed_10m",
    "wind_gusts_10m",
]

# Open-Meteo's maximum forecast range.
FORECAST_DAYS = 16
# A target time further than this from the nearest forecast hour is outside the forecast.
MAX_HOUR_DISTANCE = timedelta(minutes=90)


def _system_ssl_context():
    """
    Verify TLS against the operating system's certificate store when truststore is
    installed. Networks that inspect HTTPS (e.g. office proxies) re-sign traffic with a
    certificate the OS trusts but Python's bundled certifi list does not.
    """
    try:
        import truststore
    except ImportError:
        return True
    return truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)


@dataclass(frozen=True)
class _HourlyForecast:
    times: List[datetime]  # timezone-aware, airport local time
    values: Dict[str, List[Any]]


class OpenMeteoWeatherProvider(WeatherDataProvider):
    name = "Open-Meteo"
    is_mock = False

    def __init__(
        self,
        base_url: str = DEFAULT_BASE_URL,
        timeout_seconds: float = 8.0,
        cache_ttl_seconds: float = 600,
        transport: Optional[httpx.AsyncBaseTransport] = None,
    ):
        self.base_url = base_url
        self.timeout_seconds = timeout_seconds
        self.cache_ttl_seconds = cache_ttl_seconds
        self._transport = transport  # injectable for tests
        self._verify = _system_ssl_context()
        self._cache: Dict[str, Tuple[float, datetime, _HourlyForecast]] = {}

    async def get_observation(self, airport: Airport, target_time: Optional[datetime] = None) -> WeatherObservation:
        retrieved_at, forecast = await self._get_forecast(airport)
        target = target_time or datetime.now(timezone.utc)
        if target.tzinfo is None:
            raise ForecastTimeUnavailable("Forecast time must include a timezone offset.")

        index = self._nearest_hour(forecast.times, target)
        if index is None:
            local = target.astimezone(forecast.times[0].tzinfo).strftime("%Y-%m-%d %H:%M")
            if target < forecast.times[0]:
                detail = "is in the past"
            else:
                detail = f"is beyond the {FORECAST_DAYS}-day forecast range"
            raise ForecastTimeUnavailable(
                f"Forecast unavailable for selected travel date: {local} local time at {airport.code} {detail}."
            )
        return self._to_observation(airport, forecast, index, retrieved_at)

    async def _get_forecast(self, airport: Airport) -> Tuple[datetime, _HourlyForecast]:
        cached = self._cache.get(airport.code)
        if cached and time.monotonic() - cached[0] < self.cache_ttl_seconds:
            return cached[1], cached[2]

        payload = await self._fetch(airport)
        forecast = self._parse(airport, payload)
        retrieved_at = datetime.now(timezone.utc)
        self._cache[airport.code] = (time.monotonic(), retrieved_at, forecast)
        return retrieved_at, forecast

    async def _fetch(self, airport: Airport) -> Dict[str, Any]:
        params = {
            "latitude": airport.latitude,
            "longitude": airport.longitude,
            "hourly": ",".join(HOURLY_VARIABLES),
            "timezone": "auto",
            "timeformat": "iso8601",
            "forecast_days": FORECAST_DAYS,
            "temperature_unit": "celsius",
            "wind_speed_unit": "kn",
            "precipitation_unit": "mm",
        }
        try:
            async with httpx.AsyncClient(
                timeout=self.timeout_seconds, transport=self._transport, verify=self._verify
            ) as client:
                response = await client.get(self.base_url, params=params)
        except httpx.TimeoutException:
            logger.warning("Open-Meteo request timed out for %s", airport.code)
            raise WeatherProviderError(f"Open-Meteo did not respond in time for {airport.code}.") from None
        except httpx.HTTPError as exc:
            logger.warning("Open-Meteo request failed for %s: %s", airport.code, exc.__class__.__name__)
            raise WeatherProviderError(f"Could not reach Open-Meteo for {airport.code}.") from None

        if response.status_code != 200:
            logger.warning("Open-Meteo returned HTTP %s for %s", response.status_code, airport.code)
            raise WeatherProviderError(f"Open-Meteo returned an error (HTTP {response.status_code}) for {airport.code}.")
        try:
            payload = response.json()
        except ValueError:
            raise WeatherProviderError(f"Open-Meteo returned an invalid response for {airport.code}.") from None
        if not isinstance(payload, dict):
            raise WeatherProviderError(f"Open-Meteo returned an invalid response for {airport.code}.")
        return payload

    @staticmethod
    def _parse(airport: Airport, payload: Dict[str, Any]) -> _HourlyForecast:
        invalid = WeatherProviderError(f"Open-Meteo returned an invalid response for {airport.code}.")
        hourly = payload.get("hourly")
        offset_seconds = payload.get("utc_offset_seconds")
        if not isinstance(hourly, dict) or not isinstance(offset_seconds, int) or isinstance(offset_seconds, bool):
            raise invalid

        raw_times = hourly.get("time")
        if not isinstance(raw_times, list) or not raw_times:
            raise WeatherProviderError(f"Open-Meteo returned no hourly forecast for {airport.code}.")

        # With timezone=auto, times are local wall-clock times without an offset;
        # utc_offset_seconds gives the offset for the whole response.
        tz = timezone(timedelta(seconds=offset_seconds))
        try:
            times = [datetime.fromisoformat(t).replace(tzinfo=tz) for t in raw_times]
        except (TypeError, ValueError):
            raise invalid from None

        values: Dict[str, List[Any]] = {}
        for var in HOURLY_VARIABLES:
            series = hourly.get(var)
            if series is None:
                # A missing variable becomes missing data, not a failed request.
                series = [None] * len(times)
            if not isinstance(series, list) or len(series) != len(times):
                raise invalid
            values[var] = series
        return _HourlyForecast(times=times, values=values)

    @staticmethod
    def _nearest_hour(times: List[datetime], target: datetime) -> Optional[int]:
        best = min(range(len(times)), key=lambda i: abs(times[i] - target))
        if abs(times[best] - target) > MAX_HOUR_DISTANCE:
            return None
        return best

    def _to_observation(
        self, airport: Airport, forecast: _HourlyForecast, index: int, retrieved_at: datetime
    ) -> WeatherObservation:
        def value(var: str) -> Optional[float]:
            raw = forecast.values[var][index]
            if raw is None or isinstance(raw, bool) or not isinstance(raw, (int, float)) or not math.isfinite(raw):
                return None
            return float(raw)

        code_value = value("weather_code")
        code = int(code_value) if code_value is not None else None
        visibility_m = value("visibility")
        precipitation = value("precipitation")

        try:
            return WeatherObservation(
                airport=airport.code,
                forecast_time=forecast.times[index],
                condition_text=describe_weather_code(code),
                weather_code=code,
                temperature_c=value("temperature_2m"),
                # Hourly precipitation is the total for the preceding hour, i.e. mm/h.
                precipitation_mm_per_hr=max(0.0, precipitation) if precipitation is not None else None,
                wind_speed_kt=value("wind_speed_10m"),
                wind_gust_kt=value("wind_gusts_10m"),
                # Open-Meteo reports metres; the schema uses km (capped at its 100 km maximum).
                visibility_km=min(100.0, round(max(0.0, visibility_m) / 1000, 2)) if visibility_m is not None else None,
                thunderstorm=thunderstorm_state(code),
                snow_ice=snow_ice_state(code),
                # Open-Meteo's forecast endpoint has no official warnings: unknown, not "none".
                alerts=None,
                source=self.name,
                is_mock=False,
                retrieved_at=retrieved_at,
            )
        except ValidationError:
            logger.warning("Open-Meteo values for %s failed validation", airport.code)
            raise WeatherProviderError(f"Open-Meteo returned out-of-range values for {airport.code}.") from None
