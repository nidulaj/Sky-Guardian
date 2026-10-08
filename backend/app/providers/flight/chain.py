from app.providers.flight.base import (
    FlightDataProvider, FlightNotFoundError, FlightDataUnavailableError, FlightDateNotCoveredError, FlightProviderError,
)
from app.schemas.flight import FlightResult, parse_flight_time
from typing import List, Optional
import asyncio
import logging
import time

logger = logging.getLogger(__name__)

# The live answer must be the same departure as the timetable one (allowing for a retimed schedule)
SAME_DEPARTURE_TOLERANCE_MINUTES = 180
MIN_UPGRADE_SECONDS = 1.0


def _same_departure(live: FlightResult, timetable: FlightResult) -> bool:
    if live.origin != timetable.origin or live.destination != timetable.destination:
        return False
    try:
        live_dep, timetable_dep = parse_flight_time(live.scheduled_departure), parse_flight_time(timetable.scheduled_departure)
    except ValueError:
        return False
    if live_dep is None or timetable_dep is None:
        return False
    return abs((live_dep - timetable_dep).total_seconds()) <= SAME_DEPARTURE_TOLERANCE_MINUTES * 60


class ChainFlightProvider(FlightDataProvider):
    """
    Tries providers in order and returns the first answer.
    - A provider that has no data (not found, date not covered), fails or is too slow passes to the next one.
    - If the answer is only a timetable and `live_upgrade` is set, that provider is asked for live status only
      (e.g. AviationStack has live data at airports AeroDataBox doesn't track live, such as CMB). The live answer
      replaces the timetable only if it is the same departure (same route, scheduled time within 3 hours).
    Everything runs within `timeout_seconds` (keep it below the Flight Agent's own timeout): each provider gets a
    fair share of the time left, and the upgrade only the time remaining, so a slow backup never costs the answer.
    When every provider fails, the most informative error is raised: not found > date not covered > unavailable.
    """
    name = "ChainFlightProvider"

    def __init__(self, providers: List[FlightDataProvider], live_upgrade: Optional[FlightDataProvider] = None,
                 timeout_seconds: float = 9.0):
        if not providers:
            raise ValueError("ChainFlightProvider needs at least one provider")
        self.providers = providers
        self.live_upgrade = live_upgrade
        self.timeout_seconds = timeout_seconds
        self.name = " → ".join(getattr(p, "name", type(p).__name__) for p in providers)

    async def get_flight_status(self, flight_number: str, travel_date: str, origin: str, destination: str) -> FlightResult:
        deadline = time.monotonic() + self.timeout_seconds
        errors: List[FlightProviderError] = []
        for position, provider in enumerate(self.providers):
            share = (deadline - time.monotonic()) / (len(self.providers) - position)
            try:
                result = await asyncio.wait_for(
                    provider.get_flight_status(flight_number, travel_date, origin, destination), timeout=max(share, 0.1)
                )
            except (FlightNotFoundError, FlightDateNotCoveredError, FlightDataUnavailableError) as e:
                logger.info(f"{getattr(provider, 'name', provider)} could not answer {flight_number} {travel_date}: {e}")
                errors.append(e)
                continue
            except asyncio.TimeoutError:
                logger.info(f"{getattr(provider, 'name', provider)} timed out for {flight_number} {travel_date}")
                errors.append(FlightDataUnavailableError(f"{getattr(provider, 'name', provider)} timed out"))
                continue
            return await self._maybe_upgrade(result, provider, deadline, flight_number, travel_date, origin, destination)

        for kind in (FlightNotFoundError, FlightDateNotCoveredError, FlightDataUnavailableError):
            for error in errors:
                if isinstance(error, kind):
                    raise error
        raise FlightDataUnavailableError("No flight data provider could answer")

    async def _maybe_upgrade(self, result: FlightResult, answered_by: FlightDataProvider, deadline: float,
                             flight_number: str, travel_date: str, origin: str, destination: str) -> FlightResult:
        if result.data_mode != "timetable" or self.live_upgrade is None or self.live_upgrade is answered_by:
            return result
        remaining = deadline - time.monotonic()
        if remaining < MIN_UPGRADE_SECONDS:
            return result
        try:
            live = await asyncio.wait_for(
                self.live_upgrade.get_live_status(flight_number, travel_date, origin, destination), timeout=remaining
            )
        except (FlightProviderError, asyncio.TimeoutError):
            return result
        if live is None or live.data_mode != "live" or not _same_departure(live, result):
            return result
        return live
