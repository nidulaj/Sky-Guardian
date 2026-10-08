import { API_BASE_URL } from '@/lib/api/client';

/** Mirrors backend/app/schemas/airport.py */
export interface Airport {
  iata: string;
  icao?: string | null;
  name: string;
  city: string;
  country: string;
  timezone: string;
  latitude: number;
  longitude: number;
  major: boolean;
}

const byCode = new Map<string, Airport | null>();

/** Airport suggestions for a city, airport name or code, e.g. "colombo" -> CMB first. */
export async function searchAirports(query: string, signal?: AbortSignal): Promise<Airport[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const res = await fetch(`${API_BASE_URL}/api/airports/search?q=${encodeURIComponent(q.slice(0, 64))}&limit=8`, { signal });
  if (!res.ok) return [];
  const airports: Airport[] = await res.json();
  airports.forEach((a) => byCode.set(a.iata, a));
  return airports;
}

/** Look up one airport by IATA code (cached). Returns null when the code doesn't exist. */
export async function getAirport(code: string, signal?: AbortSignal): Promise<Airport | null> {
  const key = code.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(key)) return null;
  if (byCode.has(key)) return byCode.get(key) ?? null;
  // Use search (always 200) rather than /api/airports/{code}, so half-typed city names like "COL" don't log 404s
  const res = await fetch(`${API_BASE_URL}/api/airports/search?q=${key}&limit=1`, { signal });
  if (!res.ok) return null;
  const [first]: Airport[] = await res.json();
  const airport = first?.iata === key ? first : null;
  byCode.set(key, airport);
  return airport;
}
