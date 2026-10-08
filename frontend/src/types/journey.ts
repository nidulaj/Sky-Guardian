// Mirrors backend/app/schemas/journey.py (JourneyAnalysisResponse and friends)
import type { FlightResult, ConnectionStatus } from './flight';
import type { AirportWeatherResult } from './weather';

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

export type RiskComponentName = 'flight' | 'connection' | 'weather';

// Mirrors backend/app/schemas/risk.py RiskFactor.
export interface RiskFactor {
  factor: string;
  component: RiskComponentName;
  /** Component score 0-100. */
  impact: number;
  /** Weighted points this component adds to the journey score. */
  contribution: number;
  reason: string;
}

// Mirrors backend/app/schemas/journey.py RiskSummary (Risk Agent output).
export interface RiskSummary {
  /** Weighted 0-100 decision-support score. Not a probability. null when nothing could be scored. */
  score: number | null;
  level: RiskLevel | 'UNKNOWN';
  is_probability: false;
  /** Component scores are null when that agent's data is unavailable — never a default 0. */
  flight_score: number | null;
  connection_score: number | null;
  weather_score: number | null;
  status?: 'complete' | 'partial' | 'insufficient_data';
  confidence?: number | null;
  confidence_label?: 'high' | 'medium' | 'low' | 'unknown' | null;
  components?: Partial<Record<RiskComponentName, RiskComponent>>;
  /** Configured weights (config/risk.yaml). */
  weights?: Partial<Record<RiskComponentName, number>>;
  /** Weights actually applied after leaving out missing / not-applicable components. */
  effective_weights?: Partial<Record<RiskComponentName, number>>;
  weighted_score?: number | null;
  applied_overrides?: string[];
  level_thresholds?: Record<string, number>;
  missing_data?: string[];
  uncertainty?: string[];
  top_factors?: RiskFactor[];
  explanation?: string[];
  warnings?: string[];
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
  /** Weather Agent results (AirportWeatherResult) plus the legacy WeatherCondition keys. */
  weather_conditions: (AirportWeatherResult & WeatherCondition)[];
  policy_evidence: PolicyEvidence[];
  alternatives: AlternativeOption[];
  recommendation: string;
  sources: SourceRef[];
  warnings: string[];
  is_demo_data: boolean;
  last_updated: string;
}
