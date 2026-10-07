from abc import ABC, abstractmethod
from app.schemas.flight import FlightResult


class FlightProviderError(Exception):
    """Base error raised by flight data providers."""


class FlightNotFoundError(FlightProviderError):
    """The provider has no record of this flight on this date."""


class FlightDataUnavailableError(FlightProviderError):
    """The provider could not be reached or returned unusable data."""


class FlightDateNotCoveredError(FlightProviderError):
    """The provider has no data for this date range (e.g. past dates on a free plan)."""


class FlightDataProvider(ABC):
    name: str = "FlightDataProvider"

    @abstractmethod
    async def get_flight_status(self, flight_number: str, travel_date: str, origin: str, destination: str) -> FlightResult:
        """
        Retrieve factual flight status information for one leg.
        Raises FlightNotFoundError or FlightDataUnavailableError instead of inventing data.
        """
        pass
