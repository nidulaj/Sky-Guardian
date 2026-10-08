import type { FlightLegInput } from '@/types/journey';

export type LegField = keyof FlightLegInput;
export type LegErrors = Partial<Record<LegField, string>>;

// Airline code: 2 characters with at least one letter (IATA, e.g. UL, U2, 9W) or 3 letters (ICAO, e.g. ALK),
// then 1-4 digits and an optional suffix letter. Examples: UL001, SQ638, ALK225, U21234A.
const FLIGHT_NUMBER = /^(?:[A-Z]{2}|[A-Z][0-9]|[0-9][A-Z]|[A-Z]{3})[0-9]{1,4}[A-Z]?$/;
const AIRPORT = /^[A-Z]{3}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Uppercase and strip spaces, so "ul 001" becomes "UL001". */
export function normaliseFlightNumber(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
}

export function normaliseAirport(value: string): string {
  return value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3);
}

export function validateLeg(leg: FlightLegInput): LegErrors {
  const errors: LegErrors = {};
  const flight = normaliseFlightNumber(leg.flight_number);

  if (!flight) errors.flight_number = 'Enter the flight number, for example UL001.';
  else if (!FLIGHT_NUMBER.test(flight))
    errors.flight_number = 'Use the airline code and number, for example UL001 or SQ638.';

  if (!leg.origin) errors.origin = 'Enter the 3-letter code of the airport you leave from.';
  else if (!AIRPORT.test(leg.origin)) errors.origin = 'Airport codes have exactly 3 letters, for example CMB.';

  if (!leg.destination) errors.destination = 'Enter the 3-letter code of the airport you fly to.';
  else if (!AIRPORT.test(leg.destination)) errors.destination = 'Airport codes have exactly 3 letters, for example KUL.';
  else if (leg.destination === leg.origin && AIRPORT.test(leg.origin))
    errors.destination = 'The arrival airport must be different from the departure airport.';

  if (!leg.travel_date) errors.travel_date = 'Choose the date this flight departs.';
  else if (!DATE.test(leg.travel_date) || Number.isNaN(new Date(`${leg.travel_date}T00:00:00Z`).getTime()))
    errors.travel_date = 'Enter a valid date.';

  return errors;
}

export function validateLegs(legs: FlightLegInput[]): LegErrors[] {
  return legs.map(validateLeg);
}

export function countErrors(errors: LegErrors[]): number {
  return errors.reduce((n, e) => n + Object.keys(e).length, 0);
}

/** Route codes in travel order, e.g. ['CMB','KUL','NRT']. Inserts both codes when a leg starts somewhere new. */
export function routeCodes(legs: { origin: string; destination: string }[]): string[] {
  const codes: string[] = [];
  legs.forEach((leg, i) => {
    const origin = leg.origin || '···';
    const destination = leg.destination || '···';
    if (i === 0 || codes[codes.length - 1] !== origin) codes.push(origin);
    codes.push(destination);
  });
  return codes;
}
