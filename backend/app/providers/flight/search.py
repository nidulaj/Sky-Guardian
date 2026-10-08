from abc import ABC, abstractmethod
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from app.agents.connection_agent import _expected_time
from app.config import settings
from app.providers.airports import airport_timezone
from app.providers.flight.aviationstack import AviationStackFlightProvider
from app.providers.flight.aerodatabox import AeroDataBoxFlightProvider
from app.providers.flight.base import FlightDataUnavailableError
from app.providers.flight.cache import FlightCache
from app.providers.flight.settings import flight_settings
from app.ranking.config import RankingConfig
from app.ranking.filters import aware_time
from app.schemas.alternative import AlternativeCandidate, AlternativeSearchRequest, AlternativeSearchResult
from app.schemas.flight import FlightResult


class FlightSearchProvider(ABC):
    name = "Flight Search"

    @abstractmethod
    async def search(self, query: AlternativeSearchRequest) -> AlternativeSearchResult:
        pass


class ScheduleFlightSearch(FlightSearchProvider):
    """Search a bounded airport/date set, then assemble direct and one-stop candidates."""
    name = "AviationStack alternative search"

    def __init__(self, provider, config: RankingConfig):
        self.provider, self.config = provider, config

    async def search(self, query: AlternativeSearchRequest) -> AlternativeSearchResult:
        airports = [query.origin]
        if self.config.max_stops:
            airports += [a for a in self.config.transfer_airports if a not in (query.origin, query.destination)]
        departures, warnings, calls, successful_calls = {}, [], 0, 0
        for airport in dict.fromkeys(airports):
            local = ZoneInfo(airport_timezone(airport) or "UTC")
            day, last = query.earliest_departure.astimezone(local).date(), query.latest_departure.astimezone(local).date()
            departures[airport] = []
            while day <= last:
                if calls >= self.config.max_provider_requests:
                    warnings.append("Alternative flight search reached its configured request limit.")
                    break
                calls += 1
                try:
                    flights = await self.provider.search_departures(airport, day.isoformat())
                    successful_calls += 1
                    departures[airport].extend(flights[:100])
                except FlightDataUnavailableError:
                    warnings.append(f"Alternative schedules unavailable for {airport} on {day.isoformat()}.")
                day += timedelta(days=1)

        candidates = self._candidates(departures, query)
        warnings.append("Search is bounded to selected airports, dates and the first 100 departure records per request; it is not exhaustive.")
        return AlternativeSearchResult(candidates=candidates, warnings=list(dict.fromkeys(warnings)), complete=False,
                                       available=successful_calls > 0)

    def _candidates(self, departures, query):
        candidates = []
        for first in departures.get(query.origin, []):
            try:
                start = aware_time(_expected_time(first.model_dump(), "departure")[0])
                if not query.earliest_departure <= start <= query.latest_departure:
                    continue
            except (ValueError, TypeError):
                continue
            if first.destination == query.destination:
                candidates.append(AlternativeCandidate(legs=[first]))
            elif first.destination in departures and self.config.max_stops:
                for second in departures[first.destination]:
                    if second.destination != query.destination:
                        continue
                    try:
                        arrival = aware_time(_expected_time(first.model_dump(), "arrival")[0])
                        onward = aware_time(_expected_time(second.model_dump(), "departure")[0])
                    except (ValueError, TypeError):
                        continue
                    if (onward - arrival).total_seconds() < 60 * (self.config.minimum_connection_minutes + self.config.minimum_connection_margin_minutes):
                        continue
                    candidates.append(AlternativeCandidate(legs=[first, second]))
                    if len(candidates) >= self.config.max_candidates:
                        break
            if len(candidates) >= self.config.max_candidates:
                break
        return candidates[:self.config.max_candidates]


class AeroDataBoxSearch(ScheduleFlightSearch):
    name = "AeroDataBox alternative search"

    async def search(self, query):
        airports = [query.origin]
        if self.config.max_stops:
            airports += [airport for airport in self.config.transfer_airports if airport not in (query.origin, query.destination)]
        departures = {airport: [] for airport in dict.fromkeys(airports)}
        warnings, calls, successes = [], 0, 0
        start = query.earliest_departure.replace(minute=0, second=0, microsecond=0)
        # Visit each airport before extending the time horizon, keeping actual HTTP calls bounded.
        while start < query.latest_departure and calls < self.config.max_provider_requests:
            end = min(start + timedelta(hours=12), query.latest_departure)
            for airport in departures:
                if calls >= self.config.max_provider_requests:
                    break
                calls += 1
                try:
                    departures[airport].extend(await self.provider.search_departure_window(airport, start, end))
                    successes += 1
                except FlightDataUnavailableError:
                    warnings.append(f"Some departure schedules for {airport} could not be checked.")
            start = end
        warnings.append(f"Limited search: selected airports, up to {self.config.max_provider_requests} 12-hour windows and 100 departures per request. Other routes may exist.")
        return AlternativeSearchResult(candidates=self._candidates(departures, query), warnings=list(dict.fromkeys(warnings)),
                                       complete=False, available=successes > 0)


class MockFlightSearch(ScheduleFlightSearch):
    name = "MockFlightSearch (Demo Data)"

    # Explicit sample catalog: airport-local departure hour and duration, not real inventory.
    CATALOG = [
        ("KUL", "NRT", "MH088", 8, 420),
        ("KUL", "NRT", "XX124", 11, 440),
        ("KUL", "SIN", "SQ119", 23, 60),
        ("SIN", "NRT", "SQ638", 7, 420),
        ("CMB", "SIN", "UL306", 6, 240),
        ("CMB", "NRT", "UL454", 23, 600),
        ("CMB", "LHR", "UL505", 14, 720),
    ]

    def __init__(self, config: RankingConfig, now=None):
        self.now = now or (lambda: datetime.now(timezone.utc))
        super().__init__(self, config)

    async def search_departures(self, origin, travel_date):
        day = datetime.fromisoformat(travel_date).date()
        local = ZoneInfo(airport_timezone(origin) or "UTC")
        flights = []
        for dep, arr, number, hour, duration in self.CATALOG:
            if dep != origin:
                continue
            start = datetime.combine(day, time(hour), tzinfo=local).astimezone(timezone.utc)
            flights.append(FlightResult(
                flight_number=number, airline="Sample airline", origin=dep, destination=arr,
                scheduled_departure=start.isoformat(), scheduled_arrival=(start + timedelta(minutes=duration)).isoformat(),
                status="SCHEDULED", source=self.name, data_mode="demo", retrieved_at=self.now().isoformat(),
            ))
        return flights

    async def search(self, query):
        result = await super().search(query)
        result.warnings.insert(0, "Alternative flight schedules are sample data, not real flights or bookable inventory.")
        return result


class UnavailableFlightSearch(FlightSearchProvider):
    name = "Unconfigured flight search"

    async def search(self, query):
        raise FlightDataUnavailableError("Live alternative search requires departure-search access.")


def get_flight_search_provider(config: RankingConfig) -> FlightSearchProvider:
    mode = settings.ALTERNATIVE_PROVIDER.strip().lower()
    if mode == "mock" or (mode == "auto" and (settings.USE_MOCK_FLIGHTS or settings.FLIGHT_PROVIDER == "mock")):
        return MockFlightSearch(config)
    if mode not in {"auto", "aviationstack", "aerodatabox"}:
        raise ValueError("ALTERNATIVE_PROVIDER must be auto, mock, aviationstack or aerodatabox")
    adb_key = (flight_settings.AERODATABOX_API_KEY or "").strip()
    if mode == "aerodatabox" or (mode == "auto" and adb_key not in {"", "mock_key"}):
        if adb_key in {"", "mock_key"}:
            return UnavailableFlightSearch()
        provider = AeroDataBoxFlightProvider(api_key=adb_key, cache=FlightCache(flight_settings.FLIGHT_CACHE_PATH))
        return AeroDataBoxSearch(provider, config)
    key = (settings.FLIGHT_API_KEY or "").strip()
    if key in {"", "mock_key"}:
        return UnavailableFlightSearch()
    provider = AviationStackFlightProvider(api_key=key, cache=FlightCache(flight_settings.FLIGHT_CACHE_PATH))
    return ScheduleFlightSearch(provider, config)
