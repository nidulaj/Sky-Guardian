import { FlightLegInput, JourneyAnalysisResponse } from '@/types/journey';
import { LoginPayload, RegisterPayload, TokenResponse, UserProfile } from '@/types/auth';
import { AskQuestionResponse, RAGDocument, RAGStats } from '@/types/rag';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/** Error thrown by the API client. `message` is safe to show to users. */
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
  first_name: 'first name',
  last_name: 'last name',
  phone_number: 'phone number',
  confirm_password: 'confirm password',
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

/** Read FastAPI's `detail` into one readable sentence. */
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

async function handleResponse<T>(res: Response, fallbackMessage: string): Promise<T> {
  if (!res.ok) {
    let detail: string | null = null;
    try {
      const body = await res.json();
      detail = detailMessage(body?.detail);
    } catch {
      // not JSON
    }
    if (res.status === 422) {
      throw new ApiError(detail ? `Validation error: ${detail}.` : 'Please check your inputs and try again.', 422);
    }
    throw new ApiError(detail ?? fallbackMessage, res.status);
  }
  return res.json();
}

/* ============================================================
   JOURNEY API
============================================================ */

export async function analyzeJourney(legs: FlightLegInput[], language = 'en', requestAlternatives = false): Promise<JourneyAnalysisResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/journeys/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language, legs, ...(requestAlternatives ? { request_alternatives: true } : {}) }),
    });
  } catch {
    throw new ApiError('We could not reach the SkyGuardian server. Check your connection and try again.');
  }

  return handleResponse<JourneyAnalysisResponse>(response, 'Failed to analyze journey.');
}

export async function checkBackendHealth() {
  const response = await fetch(`${API_BASE_URL}/api/health`);
  return response.json();
}

/* ============================================================
   AUTHENTICATION API
============================================================ */

export async function registerApi(payload: RegisterPayload): Promise<TokenResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new ApiError('Cannot connect to authentication service.');
  }
  return handleResponse<TokenResponse>(response, 'Registration failed.');
}

export async function loginApi(payload: LoginPayload): Promise<TokenResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new ApiError('Cannot connect to authentication service.');
  }
  return handleResponse<TokenResponse>(response, 'Login failed. Please check your email and password.');
}

export async function getMeApi(token: string): Promise<UserProfile> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
    });
  } catch {
    throw new ApiError('Cannot verify user session.');
  }
  return handleResponse<UserProfile>(response, 'Failed to fetch user profile.');
}

/* ============================================================
   RAG & KNOWLEDGE BASE API (Passenger & Admin)
============================================================ */

export async function askRagQuestion(
  question: string,
  top_k = 3,
  similarity_threshold = 0.20,
  airline?: string,
  options?: { enable_web_fallback?: boolean; force_web_search?: boolean; airline_code?: string }
): Promise<AskQuestionResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/rag/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        top_k,
        similarity_threshold,
        airline,
        enable_web_fallback: options?.enable_web_fallback ?? true,
        force_web_search: options?.force_web_search ?? false,
        airline_code: options?.airline_code,
      }),
    });
  } catch {
    throw new ApiError('Cannot connect to RAG knowledge service.');
  }
  return handleResponse<AskQuestionResponse>(response, 'Failed to answer question.');
}

export async function getRAGDocuments(): Promise<RAGDocument[]> {
  const response = await fetch(`${API_BASE_URL}/api/rag/documents`);
  return handleResponse<RAGDocument[]>(response, 'Failed to list documents.');
}

export async function uploadRAGDocument(formData: FormData, token?: string): Promise<any> {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/rag/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });
  } catch {
    throw new ApiError('Failed to upload document to server.');
  }
  return handleResponse(response, 'Failed to upload document.');
}

export async function deleteRAGDocument(docId: string, token?: string): Promise<any> {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/rag/documents/${docId}`, {
      method: 'DELETE',
      headers,
    });
  } catch {
    throw new ApiError('Failed to delete document.');
  }
  return handleResponse(response, 'Failed to delete document.');
}

export async function getRAGStats(): Promise<RAGStats> {
  const response = await fetch(`${API_BASE_URL}/api/rag/stats`);
  return handleResponse<RAGStats>(response, 'Failed to fetch knowledge base stats.');
}
