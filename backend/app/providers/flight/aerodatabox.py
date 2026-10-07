from app.providers.flight.base import (
    FlightDataProvider, FlightNotFoundError, FlightDataUnavailableError, FlightDateNotCoveredError,
)
from app.providers.flight.cache import FlightCache
from app.providers.flight.settings import FlightSettings, flight_settings
from app.schemas.flight import FlightResult
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional
import httpx

AERODATABOX_BASE_URL = "https://aerodatabox.p.rapidapi.com"
AERODATABOX_HOST = "aerodatabox.p.rapidapi.com"
UNITS_PER_LOOKUP = 2      # "Flight status (single day)" is a Tier 2 endpoint
MAX_DAYS = 365            # schedules and history are available up to a year either way

# AeroDataBox status -> FlightResult status. "Expected"/"Unknown" keep SCHEDULED; the agent promotes to DELAYED
# when the revised time is 15+ minutes late.
STATUS_MAP = {
    "Expected": "SCHEDULED",
    "Unknown": "SCHEDULED",
    "CheckIn": "SCHEDULED",
    "Boarding": "SCHEDULED",
    "GateClosed": "SCHEDULED",
    "Delayed": "DELAYED",
    "Departed": "DEPARTED",
    "EnRoute": "DEPARTED",
    "Approaching": "DEPARTED",
    "Arrived": "LANDED",
    "Canceled": "CANCELLED",
    "Diverted": "DIVERTED",
    "CanceledUncertain": "UNKNOWN",
}


def _utc(moment: Optional[Dict[str, Any]]) -> Optional[str]:
    """'2026-10-06 21:05Z' -> '2026-10-06T21:05:00Z'."""
    value = (moment or {}).get("utc")
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace(" ", "T").replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _minutes_late(scheduled: Optional[str], revised: Optional[str]) -> int:
    if not scheduled or not revised:
        return 0
    delta = datetime.fromisoformat(revised.replace("Z", "+00:00")) - datetime.fromisoformat(scheduled.replace("Z", "+00:00"))
    return max(int(delta.total_seconds() // 60), 0)


class AeroDataBoxFlightProvider(FlightDataProvider):
    """
    Flight status and schedules from AeroDataBox (via RapidAPI): GET /flights/number/{number}/{dateLocal}.
    One lookup answers past, today and future dates (up to a year either way). Times come back in UTC and local.
    Live data ("Live" quality) exists only where AeroDataBox tracks the airport; elsewhere it is the timetable.
    Usage is limited by API units: the remaining units reported by RapidAPI are stored and requests stop
    before the reserve is reached. Responses are cached (well under the 7-day limit in the terms of use).
    """
    name = "AeroDataBox"

    def __init__(self, api_key: str, base_url: str = AERODATABOX_BASE_URL, timeout_seconds: float = 8.0,
                 cache: Optional[FlightCache] = None, settings: Optional[FlightSettings] = None,
                 transport: Optional[httpx.AsyncBaseTransport] = None, today: Optional[callable] = None):
        if not api_key:
            raise ValueError("AeroDataBox requires AERODATABOX_API_KEY")
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout_seconds
        self._cache = cache or FlightCache()
        self._settings = settings or flight_settings
        self._transport = transport
        self._today = today or (lambda: datetime.now(timezone.utc).date())

    async def get_flight_status(self, flight_number: str, travel_date: str, origin: str, destination: str) -> FlightResult:
        flight_iata = flight_number.upper().strip()
        day = date.fromisoformat(travel_date)
        if abs((day - self._today()).days) > MAX_DAYS:
            raise FlightDateNotCoveredError("Flight data is only available up to a year before or after today.")

        records = await self._fetch(flight_iata, travel_date, near=abs((day - self._today()).days) <= 1)
        # dateLocalRole=Both also returns flights that only ARRIVE on that date: keep departures on the date
        on_date = [r for r in records if ((r.get("departure") or {}).get("scheduledTime") or {}).get("local", "").startswith(travel_date)]
        if not on_date:
            raise FlightNotFoundError(f"AeroDataBox has no {flight_iata} departing on {travel_date}")
        on_date.sort(key=lambda r: (
            r.get("codeshareStatus") == "IsCodeshared",
            (((r.get("departure") or {}).get("airport") or {}).get("iata") or "") != origin,
        ))
        return self._to_result(on_date[0], flight_iata)

    def _to_result(self, record: Dict[str, Any], flight_iata: str) -> FlightResult:
        dep = record.get("departure") or {}
        arr = record.get("arrival") or {}
        raw_status = record.get("status") or "Unknown"
        live = "Live" in (dep.get("quality") or []) or "Live" in (arr.get("quality") or [])

        sched_dep, sched_arr = _utc(dep.get("scheduledTime")), _utc(arr.get("scheduledTime"))
        est_dep, est_arr = _utc(dep.get("revisedTime")), _utc(arr.get("revisedTime"))
        act_dep, act_arr = _utc(dep.get("runwayTime")), _utc(arr.get("runwayTime"))
        # Delay at the arrival end if known (what matters for a connection), otherwise at departure
        delay = _minutes_late(sched_arr, act_arr or est_arr) if (act_arr or est_arr) else _minutes_late(sched_dep, act_dep or est_dep)

        reasons = [] if live else ["TIMETABLE_ONLY"]
        if raw_status == "CanceledUncertain":
            reasons.append("CANCELLATION_UNCERTAIN")

        return FlightResult(
            flight_number=flight_iata,
            airline=(record.get("airline") or {}).get("name"),
            origin=((dep.get("airport") or {}).get("iata") or "").upper(),
            destination=((arr.get("airport") or {}).get("iata") or "").upper(),
            scheduled_departure=sched_dep,
            estimated_departure=est_dep,
            actual_departure=act_dep,
            scheduled_arrival=sched_arr,
            estimated_arrival=est_arr,
            actual_arrival=act_arr,
            status=STATUS_MAP.get(raw_status, "UNKNOWN"),
            delay_minutes=delay,
            terminal=dep.get("terminal") or None,
            gate=dep.get("gate") or None,
            arrival_terminal=arr.get("terminal") or None,
            source="AeroDataBox (live status)" if live else "AeroDataBox (published schedule)",
            retrieved_at=datetime.now(timezone.utc).isoformat(),
            reason_codes=reasons,
            data_mode="live" if live else "timetable",
        )

    async def _fetch(self, flight_iata: str, travel_date: str, near: bool) -> List[Dict[str, Any]]:
        cache_key = f"adb:{flight_iata}:{travel_date}"
        cached = self._cache.get(cache_key)
        if cached is not None:
            return cached

        remaining = self._cache.get(f"adb:units_remaining")
        if remaining is not None and remaining - UNITS_PER_LOOKUP < self._settings.AERODATABOX_UNITS_RESERVE:
            raise FlightDataUnavailableError("AeroDataBox monthly unit quota reached")

        url = f"{self._base_url}/flights/number/{flight_iata}/{travel_date}"
        headers = {"X-RapidAPI-Key": self._api_key, "X-RapidAPI-Host": AERODATABOX_HOST}
        params = {"dateLocalRole": "Both", "withAircraftImage": "false", "withLocation": "false"}
        try:
            async with httpx.AsyncClient(timeout=self._timeout, transport=self._transport) as client:
                response = await client.get(url, headers=headers, params=params)
        except httpx.HTTPError as e:
            raise FlightDataUnavailableError(f"AeroDataBox request failed ({type(e).__name__})") from None
        self._cache.record_call(self.name)

        units = response.headers.get("x-ratelimit-api-units-remaining")
        if units and units.isdigit():
            self._cache.set("adb:units_remaining", int(units), 40 * 24 * 3600)

        if response.status_code in (204, 404):
            records: List[Dict[str, Any]] = []
        elif response.status_code == 200:
            try:
                records = response.json()
            except ValueError:
                raise FlightDataUnavailableError("AeroDataBox returned unreadable data") from None
            if not isinstance(records, list):
                raise FlightDataUnavailableError("AeroDataBox returned an unexpected response")
        elif response.status_code == 429:
            raise FlightDataUnavailableError("AeroDataBox rate limit reached")
        else:
            raise FlightDataUnavailableError(f"AeroDataBox returned HTTP {response.status_code}")

        if records:
            ttl = self._settings.FLIGHT_LIVE_CACHE_SECONDS if near else self._settings.FLIGHT_TIMETABLE_CACHE_SECONDS
        else:
            ttl = self._settings.FLIGHT_NOT_FOUND_CACHE_SECONDS
        self._cache.set(cache_key, records, ttl)
        return records
