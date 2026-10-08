# Alternative Agent

Implementation branch: `feature/savi-alternative-agent`, based on `origin/dev`.
Integrated with the voice feature and latest `dev` dashboard changes at the user's request.
The combined app lives in the original project folder. `/dashboard` contains the flight
form, compact alternative results, optional voice bubble and existing policy assistant;
the old `/journeys/new` URL redirects to this dashboard.
The final blueprint lists Alternative Agent under Nidula; coordinate ownership before merging.

## Scope

Replaces the two hardcoded September itineraries with a recovery-location decision,
bounded schedule search, feasibility filters and configurable deterministic ranking.
The Supervisor invokes it after policy retrieval when recovery is required.
Outputs remain in `JourneyState.alternative_options` and `recommended_option`; the API
also exposes `alternative_search` status, scope, time, rejected counts and warnings.
Nothing books, cancels, pays, or reserves seats. No LLM/API key is needed for ranking.

## Configuration

```dotenv
ALTERNATIVE_PROVIDER=auto
# Optional override; default is <repo>/config/ranking.yaml
# RANKING_CONFIG_PATH=/absolute/path/to/ranking.yaml
```

`auto` selects sample search only when the flight configuration is explicitly in mock
mode. Otherwise it prefers AeroDataBox when `AERODATABOX_API_KEY` is configured, then
AviationStack with `FLIGHT_API_KEY`. Explicit `aerodatabox` and `aviationstack` select
that provider without switching to another; `mock` forces labelled sample schedules.
Provider failures, denied plan access and missing keys never fall back to sample flights.
Both adapters share their existing SQLite cache and provider quota counters. AeroDataBox
uses FIDS airport departures with `withLeg=true`, excludes cargo/private/codeshares,
and requests at most eight 12-hour windows, visiting each configured airport in turn.
Unverified timestamps and unsupported daylight-saving boundaries are rejected.
The user's configured AeroDataBox key passed a Colombo departure check and a bounded
Colombo-to-Chennai search, producing three ranked schedules with unknown seats/fares.
AviationStack real-time access worked, but date-filtered access returned
`function_access_restricted` on the supplied subscription. No paid upgrade is assumed.

Search supports direct and one-stop routes, at most two configured transfer airports,
a 48-hour departure window, eight provider calls, 200 candidates and three ranked results.
Each departure response is limited to its first 100 records; actual coverage within
the 48-hour horizon depends on the eight-request budget and selected airports.
It is not an exhaustive route engine, future-schedule guarantee or inventory service;
availability depends on the provider's plan/date coverage. Results disclose these limits.
Reference: [AviationStack filtering](https://aviationstack.com/faq).
AeroDataBox contract: [official RapidAPI OpenAPI specification](https://doc.aerodatabox.com/docs/openapi-rapidapi-v1.json).

## Decisions And Guardrails

- Recover at the first disrupted connection or cancelled leg's origin, never at an
  airport reachable only through an earlier missed connection.
- Earliest departure uses expected arrival plus the configured connection minimum
  and safety margin, or the original departure, bounded by now plus boarding buffer.
- Ambiguous/diverted locations require airline confirmation; no location is invented.
- Reject departed/cancelled/diverted/unknown flights, stale/missing/unverified times,
  mismatched airports, loops, excessive duration and inadequate transfer margins.
- Reuse the existing Connection and Risk calculators for feasible candidate schedules.
  Original-trip weather is not reused for different times/routes; risk confidence falls.
- Rank normalized risk, arrival quality, duration, stops and connection buffer using
  `config/ranking.yaml`. Higher scores are preferred; arrival/departure/ID break ties.
- Return factor values, weights, configuration version and reasons. Personal attributes
  are not search/ranking inputs; schema rejects extra fields.
- Fares, seats and ticket-specific policy eligibility remain `UNKNOWN`. A policy document
  alone cannot establish an individual ticket's entitlement. No cost/eligibility bonus is used.
- Recovery text no longer calls an option guaranteed/safest or promises free rebooking.
- Compact UI shows the top match, airport-local times (UTC fallback), duration/stops,
  flight numbers and short uncertainty/transfer notices. Sample schedules stay labelled.
  Full legs, reasons, warnings, sources and scores are in closed "Flight details";
  search assumptions and limits are in closed "Search limits & notes".

## Verification

Run backend tests with isolated mock providers and memory knowledge storage:

```sh
cd backend
USE_MOCK_FLIGHTS=true FLIGHT_PROVIDER=mock WEATHER_PROVIDER=mock \
SUPABASE_URL= SUPABASE_SERVICE_ROLE_KEY= KNOWLEDGE_STORE_BACKEND=memory \
python -m pytest -q
```

Frontend: `npm test -- --run`, `npx tsc --noEmit`, `npm run build`.
The combined local preview uses backend port 8002 and frontend port 3002, with the original
ignored backend/.env. `ALTERNATIVE_PROVIDER=auto` prefers its existing AeroDataBox key;
the voice and weather settings are preserved. Browser layout tests use isolated mock
providers, without spending API quota or touching production database data.
Existing `dev` RAG display field names and frontend test fixtures were corrected to let
the new branch compile and run its full test suite independently; no voice code was copied.
Real provider access and human confirmation of terminal/immigration/baggage requirements
remain deployment acceptance checks. Authentication/history, Policy/RAG and the rest of
the final blueprint are separate workstreams, not implemented by this branch.
