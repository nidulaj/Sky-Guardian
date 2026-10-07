from app.providers.flight.base import FlightDataProvider
from app.providers.flight.mock import MockFlightProvider
from app.providers.flight.aviationstack import AviationStackFlightProvider
from app.providers.flight.aerodatabox import AeroDataBoxFlightProvider
from app.providers.flight.chain import ChainFlightProvider
from app.providers.flight.cache import FlightCache
from app.providers.flight.settings import flight_settings
from app.config import settings
from typing import Optional

PLACEHOLDER_KEYS = {"", "mock_key"}


def _key(value: Optional[str]) -> Optional[str]:
    value = (value or "").strip()
    return None if value in PLACEHOLDER_KEYS else value


def _cache() -> FlightCache:
    return FlightCache(flight_settings.FLIGHT_CACHE_PATH)


def _aviationstack(cache: Optional[FlightCache] = None) -> FlightDataProvider:
    key = _key(settings.FLIGHT_API_KEY)
    if not key:
        raise ValueError("FLIGHT_PROVIDER=aviationstack requires FLIGHT_API_KEY in backend/.env")
    return AviationStackFlightProvider(api_key=key, cache=cache or _cache())


def _aerodatabox(cache: Optional[FlightCache] = None) -> FlightDataProvider:
    key = _key(flight_settings.AERODATABOX_API_KEY)
    if not key:
        raise ValueError("FLIGHT_PROVIDER=aerodatabox requires AERODATABOX_API_KEY in backend/.env")
    return AeroDataBoxFlightProvider(api_key=key, cache=cache or _cache())


def _auto() -> FlightDataProvider:
    """Real data from every configured provider: AeroDataBox first, AviationStack as fallback and live upgrade."""
    cache = _cache()
    aerodatabox = _aerodatabox(cache) if _key(flight_settings.AERODATABOX_API_KEY) else None
    aviationstack = _aviationstack(cache) if _key(settings.FLIGHT_API_KEY) else None
    providers = [p for p in (aerodatabox, aviationstack) if p]
    if not providers:
        raise ValueError("FLIGHT_PROVIDER=auto needs AERODATABOX_API_KEY and/or FLIGHT_API_KEY in backend/.env")
    return ChainFlightProvider(providers, live_upgrade=aviationstack if aerodatabox else None)


# Registry of available flight data providers; FLIGHT_PROVIDER selects one by name.
PROVIDERS = {
    "mock": MockFlightProvider,
    "aviationstack": _aviationstack,
    "aerodatabox": _aerodatabox,
    "auto": _auto,
}


def get_flight_provider(name: Optional[str] = None) -> FlightDataProvider:
    """Return the configured flight data provider. USE_MOCK_FLIGHTS=true always selects the mock provider."""
    provider_name = "mock" if settings.USE_MOCK_FLIGHTS and name is None else (name or settings.FLIGHT_PROVIDER)
    provider_name = provider_name.lower().strip()

    factory = PROVIDERS.get(provider_name)
    if factory is None:
        raise ValueError(
            f"Unknown FLIGHT_PROVIDER '{provider_name}'. Available providers: {', '.join(sorted(PROVIDERS))}"
        )
    return factory()
