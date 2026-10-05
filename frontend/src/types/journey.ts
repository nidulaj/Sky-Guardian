// Mirrors backend/app/schemas/journey.py (JourneyAnalysisResponse and friends)
import type { FlightResult, ConnectionStatus } from './flight';

export interface FlightLegInput {
  flight_number: string;
  travel_date: string;
  origin: string;
  destination: string;
}

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH';

export interface RiskSummary {
  /** Weighted 0-100 decision-support score. Not a probability. */
  score: number;
  level: RiskLevel;
  is_probability: boolean;
  flight_score: number;
  connection_score: number;
  weather_score: number;
}

export interface ConnectionSummary {
  available_minutes: number;
  minimum_required_minutes: number;
  buffer_minutes: number;
  status: ConnectionStatus;
  reason_codes: string[];
}

export interface WeatherCondition {
  airport: string;
  condition?: string | null;
  severity?: string | null;
  weather_risk_score?: number | null;
  warnings?: string[];
  source?: string | null;
  timestamp?: string | null;
}

export interface PolicyEvidence {
  policy_id?: string;
  airline?: string | null;
  policy_type?: string | null;
  title?: string | null;
  source_url?: string | null;
  snippet?: string | null;
  effective_date?: string | null;
  last_verified?: string | null;
  confidence?: string | null;
}

export interface AlternativeOption {
  rank: number;
  option_id?: string;
  route_summary: string;
  departure?: string | null;
  arrival?: string | null;
  duration_minutes?: number | null;
  connections?: number | null;
  risk_score?: number | null;
  risk_level?: string | null;
  price?: string | null;
  policy_eligibility?: string | null;
  ranking_score?: number | null;
  ranking_reasons?: string[];
  warnings?: string[];
}

export interface SourceRef {
  name: string;
  type?: string | null;
  verified?: boolean;
  url?: string | null;
}

export interface JourneyAnalysisResponse {
  journey_id: string;
  trace_id: string;
  journey_status: string;
  risk: RiskSummary;
  primary_issue: string;
  connection?: ConnectionSummary | null;
  flight_statuses: FlightResult[];
  weather_conditions: WeatherCondition[];
  policy_evidence: PolicyEvidence[];
  alternatives: AlternativeOption[];
  recommendation: string;
  sources: SourceRef[];
  warnings: string[];
  is_demo_data: boolean;
  last_updated: string;
}
