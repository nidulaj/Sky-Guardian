import { AirportWeatherResult } from '@/types/weather';

export interface FlightLegInput {
  flight_number: string;
  travel_date: string;
  origin: string;
  destination: string;
}

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH';

// Mirrors backend/app/schemas/risk.py RiskComponent.
export interface RiskComponent {
  status: 'available' | 'missing' | 'not_applicable';
  score: number | null;
  level: RiskLevel | null;
  confidence: number;
  reason: string | null;
  details: Record<string, any>;
}

export interface RiskSummary {
  score: number;
  level: RiskLevel;
  is_probability: boolean;
  flight_score: number;
  connection_score: number;
  /** null when no weather data was available — never a default score. */
  weather_score: number | null;
  status?: 'complete' | 'partial';
  confidence?: number | null;
  confidence_label?: 'high' | 'medium' | 'low' | 'unknown' | null;
  components?: Record<string, RiskComponent>;
  weights?: Record<string, number>;
  effective_weights?: Record<string, number>;
  missing_data?: string[];
  uncertainty?: string[];
}

export interface ConnectionSummary {
  available_minutes: number;
  minimum_required_minutes: number;
  buffer_minutes: number;
  status: 'SAFE' | 'MODERATE_RISK' | 'HIGH_RISK' | 'LIKELY_MISSED' | 'MISSED' | 'UNKNOWN';
  reason_codes: string[];
}

export interface JourneyAnalysisResponse {
  journey_id: string;
  trace_id: string;
  journey_status: string;
  risk: RiskSummary;
  primary_issue: string;
  connection?: ConnectionSummary;
  flight_statuses: any[];
  weather_conditions: AirportWeatherResult[];
  policy_evidence: any[];
  alternatives: any[];
  recommendation: string;
  sources: any[];
  warnings: string[];
  is_demo_data: boolean;
  last_updated: string;
}
