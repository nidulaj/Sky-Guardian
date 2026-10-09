import asyncio
from datetime import datetime, timedelta, timezone

from app.agents.base import BaseAgent
from app.orchestrator.state import JourneyState
from app.providers.flight.base import FlightDataUnavailableError
from app.providers.flight.search import FlightSearchProvider, get_flight_search_provider
from app.ranking.alternative_ranker import rank_alternatives
from app.ranking.config import RankingConfig, get_ranking_config
from app.ranking.filters import aware_time, verified_expected_time
from app.schemas.alternative import AlternativeSearchRequest


class AlternativeAgent(BaseAgent):
    """Select a recovery search, use a provider, then filter and rank supported options."""

    def __init__(self, provider: FlightSearchProvider | None = None, config: RankingConfig | None = None, now=None):
        super().__init__(name="alternative_agent")
        self.config = config or get_ranking_config()
        self.provider = provider or get_flight_search_provider(self.config)
        self.now = now or (lambda: datetime.now(timezone.utc))

    def _search_context(self, state: JourneyState, now: datetime):
        flights = state.flight_results
        if not flights:
            raise ValueError("Flight facts are missing; recovery location cannot be established.")
        origin, ready, note = flights[0].get("origin"), now, "Options assume you can depart from the original origin."
        if any(flight.get("status") == "DIVERTED" for flight in flights):
            raise ValueError("A diverted flight requires confirmation of the passenger's airport.")
        disrupted = next((c for c in state.connection_results if c.get("status") in {"HIGH_RISK", "LIKELY_MISSED", "MISSED"}), None)
        connection_index = disrupted.get("connection_index", 0) if disrupted else None
        if disrupted and (not isinstance(connection_index, int) or connection_index < 0 or connection_index + 1 >= len(flights)):
            raise ValueError("Disrupted connection could not be matched to flight legs.")
        cancelled_index = next((index for index, flight in enumerate(flights) if flight.get("status") == "CANCELLED"), None)
        # Recover at the earliest disruption, never assume an earlier missed connection was completed.
        if cancelled_index is not None and (connection_index is None or cancelled_index <= connection_index + 1):
            index, flight = cancelled_index, flights[cancelled_index]
            origin = flight.get("origin")
            if index:
                inbound = flights[index - 1]
                if inbound.get("destination") != origin:
                    raise ValueError("Arrival and recovery airports do not match.")
                ready = verified_expected_time(inbound, "arrival") + timedelta(minutes=self.config.minimum_connection_minutes + self.config.minimum_connection_margin_minutes)
            else:
                ready = aware_time(flight.get("scheduled_departure"))
            note = f"Recovery search starts at the cancelled flight's origin, {origin}; confirm your location with the airline."
        else:
            if disrupted:
                index = connection_index
                inbound, outbound = flights[index:index + 2]
                origin = inbound.get("destination")
                if origin != outbound.get("origin"):
                    raise ValueError("Airport-change recovery is not supported; ask the airline for options.")
                ready = verified_expected_time(inbound, "arrival") + timedelta(minutes=self.config.minimum_connection_minutes + self.config.minimum_connection_margin_minutes)
                note = f"Options from {origin} assume arrival on {inbound.get('flight_number')}; confirm your actual location before rebooking."
            else:
                if any(f.get("status") in {"DEPARTED", "LANDED"} or f.get("actual_departure") for f in flights):
                    raise ValueError("The journey has already started; confirm a recovery airport with the airline.")
                ready = verified_expected_time(flights[0], "departure")
        earliest = max(now + timedelta(minutes=self.config.boarding_buffer_minutes), ready)
        destination = state.destination or flights[-1].get("destination")
        return AlternativeSearchRequest(origin=origin, destination=destination, earliest_departure=earliest,
                                        latest_departure=earliest + timedelta(hours=self.config.search_window_hours)), note

    async def execute(self, state: JourneyState):
        state.alternative_options, state.recommended_option = [], None
        now = self.now().astimezone(timezone.utc)
        metadata = {"status": "unavailable", "provider": self.provider.name, "searched_at": now.isoformat(),
                    "ranking_config_version": self.config.version}
        warnings = []
        try:
            query, assumption = self._search_context(state, now)
            metadata.update(query.model_dump(mode="json"))
            warnings.append(assumption)
            async with asyncio.timeout(self.config.timeout_seconds):
                result = await self.provider.search(query)
                if not result.available:
                    raise FlightDataUnavailableError("No schedule requests succeeded")
                options, rejected = await rank_alternatives(result, query, self.config, now)
            warnings.extend(result.warnings)
            status = "partial" if not result.complete else "available"
            if not options:
                status = "no_results"
                warnings.append("No feasible alternatives were found in the searched schedules. Ask the airline for current options.")
            metadata.update(status=status, candidate_count=len(result.candidates), rejected_candidates=rejected,
                            result_count=len(options), complete=result.complete)
            state.alternative_options = [option.model_dump(mode="json") for option in options]
            state.recommended_option = state.alternative_options[0] if options else None
            for option in options:
                state.sources.extend(option.sources)
        except (ValueError, TypeError):
            warnings.append("Recovery airport or timing could not be established from verified flight facts. Confirm your location and onward options with the airline.")
        except (FlightDataUnavailableError, TimeoutError):
            warnings.append("Alternative schedule search is unavailable or timed out. No sample flights were substituted; ask the airline for current options.")
        except Exception:
            # This optional search must not break the assessment or expose provider errors/keys.
            warnings.append("Alternative search could not be completed. Ask the airline for current options.")
        state.alternative_search = {**metadata, "warnings": list(dict.fromkeys(warnings))}
        state.warnings.extend(state.alternative_search["warnings"])
        return self.create_result(
            status="unavailable" if metadata["status"] == "unavailable" else "partial" if metadata["status"] in {"partial", "no_results"} else "success",
            data={"alternative_options": state.alternative_options, "recommended_option": state.recommended_option,
                  "alternative_search": state.alternative_search},
            trace_id=state.trace_id, confidence="low" if metadata["status"] in {"unavailable", "no_results"} else "medium",
            warnings=state.alternative_search["warnings"],
        )
