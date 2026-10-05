import { FlightLegInput, JourneyAnalysisResponse } from '@/types/journey';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/** Error thrown by the API client. `message` is safe to show to people. */
export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const FIELD_LABELS: Record<string, string> = {
  flight_number: 'flight number',
  travel_date: 'travel date',
  origin: 'departure airport',
  destination: 'arrival airport',
  legs: 'flights',
  language: 'language',
};

/** Turn a FastAPI validation location like ['body','legs',0,'origin'] into "Flight 1, departure airport". */
function describeLocation(loc: unknown): string {
  if (!Array.isArray(loc)) return '';
  const parts: string[] = [];
  for (let i = 0; i < loc.length; i++) {
    const part = loc[i];
    if (part === 'body' || part === 'query') continue;
    if (part === 'legs' && typeof loc[i + 1] === 'number') {
      parts.push(`Flight ${(loc[i + 1] as number) + 1}`);
      i++;
      continue;
    }
    if (typeof part === 'string') parts.push(FIELD_LABELS[part] ?? part.replace(/_/g, ' '));
  }
  return parts.join(', ');
}

/** Read FastAPI's `detail` (string or list of validation errors) into one readable sentence. */
function detailMessage(detail: unknown): string | null {
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const lines = detail
      .map((d) => {
        if (!d || typeof d !== 'object') return null;
        const item = d as { loc?: unknown; msg?: unknown };
        const where = describeLocation(item.loc);
        const msg = typeof item.msg === 'string' ? item.msg : 'is not valid';
        return where ? `${where}: ${msg}` : msg;
      })
      .filter(Boolean);
    return lines.length ? lines.join('. ') : null;
  }
  return null;
}

export async function analyzeJourney(legs: FlightLegInput[], language = 'en'): Promise<JourneyAnalysisResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/journeys/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language, legs }),
    });
  } catch {
    throw new ApiError('We could not reach the SkyGuardian server. Check your connection and try again in a moment.');
  }

  if (!response.ok) {
    let detail: string | null = null;
    try {
      const body = await response.json();
      detail = detailMessage(body?.detail);
    } catch {
      // Body was not JSON; fall back to the status text below.
    }
    if (response.status === 422) {
      throw new ApiError(detail ? `Some details need fixing. ${detail}.` : 'Some journey details were not accepted. Check each flight and try again.', 422);
    }
    throw new ApiError(
      detail ?? `The server could not check this journey (${response.status}${response.statusText ? ` ${response.statusText}` : ''}). Please try again.`,
      response.status,
    );
  }

  return response.json();
}

export async function checkBackendHealth() {
  const response = await fetch(`${API_BASE_URL}/api/health`);
  return response.json();
}
