from app.providers.flight.base import FlightDataProvider
from app.providers.flight.mock import MockFlightProvider
from app.providers.flight.aviationstack import AviationStackFlightProvider
from app.providers.flight.cache import FlightCache
from app.providers.flight.settings import flight_settings
from app.config import settings
from typing import Optional

PLACEHOLDER_KEYS = {"", "mock_key"}


def _aviationstack() -> FlightDataProvider:
    key = (settings.FLIGHT_API_KEY or "").strip()
    if key in PLACEHOLDER_KEYS:
        raise ValueError("FLIGHT_PROVIDER=aviationstack requires FLIGHT_API_KEY in backend/.env")
    return AviationStackFlightProvider(api_key=key, cache=FlightCache(flight_settings.FLIGHT_CACHE_PATH))


# Registry of available flight data providers; FLIGHT_PROVIDER selects one by name.
PROVIDERS = {
    "mock": MockFlightProvider,
    "aviationstack": _aviationstack,
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
