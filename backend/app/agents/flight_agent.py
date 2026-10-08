from app.agents.base import BaseAgent
from app.orchestrator.state import JourneyState
from app.schemas.journey import AgentResultSchema
from app.schemas.flight import FlightResult, FLIGHT_NUMBER_PATTERN, AIRPORT_CODE_PATTERN, TRAVEL_DATE_PATTERN, parse_flight_time
from app.providers.flight.base import (
    FlightDataProvider, FlightNotFoundError, FlightDataUnavailableError, FlightDateNotCoveredError,
)
from app.providers.airports import get_airport
from app.providers.flight.provider import get_flight_provider
from datetime import date, datetime, timezone
from typing import Dict, Any, List, Optional
import asyncio
import logging
import re

logger = logging.getLogger(__name__)

# A departure 15+ minutes behind schedule counts as delayed (common on-time performance threshold)
DELAY_THRESHOLD_MINUTES = 15


class FlightAgent(BaseAgent):
    """
    Flight Status Agent.
    Answers one question per leg: what is happening to this flight?
    Receive flight details -> call FlightDataProvider -> validate result -> return structured FlightResult.
    It does not calculate journey risk or choose alternatives.
    """
    def __init__(self, provider: Optional[FlightDataProvider] = None, timeout_seconds: float = 10.0):
        super().__init__(name="flight_agent")
        self.provider = provider or get_flight_provider()
        self.timeout_seconds = timeout_seconds

    async def execute(self, state: JourneyState) -> AgentResultSchema:
        results = await asyncio.gather(*(self._process_leg(leg) for leg in state.journey_legs))

        flight_results = [r.model_dump() for r, _ in results]
        warnings = [w for _, leg_warnings in results for w in leg_warnings]
        state.flight_results = flight_results
        state.warnings.extend(warnings)

        resolved = [r for r in flight_results if r["status"] != "UNKNOWN"]
        if flight_results and len(resolved) == len(flight_results):
            status, confidence = "success", "medium" if warnings else "high"
        elif resolved:
            status, confidence = "partial", "medium"
        else:
            status, confidence = "unavailable", "low"

        return self.create_result(
            status=status,
            data={"flight_results": flight_results},
            trace_id=state.trace_id,
            confidence=confidence,
            warnings=warnings
        )

    async def _process_leg(self, leg: Dict[str, Any]) -> tuple[FlightResult, List[str]]:
        flight_num = str(leg.get("flight_number") or "").upper().replace(" ", "")
        origin = str(leg.get("origin") or "").upper().strip()
        dest = str(leg.get("destination") or "").upper().strip()
        travel_date = str(leg.get("travel_date") or "").strip()

        # Validate input before calling the provider
        reasons = []
        if not re.fullmatch(FLIGHT_NUMBER_PATTERN, flight_num):
            reasons.append("INVALID_FLIGHT_NUMBER")
        if not re.fullmatch(AIRPORT_CODE_PATTERN, origin) or not re.fullmatch(AIRPORT_CODE_PATTERN, dest):
            reasons.append("INVALID_AIRPORT_CODE")
        elif get_airport(origin) is None or get_airport(dest) is None:
            reasons.append("UNKNOWN_AIRPORT")
        try:
            if not re.fullmatch(TRAVEL_DATE_PATTERN, travel_date):
                raise ValueError(travel_date)
            date.fromisoformat(travel_date)
        except ValueError:
            reasons.append("INVALID_TRAVEL_DATE")
        if reasons:
            # Never echo rejected input verbatim: keep only alphanumerics, truncated
            safe_num = re.sub(r"[^A-Z0-9]", "", flight_num)[:8]
            safe_origin, safe_dest = re.sub(r"[^A-Z]", "", origin)[:3], re.sub(r"[^A-Z]", "", dest)[:3]
            label = safe_num or "(blank)"
            return self._unknown(safe_num, safe_origin, safe_dest, reasons), [
                f"Flight {label}: input rejected ({', '.join(reasons)}). Use a flight number like UL001, real 3-letter airport codes and a YYYY-MM-DD date."
            ]

        # Call the provider
        try:
            result = await asyncio.wait_for(
                self.provider.get_flight_status(flight_num, travel_date, origin, dest),
                timeout=self.timeout_seconds
            )
        except FlightNotFoundError:
            return self._unknown(flight_num, origin, dest, ["FLIGHT_NOT_FOUND"]), [
                f"No status data found for {flight_num} on {travel_date}. Check the flight number with your airline."
            ]
        except FlightDateNotCoveredError as e:
            return self._unknown(flight_num, origin, dest, ["DATE_NOT_COVERED"]), [
                f"{flight_num} on {travel_date}: {e}"
            ]
        except (FlightDataUnavailableError, asyncio.TimeoutError) as e:
            logger.warning(f"Flight provider unavailable for {flight_num}: {e!r}")
            return self._unknown(flight_num, origin, dest, ["FLIGHT_DATA_UNAVAILABLE"]), [
                f"Live status for {flight_num} is temporarily unavailable."
            ]
        except Exception as e:
            logger.exception(f"Unexpected flight provider error for {flight_num}")
            return self._unknown(flight_num, origin, dest, ["PROVIDER_ERROR"]), [
                f"Could not retrieve status for {flight_num}: {type(e).__name__}"
            ]

        return self._validate(result, origin, dest)

    def _validate(self, result: FlightResult, origin: str, dest: str) -> tuple[FlightResult, List[str]]:
        """Sanity-check provider output so downstream agents can trust it."""
        warnings = []
        reasons = list(result.reason_codes)

        if result.origin != origin or result.destination != dest:
            reasons.append("ROUTE_MISMATCH")
            warnings.append(
                f"{result.flight_number} operates {result.origin} → {result.destination}, not {origin} → {dest} as entered."
            )

        time_fields = ["scheduled_departure", "estimated_departure", "actual_departure",
                       "scheduled_arrival", "estimated_arrival", "actual_arrival"]
        for field in time_fields:
            try:
                parse_flight_time(getattr(result, field))
            except ValueError:
                setattr(result, field, None)
                reasons.append("INVALID_TIMESTAMP")
                warnings.append(f"{result.flight_number}: ignored unreadable {field.replace('_', ' ')} from provider.")

        # Derive the delay from the timetable when the provider did not report one (actual > estimated departure)
        sched_dep = parse_flight_time(result.scheduled_departure)
        latest_dep = parse_flight_time(result.actual_departure or result.estimated_departure)
        if result.delay_minutes == 0 and sched_dep and latest_dep:
            derived = int((latest_dep - sched_dep).total_seconds() // 60)
            if derived > 0:
                result.delay_minutes = derived
                reasons.append("DELAY_DERIVED_FROM_TIMES")
        if result.status in ("SCHEDULED", "ON_TIME") and result.delay_minutes >= DELAY_THRESHOLD_MINUTES:
            result.status = "DELAYED"

        result.reason_codes = list(dict.fromkeys(reasons))
        return self._enrich(result), warnings

    @staticmethod
    def _enrich(result: FlightResult) -> FlightResult:
        """Attach airport names, cities and IANA timezones so the UI can show local times."""
        for side in ("origin", "destination"):
            airport = get_airport(getattr(result, side))
            if airport:
                setattr(result, f"{side}_name", airport.name)
                setattr(result, f"{side}_city", airport.city)
                setattr(result, f"{side}_timezone", airport.timezone)
        return result

    def _unknown(self, flight_num: str, origin: str, dest: str, reasons: List[str]) -> FlightResult:
        return self._enrich(FlightResult(
            flight_number=flight_num,
            origin=origin,
            destination=dest,
            status="UNKNOWN",
            delay_minutes=0,
            source=getattr(self.provider, "name", type(self.provider).__name__),
            retrieved_at=datetime.now(timezone.utc).isoformat(),
            reason_codes=reasons
        ))
