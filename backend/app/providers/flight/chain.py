from app.providers.flight.base import (
    FlightDataProvider, FlightNotFoundError, FlightDataUnavailableError, FlightDateNotCoveredError, FlightProviderError,
)
from app.schemas.flight import FlightResult
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)


class ChainFlightProvider(FlightDataProvider):
    """
    Tries providers in order and returns the first answer.
    - A provider that has no data (not found, date not covered) or fails (unavailable) passes to the next one.
    - If the answer is only a timetable and `live_upgrade` is set, that provider is asked for live status too
      (e.g. AviationStack has live data at airports AeroDataBox doesn't track live, such as CMB).
    When every provider fails, the most informative error is raised: not found > date not covered > unavailable.
    """
    name = "ChainFlightProvider"

    def __init__(self, providers: List[FlightDataProvider], live_upgrade: Optional[FlightDataProvider] = None):
        if not providers:
            raise ValueError("ChainFlightProvider needs at least one provider")
        self.providers = providers
        self.live_upgrade = live_upgrade
        self.name = " → ".join(getattr(p, "name", type(p).__name__) for p in providers)

    async def get_flight_status(self, flight_number: str, travel_date: str, origin: str, destination: str) -> FlightResult:
        errors: List[FlightProviderError] = []
        for provider in self.providers:
            try:
                result = await provider.get_flight_status(flight_number, travel_date, origin, destination)
            except (FlightNotFoundError, FlightDateNotCoveredError, FlightDataUnavailableError) as e:
                logger.info(f"{getattr(provider, 'name', provider)} could not answer {flight_number} {travel_date}: {e}")
                errors.append(e)
                continue
            return await self._maybe_upgrade(result, provider, flight_number, travel_date, origin, destination)

        for kind in (FlightNotFoundError, FlightDateNotCoveredError, FlightDataUnavailableError):
            for error in errors:
                if isinstance(error, kind):
                    raise error
        raise FlightDataUnavailableError("No flight data provider could answer")

    async def _maybe_upgrade(self, result: FlightResult, answered_by: FlightDataProvider,
                             flight_number: str, travel_date: str, origin: str, destination: str) -> FlightResult:
        if result.data_mode != "timetable" or self.live_upgrade is None or self.live_upgrade is answered_by:
            return result
        try:
            live = await self.live_upgrade.get_flight_status(flight_number, travel_date, origin, destination)
        except FlightProviderError:
            return result
        return live if live.data_mode == "live" else result
