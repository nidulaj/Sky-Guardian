from app.providers.flight.base import FlightDataProvider, FlightNotFoundError, FlightDataUnavailableError
from app.schemas.flight import FlightResult
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
import httpx
import time

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
    AviationStack returns airport-local times labelled '+00:00'. Re-read the wall-clock time in the
    airport's timezone and convert to UTC. Returns (utc_iso, converted); unconverted values are kept as given.
    """
    if not value:
        return None, True
    try:
        wall_clock = datetime.fromisoformat(value).replace(tzinfo=None)
        local = wall_clock.replace(tzinfo=ZoneInfo(tz_name)) if tz_name else None
    except (ValueError, ZoneInfoNotFoundError):
        local = None
    if local is None:
        return value, False
    return local.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), True


class AviationStackFlightProvider(FlightDataProvider):
    """
    Live flight status from the AviationStack /flights endpoint.
    The free plan does not allow filtering by flight_date, so all recent records for the flight number are
    fetched once (cached per flight number) and the record for the requested travel date is selected here.
    """
    name = "AviationStack"

    def __init__(self, api_key: str, base_url: str = AVIATIONSTACK_BASE_URL, timeout_seconds: float = 8.0,
                 cache_ttl_seconds: float = 300.0, transport: Optional[httpx.AsyncBaseTransport] = None):
        if not api_key:
            raise ValueError("AviationStack requires FLIGHT_API_KEY")
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout_seconds
        self._cache_ttl = cache_ttl_seconds
        self._transport = transport
        self._cache: Dict[str, Tuple[float, List[Dict[str, Any]]]] = {}

    async def get_flight_status(self, flight_number: str, travel_date: str, origin: str, destination: str) -> FlightResult:
        flight_iata = flight_number.upper().strip()
        records = await self._fetch(flight_iata)

        on_date = [r for r in records if r.get("flight_date") == travel_date
                   and (r.get("flight") or {}).get("iata", "").upper() == flight_iata]
        if not on_date:
            raise FlightNotFoundError(f"AviationStack has no {flight_iata} record for {travel_date}")

        # Prefer the operating carrier's record, then one departing from the requested origin
        on_date.sort(key=lambda r: (
            (r.get("flight") or {}).get("codeshared") is not None,
            (r.get("departure") or {}).get("iata") != origin,
        ))
        return self._to_result(on_date[0], flight_iata)

    async def _fetch(self, flight_iata: str) -> List[Dict[str, Any]]:
        cached = self._cache.get(flight_iata)
        if cached and time.monotonic() - cached[0] < self._cache_ttl:
            return cached[1]

        params = {"access_key": self._api_key, "flight_iata": flight_iata, "limit": 100}
        try:
            async with httpx.AsyncClient(timeout=self._timeout, transport=self._transport) as client:
                response = await client.get(f"{self._base_url}/flights", params=params)
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
        self._cache[flight_iata] = (time.monotonic(), records)
        return records

    def _to_result(self, record: Dict[str, Any], flight_iata: str) -> FlightResult:
        dep = record.get("departure") or {}
        arr = record.get("arrival") or {}
        raw_status = (record.get("flight_status") or "").lower()
        reasons = []

        times = {}
        for side, data, tz_name in (("departure", dep, dep.get("timezone")), ("arrival", arr, arr.get("timezone"))):
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
            terminal=dep.get("terminal"),
            gate=dep.get("gate"),
            source="AviationStack (live)",
            retrieved_at=datetime.now(timezone.utc).isoformat(),
            reason_codes=reasons,
            **times,
        )
