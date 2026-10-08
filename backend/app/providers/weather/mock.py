from datetime import datetime, timezone
from typing import Optional

from app.airports import Airport
from app.providers.weather.base import WeatherDataProvider
from app.providers.weather.weather_codes import describe_weather_code, snow_ice_state, thunderstorm_state
from app.schemas.weather import WeatherAlert, WeatherObservation


class MockWeatherProvider(WeatherDataProvider):
    """
    Deterministic demo weather, used by default and in tests.

    Demo scenario (CMB -> KUL -> NRT): KUL has thunderstorms with heavy rain and an
    advisory, which the existing weather scoring rates 60/100; NRT/HND are clear;
    every other airport is partly cloudy and dry.
    """
    name = "MockWeatherProvider"
    is_mock = True

    async def get_observation(self, airport: Airport, target_time: Optional[datetime] = None) -> WeatherObservation:
        now = datetime.now(timezone.utc)
        forecast_time = (target_time or now).replace(minute=0, second=0, microsecond=0)

        if airport.code == "KUL":
            code, values = 95, dict(
                temperature_c=27.0, precipitation_mm_per_hr=8.0, wind_speed_kt=12.0, wind_gust_kt=22.0,
                visibility_km=6.0,
                alerts=[WeatherAlert(event="Thunderstorm advisory", severity="advisory")],
            )
        elif airport.code in ("NRT", "HND"):
            code, values = 0, dict(
                temperature_c=18.0, precipitation_mm_per_hr=0.0, wind_speed_kt=8.0, wind_gust_kt=12.0,
                visibility_km=10.0, alerts=[],
            )
        else:
            code, values = 2, dict(
                temperature_c=28.0, precipitation_mm_per_hr=0.0, wind_speed_kt=9.0, wind_gust_kt=14.0,
                visibility_km=10.0, alerts=[],
            )

        return WeatherObservation(
            airport=airport.code,
            forecast_time=forecast_time,
            condition_text=describe_weather_code(code),
            weather_code=code,
            thunderstorm=thunderstorm_state(code),
            snow_ice=snow_ice_state(code),
            source=self.name,
            is_mock=True,
            retrieved_at=now,
            **values,
        )
