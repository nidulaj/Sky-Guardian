"""
Airport reference data: validate IATA codes, show airport names/cities, resolve IANA timezones and
search airports by city, name or code ("colombo" -> CMB).

Data: the airportsdata package (MIT licence), loaded once into memory (~7,900 airports with IATA codes).
"""
from app.schemas.airport import Airport
from functools import lru_cache
from typing import Dict, List, Optional
import re
import unicodedata

import airportsdata

# Busy commercial airports, ranked first when several airports share a city (e.g. CMB before RML for
# "Colombo"). Hand-picked from the world's major passenger hubs plus South Asia, where most users start.
MAJOR_AIRPORTS = {
    # South Asia
    "CMB", "HRI", "JAF", "MLE", "DEL", "BOM", "MAA", "BLR", "HYD", "CCU", "COK", "TRV", "AMD", "GOI",
    "DAC", "CGP", "KTM", "KHI", "LHE", "ISB",
    # Southeast and East Asia
    "SIN", "KUL", "BKK", "DMK", "HKT", "CGK", "DPS", "MNL", "SGN", "HAN", "RGN", "PNH",
    "HKG", "TPE", "PEK", "PKX", "PVG", "SHA", "CAN", "SZX", "CTU", "ICN", "GMP", "NRT", "HND", "KIX", "NGO",
    # Middle East
    "DXB", "DWC", "AUH", "DOH", "BAH", "MCT", "KWI", "RUH", "JED", "AMM", "TLV", "IST", "SAW",
    # Europe
    "LHR", "LGW", "MAN", "CDG", "ORY", "FRA", "MUC", "BER", "AMS", "MAD", "BCN", "FCO", "MXP", "ZRH", "VIE",
    "CPH", "ARN", "OSL", "HEL", "DUB", "BRU", "LIS", "ATH", "WAW", "PRG",
    # Africa
    "JNB", "CPT", "CAI", "ADD", "NBO", "LOS", "CMN",
    # Oceania
    "SYD", "MEL", "BNE", "PER", "AKL",
    # Americas
    "JFK", "EWR", "LGA", "LAX", "SFO", "ORD", "ATL", "DFW", "DEN", "SEA", "MIA", "BOS", "IAD", "YYZ",
    "YVR", "YUL", "MEX", "GRU", "EZE", "BOG", "LIM", "SCL",
}

# airportsdata lists some major airports under a suburb; show and search them by the city they serve
CITY_OVERRIDES = {
    "IST": "Istanbul", "EZE": "Buenos Aires", "YYZ": "Toronto", "YVR": "Vancouver", "YUL": "Montreal",
    "NGO": "Nagoya", "DWC": "Dubai", "GOI": "Goa",
}

# Closed to scheduled passenger flights: still valid codes for lookups, never suggested in search
CLOSED_AIRPORTS = {"TXL", "ISL"}

_NAME_FIXES = [
    (r"\bIntl\b\.?", "International"),
    (r"\bInt\b\.?", "International"),
    (r"\bArpt\b\.?", "Airport"),
    (r"\bApt\b\.?", "Airport"),
]


def _clean_name(name: str) -> str:
    """Expand abbreviations in airportsdata names and drop a duplicated trailing 'Airport'."""
    for pattern, replacement in _NAME_FIXES:
        name = re.sub(pattern, replacement, name)
    name = re.sub(r"\s+", " ", name).strip()
    if name.count("Airport") > 1 and name.endswith(" Airport"):
        name = name[: -len(" Airport")]
    return name


def _fold(text: str) -> str:
    """Lower-case and strip accents so 'Zürich' matches 'zurich'."""
    normalized = unicodedata.normalize("NFKD", text)
    return "".join(c for c in normalized if not unicodedata.combining(c)).casefold().strip()


@lru_cache(maxsize=1)
def _airports() -> Dict[str, Airport]:
    airports = {}
    for code, row in airportsdata.load("IATA").items():
        if not code or not row.get("tz"):
            continue
        airports[code] = Airport(
            iata=code,
            icao=row.get("icao") or None,
            name=_clean_name(row.get("name") or code),
            city=CITY_OVERRIDES.get(code) or row.get("city") or _clean_name(row.get("name") or code),
            country=row.get("country") or "",
            timezone=row["tz"],
            latitude=row.get("lat") or 0.0,
            longitude=row.get("lon") or 0.0,
            major=code in MAJOR_AIRPORTS,
        )
    return airports


@lru_cache(maxsize=1)
def _search_index() -> List[tuple]:
    return [(a, _fold(a.city), _fold(a.name)) for a in _airports().values() if a.iata not in CLOSED_AIRPORTS]


def get_airport(code: Optional[str]) -> Optional[Airport]:
    if not code:
        return None
    return _airports().get(code.strip().upper())


def airport_timezone(code: Optional[str]) -> Optional[str]:
    airport = get_airport(code)
    return airport.timezone if airport else None


def search_airports(query: str, limit: int = 8) -> List[Airport]:
    """
    Rank airports for a free-text query. Exact IATA code of a major airport first, then city and name matches;
    major airports are boosted so 'colombo' returns CMB before RML, and 'col' (still typing) CMB before
    the little-used COL. An exact code of a minor airport still beats any other minor match.
    """
    q = _fold(query)[:64]
    if len(q) < 2:
        return []

    scored = []
    for airport, city, name in _search_index():
        score = 0
        if airport.iata.casefold() == q:
            score = 1000 if airport.major else 400
        elif city == q:
            score = 500
        elif city.startswith(q):
            score = 320
        elif any(word.startswith(q) for word in name.split()):
            score = 220
        elif q in city:
            score = 120
        elif q in name:
            score = 90
        if score:
            if airport.major:
                score += 150
            if "international" in name:
                score += 15
            scored.append((score, airport.iata, airport))

    scored.sort(key=lambda item: (-item[0], item[1]))
    return [airport for _, _, airport in scored[: max(1, min(limit, 20))]]
