// Mirrors backend/app/schemas/flight.py and backend/app/schemas/connection.py

export type FlightStatus =
  | 'SCHEDULED'
  | 'ON_TIME'
  | 'DELAYED'
  | 'DEPARTED'
  | 'LANDED'
  | 'CANCELLED'
  | 'DIVERTED'
  | 'UNKNOWN';

export interface FlightResult {
  flight_number: string;
  airline?: string | null;
  origin: string;
  destination: string;
  scheduled_departure?: string | null;
  estimated_departure?: string | null;
  actual_departure?: string | null;
  scheduled_arrival?: string | null;
  estimated_arrival?: string | null;
  actual_arrival?: string | null;
  status: FlightStatus;
  delay_minutes: number;
  terminal?: string | null;
  gate?: string | null;
  source: string;
  retrieved_at: string;
  reason_codes?: string[];
}

export type ConnectionStatus = 'SAFE' | 'MODERATE_RISK' | 'HIGH_RISK' | 'LIKELY_MISSED' | 'MISSED' | 'UNKNOWN';
