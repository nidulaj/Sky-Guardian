from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[3]


class FlightSettings(BaseSettings):
    """Flight-provider settings, read from the same backend/.env as app.config (extra keys are ignored there)."""
    FLIGHT_CACHE_PATH: str = str(BACKEND_DIR / "data" / "flight_cache.sqlite3")
    # AviationStack free plan: 100 requests per month. Calls stop at (quota - reserve).
    FLIGHT_MONTHLY_QUOTA: int = 100
    FLIGHT_QUOTA_RESERVE: int = 5
    # Dates within this many days of today use live status; later dates use the published timetable.
    FLIGHT_LIVE_WINDOW_DAYS: int = 1
    FLIGHT_MAX_DAYS_AHEAD: int = 330
    FLIGHT_LIVE_CACHE_SECONDS: int = 300
    FLIGHT_TIMETABLE_CACHE_SECONDS: int = 12 * 3600
    FLIGHT_NOT_FOUND_CACHE_SECONDS: int = 3600

    # AeroDataBox (RapidAPI free Basic plan: 400 units/month, a flight lookup costs 2 units; cache at most 7 days)
    AERODATABOX_API_KEY: str = ""
    AERODATABOX_MONTHLY_UNITS: int = 400
    AERODATABOX_UNITS_RESERVE: int = 10

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


flight_settings = FlightSettings()
