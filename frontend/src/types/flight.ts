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
  arrival_terminal?: string | null;
  source: string;
  retrieved_at: string;
  reason_codes?: string[];
  /** live: real-time status; timetable: published schedule (no delays yet); demo: sample data; none: no data */
  data_mode?: 'live' | 'timetable' | 'demo' | 'none';
  origin_name?: string | null;
  origin_city?: string | null;
  origin_timezone?: string | null;
  destination_name?: string | null;
  destination_city?: string | null;
  destination_timezone?: string | null;
}

export type ConnectionStatus = 'SAFE' | 'MODERATE_RISK' | 'HIGH_RISK' | 'LIKELY_MISSED' | 'MISSED' | 'UNKNOWN';
