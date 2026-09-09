export interface FlightLegInput {
  flight_number: string;
  travel_date: string;
  origin: string;
  destination: string;
}

export interface RiskSummary {
  score: number;
  level: 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH';
  is_probability: boolean;
  flight_score: number;
  connection_score: number;
  weather_score: number;
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
  weather_conditions: any[];
  policy_evidence: any[];
  alternatives: any[];
  recommendation: string;
  sources: any[];
  warnings: string[];
  is_demo_data: boolean;
  last_updated: string;
}
