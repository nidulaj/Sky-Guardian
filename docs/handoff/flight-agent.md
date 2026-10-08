# Flight Agent: integration notes

Owner: Savi · Branch: `feature/savi-flight-agent` · For: Sithika (integration), Paramee (Journey Risk) and the team

## What the Flight Agent does

`backend/app/agents/flight_agent.py` answers "what is happening to this flight?" for each leg:
- Validates the flight number, the airport codes (they must exist in the airport database) and the date.
- Gets real data through `FlightDataProvider` (see providers below). Each result says where it came from in
  `data_mode`: `live`, `timetable`, `demo` or `none`, plus `source` and `retrieved_at`.
- Adds `origin_name/city/timezone`, `destination_name/city/timezone` and `arrival_terminal`.
- Never computes risk and never invents data: unknown flights come back as `status: "UNKNOWN"` with a reason code
  (`FLIGHT_NOT_FOUND`, `DATE_NOT_COVERED`, `FLIGHT_DATA_UNAVAILABLE`, `INVALID_*`, `UNKNOWN_AIRPORT`).

## Providers and configuration (`backend/.env`, never committed)

| Setting | Meaning |
|---|---|
| `USE_MOCK_FLIGHTS=true` (default) | Demo data only (`MockFlightProvider`). Teammates without keys keep working. |
| `USE_MOCK_FLIGHTS=false` + `FLIGHT_PROVIDER=auto` | Real data: AeroDataBox first, AviationStack as fallback and for live status where AeroDataBox only has the timetable (e.g. CMB). |
| `AERODATABOX_API_KEY` | RapidAPI key (free Basic plan: 400 units/month, 2 per lookup, non-commercial). |
| `FLIGHT_API_KEY` | AviationStack key (free plan: 100 requests/month). |

- Results are cached in `backend/data/flight_cache.sqlite3` (git-ignored); requests stop before either quota runs out.
- The provider chain answers within 9 s (the Flight Agent waits 10 s); a slow backup never costs the first answer.
- AviationStack is only asked for live status when it can have it (today ± 1 day), and a live answer is used only
  if it is the same departure (route and scheduled time) as the timetable one.
- Demo journeys (UL001, XX123, …) only exist in mock mode.

## API changes (additive, nothing removed)

- `flight_statuses[*]` in `POST /api/journeys/analyze` has the new fields listed above.
- New: `GET /api/airports/search?q=colombo&limit=8` and `GET /api/airports/{code}` (airport autocomplete).
- `backend/app/main.py` registers the airports router (shared file, one line).

## Frontend

`AirportAutocomplete` (type "colombo", get CMB), `FlightStatusCard` (local airport times, live/timetable/demo badge),
`lib/flightTime.ts`, `lib/api/airports.ts`, `types/flight.ts`.

## For Paramee (Journey Risk Agent, connections)

Connection feasibility now belongs to the Journey Risk Agent. Fields from the Flight Agent that help with it:
`arrival_terminal` (inbound) and `terminal` (outbound), `origin_timezone`/`destination_timezone` for local times,
and `data_mode` (a `timetable` result has no delay information yet). `app/providers/airports.py` gives each
airport's country and coordinates (domestic vs international connections, airports in the same city).

## Supervisor integration

The sources list now uses the individual flight/weather results, rather than a hardcoded mock flight source.
Demo sources are not marked verified. `is_demo_data` is derived from returned sample flight or weather data;
the result heading says "Includes demo data" because a real flight can be assessed with mock weather.
Each flight card still distinguishes live status, published timetable and demo data.

## Tests

`backend/tests/unit/` covers the Flight Agent, both real providers, the provider chain and airports. Provider tests
use recorded real API responses in `backend/tests/fixtures/`, so they cost no quota.
