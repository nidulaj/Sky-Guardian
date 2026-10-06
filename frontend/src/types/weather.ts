// Mirrors backend/app/schemas/weather.py (AirportWeatherResult) and app/airports.py.

export type WeatherRiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH';

export interface Airport {
  code: string;
  name: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
}

export interface WeatherAlert {
  event: string;
  severity: 'advisory' | 'warning' | 'severe';
  headline?: string | null;
}

export interface WeatherObservation {
  airport: string;
  forecast_time: string | null;
  condition_text: string | null;
  weather_code: number | null;
  temperature_c: number | null;
  precipitation_mm_per_hr: number | null;
  wind_speed_kt: number | null;
  wind_gust_kt: number | null;
  visibility_km: number | null;
  thunderstorm: 'NONE' | 'POSSIBLE' | 'ACTIVE' | null;
  snow_ice: 'NONE' | 'LIGHT' | 'HEAVY' | 'FREEZING' | null;
  alerts: WeatherAlert[] | null;
  source: string;
  is_mock: boolean;
  retrieved_at: string;
}

export interface WeatherFactors {
  rain: boolean;
  strong_wind: boolean;
  thunderstorm: boolean;
  low_visibility: boolean;
  snow_ice: boolean;
  severe_alert: boolean;
}

export interface AirportWeatherResult {
  airport: string;
  status: 'available' | 'unavailable';
  roles: string[];
  weather_risk: WeatherRiskLevel | null;
  weather_score: number | null;
  conditions: string[];
  factors: WeatherFactors | null;
  component_scores: Record<string, number>;
  observation: WeatherObservation | null;
  forecast_window: string | null;
  source: string;
  is_mock: boolean;
  confidence: number;
  missing_data: string[];
  warnings: string[];
  retrieved_at: string | null;
}
