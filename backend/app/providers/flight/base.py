from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

class FlightDataProvider(ABC):
    @abstractmethod
    async def get_flight_status(self, flight_number: str, travel_date: str, origin: str, destination: str) -> Dict[str, Any]:
        """Retrieve factual flight status information."""
        pass
