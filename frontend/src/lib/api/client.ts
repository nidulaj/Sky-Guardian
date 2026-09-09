import { FlightLegInput, JourneyAnalysisResponse } from '@/types/journey';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function analyzeJourney(legs: FlightLegInput[], language = 'en'): Promise<JourneyAnalysisResponse> {
  const response = await fetch(`${API_BASE_URL}/api/journeys/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      language,
      legs,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to analyze journey: ${response.statusText}`);
  }

  return response.json();
}

export async function checkBackendHealth() {
  const response = await fetch(`${API_BASE_URL}/api/health`);
  return response.json();
}
