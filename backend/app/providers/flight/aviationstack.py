from app.providers.flight.base import (
    FlightDataProvider, FlightNotFoundError, FlightDataUnavailableError, FlightDateNotCoveredError,
)
from app.providers.flight.cache import FlightCache
from app.providers.flight.settings import FlightSettings, flight_settings
from app.providers.airports import airport_timezone
from app.schemas.flight import FlightResult
from datetime import date, datetime, timezone
from typing import Any, Callable, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
import re
import httpx

AVIATIONSTACK_BASE_URL = "https://api.aviationstack.com/v1"

STATUS_MAP = {
    "scheduled": "SCHEDULED",
    "active": "DEPARTED",
    "landed": "LANDED",
    "cancelled": "CANCELLED",
    "diverted": "DIVERTED",
}


def _local_to_utc(value: Optional[str], tz_name: Optional[str]) -> Tuple[Optional[str], bool]:
    """
    AviationStack returns airport-local wall-clock times (live feed: labelled '+00:00'; timetable: no offset).
    Re-read the wall-clock time in the airport's timezone and convert to UTC.
    Returns (utc_iso, converted); values that cannot be converted are kept as given.
    """
    if not value:
        return None, True
    try:
        wall_clock = datetime.fromisoformat(value.replace(" ", "T")).replace(tzinfo=None)
        local = wall_clock.replace(tzinfo=ZoneInfo(tz_name)) if tz_name else None
    except (ValueError, ZoneInfoNotFoundError):
        local = None
    if local is None:
        return value, False
    return local.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), True


def _blank_to_none(value: Optional[str]) -> Optional[str]:
    return (value.strip() or None) if isinstance(value, str) else value


def _today_in(tz_name: str) -> date:
    try:
        return datetime.now(ZoneInfo(tz_name)).date()
    except ZoneInfoNotFoundError:
        return datetime.now(timezone.utc).date()


class AviationStackFlightProvider(FlightDataProvider):
    """
    Real flight data from AviationStack, choosing the endpoint by travel date (in the origin airport's timezone):
    - within FLIGHT_LIVE_WINDOW_DAYS of today: /flights (live status, delays, gates, cancellations)
    - later dates: /flightsFuture (published timetable; no delays yet)
    - earlier dates: not covered on the free plan -> FlightDateNotCoveredError
    Responses are cached in SQLite and every HTTP request is counted against the monthly quota.
    """
    name = "AviationStack"

    def __init__(self, api_key: str, base_url: str = AVIATIONSTACK_BASE_URL, timeout_seconds: float = 8.0,
                 cache: Optional[FlightCache] = None, settings: Optional[FlightSettings] = None,
                 transport: Optional[httpx.AsyncBaseTransport] = None,
                 today: Optional[Callable[[str], date]] = None):
        if not api_key:
            raise ValueError("AviationStack requires FLIGHT_API_KEY")
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout_seconds
        self._cache = cache or FlightCache()
        self._settings = settings or flight_settings
        self._transport = transport
        self._today = today or _today_in

    async def get_flight_status(self, flight_number: str, travel_date: str, origin: str, destination: str) -> FlightResult:
        flight_iata = flight_number.upper().strip()
        day = date.fromisoformat(travel_date)
        days_ahead = (day - self._today(airport_timezone(origin) or "UTC")).days
        window = self._settings.FLIGHT_LIVE_WINDOW_DAYS

        if days_ahead < -window:
            raise FlightDateNotCoveredError("Past flights aren't covered by the current flight data plan.")
        if days_ahead > self._settings.FLIGHT_MAX_DAYS_AHEAD:
            raise FlightDateNotCoveredError("Schedules aren't published that far ahead yet.")

        if days_ahead <= window:
            result = await self._live(flight_iata, travel_date, origin)
            if result is None and days_ahead >= 0:
                result = await self._timetable(flight_iata, travel_date, origin, quiet=True)
        else:
            result = await self._timetable(flight_iata, travel_date, origin)

        if result is None:
            raise FlightNotFoundError(f"AviationStack has no {flight_iata} departing {origin} on {travel_date}")
        return result

    async def get_live_status(self, flight_number: str, travel_date: str, origin: str, destination: str) -> Optional[FlightResult]:
        """Live status only, and only inside the live window; no timetable call, so no quota is wasted."""
        flight_iata = flight_number.upper().strip()
        days_ahead = (date.fromisoformat(travel_date) - self._today(airport_timezone(origin) or "UTC")).days
        if abs(days_ahead) > self._settings.FLIGHT_LIVE_WINDOW_DAYS:
            return None
        return await self._live(flight_iata, travel_date, origin, strict_origin=True)

    # ---- live status -------------------------------------------------------------------------------------

    async def _live(self, flight_iata: str, travel_date: str, origin: str, strict_origin: bool = False) -> Optional[FlightResult]:
        records = await self._fetch(
            f"live:{flight_iata}", "flights", {"flight_iata": flight_iata, "limit": 100},
            ttl=self._settings.FLIGHT_LIVE_CACHE_SECONDS,
        )
        on_date = [r for r in records if r.get("flight_date") == travel_date
                   and ((r.get("flight") or {}).get("iata") or "").upper() == flight_iata]
        if strict_origin:
            on_date = [r for r in on_date if ((r.get("departure") or {}).get("iata") or "").upper() == origin]
        if not on_date:
            return None
        # Prefer the operating carrier's record, then one departing from the requested origin
        on_date.sort(key=lambda r: (
            (r.get("flight") or {}).get("codeshared") is not None,
            ((r.get("departure") or {}).get("iata") or "").upper() != origin,
        ))
        return self._live_to_result(on_date[0], flight_iata)

    def _live_to_result(self, record: Dict[str, Any], flight_iata: str) -> FlightResult:
        dep = record.get("departure") or {}
        arr = record.get("arrival") or {}
        raw_status = (record.get("flight_status") or "").lower()
        reasons = []

        times = {}
        for side, data in (("departure", dep), ("arrival", arr)):
            tz_name = data.get("timezone") or airport_timezone(data.get("iata"))
            for kind in ("scheduled", "estimated", "actual"):
                value, converted = _local_to_utc(data.get(kind), tz_name)
                times[f"{kind}_{side}"] = value
                if not converted and "TIMEZONE_UNVERIFIED" not in reasons:
                    reasons.append("TIMEZONE_UNVERIFIED")

        if raw_status == "incident":
            reasons.append("INCIDENT_REPORTED")
        delay = arr.get("delay") if arr.get("delay") is not None else dep.get("delay")

        return FlightResult(
            flight_number=flight_iata,
            airline=(record.get("airline") or {}).get("name"),
            origin=(dep.get("iata") or "").upper(),
            destination=(arr.get("iata") or "").upper(),
            status=STATUS_MAP.get(raw_status, "UNKNOWN"),
            delay_minutes=max(int(delay or 0), 0),
            terminal=_blank_to_none(dep.get("terminal")),
            gate=_blank_to_none(dep.get("gate")),
            arrival_terminal=_blank_to_none(arr.get("terminal")),
            source="AviationStack (live status)",
            retrieved_at=datetime.now(timezone.utc).isoformat(),
            reason_codes=reasons,
            data_mode="live",
            **times,
        )

    # ---- published timetable -----------------------------------------------------------------------------

    async def _timetable(self, flight_iata: str, travel_date: str, origin: str, quiet: bool = False) -> Optional[FlightResult]:
        match = re.fullmatch(r"([A-Z0-9]{2,3}?)(\d{1,4}[A-Z]?)", flight_iata)
        if not match or not origin:
            return None
        airline, number = match.groups()
        try:
            records = await self._fetch(
                f"timetable:{origin}:{travel_date}:{flight_iata}", "flightsFuture",
                {"iataCode": origin, "type": "departure", "date": travel_date,
                 "airline_iata": airline, "flight_number": number},
                ttl=self._settings.FLIGHT_TIMETABLE_CACHE_SECONDS,
            )
        except FlightDataUnavailableError:
            if quiet:
                return None
            raise
        wanted = flight_iata.lower()
        for record in records:
            if ((record.get("flight") or {}).get("iataNumber") or "").lower() == wanted:
                return self._timetable_to_result(record, flight_iata)
        return None

    def _timetable_to_result(self, record: Dict[str, Any], flight_iata: str) -> FlightResult:
        dep = record.get("departure") or {}
        arr = record.get("arrival") or {}
        origin = (dep.get("iataCode") or "").upper()
        destination = (arr.get("iataCode") or "").upper()
        reasons = ["TIMETABLE_ONLY"]

        sched_dep, ok_dep = _local_to_utc(dep.get("scheduledTime"), airport_timezone(origin))
        sched_arr, ok_arr = _local_to_utc(arr.get("scheduledTime"), airport_timezone(destination))
        if not (ok_dep and ok_arr):
            reasons.append("TIMEZONE_UNVERIFIED")

        airline_name = (record.get("airline") or {}).get("name")
        return FlightResult(
            flight_number=flight_iata,
            airline=airline_name.title() if airline_name else None,
            origin=origin,
            destination=destination,
            scheduled_departure=sched_dep,
            scheduled_arrival=sched_arr,
            status="SCHEDULED",
            delay_minutes=0,
            terminal=_blank_to_none(dep.get("terminal")),
            gate=_blank_to_none(dep.get("gate")),
            arrival_terminal=_blank_to_none(arr.get("terminal")),
            source="AviationStack (published timetable)",
            retrieved_at=datetime.now(timezone.utc).isoformat(),
            reason_codes=reasons,
            data_mode="timetable",
        )

    # ---- HTTP, cache and quota -----------------------------------------------------------------------------

    async def _fetch(self, cache_key: str, endpoint: str, params: Dict[str, Any], ttl: float) -> List[Dict[str, Any]]:
        cached = self._cache.get(cache_key)
        if cached is not None:
            return cached

        limit = self._settings.FLIGHT_MONTHLY_QUOTA - self._settings.FLIGHT_QUOTA_RESERVE
        if self._cache.calls_this_month(self.name) >= limit:
            raise FlightDataUnavailableError("AviationStack monthly request quota reached")
        self._cache.record_call(self.name)

        try:
            async with httpx.AsyncClient(timeout=self._timeout, transport=self._transport) as client:
                response = await client.get(f"{self._base_url}/{endpoint}", params={"access_key": self._api_key, **params})
            payload = response.json()
        except (httpx.HTTPError, ValueError) as e:
            # Never include the request URL in errors: it carries the access key
            raise FlightDataUnavailableError(f"AviationStack request failed ({type(e).__name__})") from None

        if isinstance(payload, dict) and payload.get("error"):
            code = payload["error"].get("code", "unknown_error")
            raise FlightDataUnavailableError(f"AviationStack error: {code}")
        if response.status_code != 200 or not isinstance(payload, dict) or not isinstance(payload.get("data"), list):
            raise FlightDataUnavailableError(f"AviationStack returned HTTP {response.status_code}")

        records = payload["data"]
        self._cache.set(cache_key, records, ttl if records else self._settings.FLIGHT_NOT_FOUND_CACHE_SECONDS)
        return records
