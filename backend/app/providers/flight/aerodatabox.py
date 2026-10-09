from app.providers.flight.base import (
    FlightDataProvider, FlightNotFoundError, FlightDataUnavailableError, FlightDateNotCoveredError,
)
from app.providers.flight.cache import FlightCache
from app.providers.flight.settings import FlightSettings, flight_settings
from app.schemas.flight import FLIGHT_NUMBER_PATTERN, FlightResult
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo
import re
import httpx
from app.providers.airports import airport_timezone

AERODATABOX_BASE_URL = "https://aerodatabox.p.rapidapi.com"
AERODATABOX_HOST = "aerodatabox.p.rapidapi.com"
UNITS_PER_LOOKUP = 2      # "Flight status (single day)" is a Tier 2 endpoint
UNITS_READING_KEY = "adb:units_remaining"
UNITS_READING_SECONDS = 24 * 3600   # how long a units reading is trusted when RapidAPI doesn't say when it resets
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
    Usage is limited by API units. Requests stop before the reserve is reached, judged by both the remaining units
    RapidAPI reports (trusted until its reset time, or for a day) and our own count of calls this month, whichever
    is stricter. Responses are cached (well under the 7-day limit in the terms of use).
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

        params = {"dateLocalRole": "Both", "withAircraftImage": "false", "withLocation": "false"}
        response = await self._request(f"flights/number/{flight_iata}/{travel_date}", params)

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

    async def search_departure_window(self, origin: str, start: datetime, end: datetime) -> List[FlightResult]:
        """FIDS with both legs, in bounded 12-hour airport-local windows."""
        tz_name = airport_timezone(origin)
        if not tz_name or start.utcoffset() is None or end.utcoffset() is None:
            raise FlightDataUnavailableError("Departure search requires verified airport timezones")
        local_start, local_end = start.astimezone(ZoneInfo(tz_name)), end.astimezone(ZoneInfo(tz_name))
        hours = (local_end.replace(tzinfo=None) - local_start.replace(tzinfo=None)).total_seconds() / 3600
        if not 0 < hours <= 12 or local_start.utcoffset() != local_end.utcoffset():
            raise FlightDataUnavailableError("Departure window crosses an unsupported time boundary")
        path = f"flights/airports/iata/{origin}/{local_start:%Y-%m-%dT%H:%M}/{local_end:%Y-%m-%dT%H:%M}"
        cache_key = f"adb:departures:{path}"
        records = self._cache.get(cache_key)
        if records is None:
            response = await self._request(path, {
                "direction": "Departure", "withLeg": "true", "withCancelled": "false",
                "withCodeshared": "false", "withCargo": "false", "withPrivate": "false", "withLocation": "false",
            })
            if response.status_code == 204:
                records = []
            elif response.status_code == 200:
                try:
                    payload = response.json()
                except ValueError:
                    raise FlightDataUnavailableError("AeroDataBox returned unreadable departures") from None
                records = payload.get("departures") if isinstance(payload, dict) else None
                if not isinstance(records, list):
                    raise FlightDataUnavailableError("AeroDataBox returned unexpected departures")
            else:
                raise FlightDataUnavailableError(f"AeroDataBox departure search returned HTTP {response.status_code}")
            self._cache.set(cache_key, records, self._settings.FLIGHT_LIVE_CACHE_SECONDS)
        flights = []
        for record in records[:100]:
            try:
                if not isinstance(record, dict) or record.get("isCargo") or record.get("codeshareStatus") == "IsCodeshared":
                    continue
                number = re.sub(r"\s+", "", record.get("number", "")).upper()
                if not re.fullmatch(FLIGHT_NUMBER_PATTERN, number):
                    continue
                departure = dict(record.get("departure") or {})
                # FIDS deliberately omits the requested airport from this side of the leg.
                departure.setdefault("airport", {"iata": origin})
                if not departure.get("airport"):
                    departure["airport"] = {"iata": origin}
                for side in (departure, record.get("arrival") or {}):
                    for kind in ("scheduledTime", "revisedTime", "runwayTime"):
                        value = (side.get(kind) or {}).get("utc")
                        if value and datetime.fromisoformat(value.replace("Z", "+00:00")).utcoffset() is None:
                            raise ValueError("Unverified flight time")
                result = self._to_result({**record, "departure": departure}, number)
                if not record.get("status") or record.get("status") == "Unknown":
                    result.status = "UNKNOWN"
                if result.origin == origin:
                    flights.append(result)
            except (TypeError, ValueError, AttributeError):
                continue
        return flights

    async def _request(self, path: str, params: Dict[str, str]) -> httpx.Response:
        if self._units_left() - UNITS_PER_LOOKUP < self._settings.AERODATABOX_UNITS_RESERVE:
            raise FlightDataUnavailableError("AeroDataBox monthly unit quota reached")
        headers = {"X-RapidAPI-Key": self._api_key, "X-RapidAPI-Host": AERODATABOX_HOST}
        self._cache.record_call(self.name)
        try:
            async with httpx.AsyncClient(timeout=self._timeout, transport=self._transport) as client:
                response = await client.get(f"{self._base_url}/{path}", headers=headers, params=params)
        except httpx.HTTPError as error:
            raise FlightDataUnavailableError(f"AeroDataBox request failed ({type(error).__name__})") from None
        self._store_units_reading(response.headers)
        return response

    def _units_left(self) -> int:
        counted = self._settings.AERODATABOX_MONTHLY_UNITS - self._cache.calls_this_month(self.name) * UNITS_PER_LOOKUP
        reported = self._cache.get(UNITS_READING_KEY)
        return min(counted, reported) if reported is not None else counted

    def _store_units_reading(self, headers: httpx.Headers) -> None:
        """Keep RapidAPI's remaining-units reading until its quota resets (or a day), so a low reading never outlives the reset."""
        units = (headers.get("x-ratelimit-api-units-remaining") or "").strip()
        if not units.isdigit():
            return
        reset = (headers.get("x-ratelimit-api-units-reset") or headers.get("x-ratelimit-requests-reset") or "").strip()
        ttl = min(int(reset), UNITS_READING_SECONDS * 31) if reset.isdigit() and int(reset) > 0 else UNITS_READING_SECONDS
        self._cache.set(UNITS_READING_KEY, int(units), ttl)
