'use client';

import React, { useEffect, useRef } from 'react';
import { ArrowRight, ArrowUpRight, Plane, Plus, Trash2 } from 'lucide-react';
import Barcode from '@/components/ui/Barcode';
import type { FlightLegInput } from '@/types/journey';
import { formatTravelDate } from '@/lib/flightTime';
import { LegErrors, LegField, normaliseAirport, routeCodes } from './validation';

export const MAX_LEGS = 6;
export const DEFAULT_TRAVEL_DATE = '2026-09-15';

export function fieldId(index: number, field: LegField) {
  return `leg-${index}-${field}`;
}

const FIELD_NAMES: Record<LegField, string> = {
  origin: 'From',
  destination: 'To',
  flight_number: 'Flight number',
  travel_date: 'Travel date',
};

interface BoardingPassFormProps {
  legs: FlightLegInput[];
  errors: LegErrors[];
  /** Short summary shown in the stub when validation fails. */
  formError?: string | null;
  loading: boolean;
  onChange: (legs: FlightLegInput[]) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

function describedBy(index: number, field: LegField, hasError: boolean, help?: string) {
  const ids = [hasError ? `${fieldId(index, field)}-error` : null, help].filter(Boolean);
  return ids.length ? ids.join(' ') : undefined;
}

export default function BoardingPassForm({ legs, errors, formError, loading, onChange, onSubmit }: BoardingPassFormProps) {
  const addButtonRef = useRef<HTMLButtonElement>(null);
  // Set by add/remove so focus only moves after those actions (not after loading a demo journey).
  const pendingFocus = useRef<'added' | 'removed' | null>(null);

  useEffect(() => {
    const action = pendingFocus.current;
    pendingFocus.current = null;
    if (action === 'added') {
      const i = legs.length - 1;
      const target = legs[i]?.origin ? fieldId(i, 'destination') : fieldId(i, 'origin');
      document.getElementById(target)?.focus();
    } else if (action === 'removed') {
      addButtonRef.current?.focus();
    }
  }, [legs]);

  const update = (index: number, field: LegField, value: string) => {
    onChange(legs.map((leg, i) => (i === index ? { ...leg, [field]: value } : leg)));
  };

  const addLeg = () => {
    if (legs.length >= MAX_LEGS) return;
    const last = legs[legs.length - 1];
    pendingFocus.current = 'added';
    onChange([
      ...legs,
      {
        flight_number: '',
        travel_date: last?.travel_date || DEFAULT_TRAVEL_DATE,
        origin: last?.destination ?? '',
        destination: '',
      },
    ]);
  };

  const removeLeg = (index: number) => {
    if (legs.length <= 1) return;
    pendingFocus.current = 'removed';
    onChange(legs.filter((_, i) => i !== index));
  };

  const codes = routeCodes(legs);
  const firstDate = formatTravelDate(legs[0]?.travel_date);
  const connections = Math.max(legs.length - 1, 0);

  return (
    <form onSubmit={onSubmit} noValidate aria-labelledby="pass-title">
      <div className="flex flex-col md:flex-row lg:flex-col">
        {/* Pass body */}
        <div className="flex-1 min-w-0 bg-sand-50 border border-ink/10 rounded-t-3xl md:rounded-tr-none md:rounded-l-3xl lg:rounded-bl-none lg:rounded-t-3xl px-5 pt-5 pb-6 sm:px-7 sm:pt-6">
          <div className="flex items-center justify-between gap-4 border-b border-ink/15 pb-4">
            <h2 id="pass-title" className="eyebrow">
              SkyGuardian / Journey check
            </h2>
            <p className="eyebrow">
              {legs.length} {legs.length === 1 ? 'flight' : 'flights'}
            </p>
          </div>

          {legs.map((leg, i) => {
            const legErrors = errors[i] ?? {};
            const errorFields = (Object.keys(FIELD_NAMES) as LegField[]).filter((f) => legErrors[f]);
            return (
              <fieldset key={i} className={`min-w-0 pt-5 pb-6 ${i > 0 ? 'border-t border-dashed border-ink/20' : ''}`}>
                <legend className="sr-only">
                  Flight {i + 1} of {legs.length}
                </legend>

                <div className="flex min-h-11 items-center justify-between gap-3">
                  <p className="eyebrow">
                    Flight {pad2(i + 1)}
                    {i > 0 && legs[i - 1].destination && (
                      <span className="normal-case tracking-normal font-sans text-sm text-ink-soft ml-2">
                        connects in {legs[i - 1].destination}
                      </span>
                    )}
                  </p>
                  {legs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLeg(i)}
                      aria-label={`Remove flight ${i + 1}`}
                      className="-mr-2 inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-sm text-ink-soft hover:text-status-danger hover:bg-status-danger-bg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Remove
                    </button>
                  )}
                </div>

                {/* Big IATA codes */}
                <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2 sm:gap-4">
                  <div className="min-w-0">
                    <label htmlFor={fieldId(i, 'origin')} className="eyebrow block">
                      From
                    </label>
                    <input
                      id={fieldId(i, 'origin')}
                      value={leg.origin}
                      onChange={(e) => update(i, 'origin', normaliseAirport(e.target.value))}
                      maxLength={3}
                      placeholder="CMB"
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      aria-invalid={legErrors.origin ? true : undefined}
                      aria-describedby={describedBy(i, 'origin', !!legErrors.origin, 'airport-help')}
                      className={`display mt-1 w-full min-w-0 bg-transparent uppercase text-[3.25rem] sm:text-6xl text-ink placeholder:text-ink/20 border-b-2 border-dashed pb-1 rounded-none focus:outline-none focus:border-solid focus:border-ink transition-colors ${
                        legErrors.origin ? 'border-status-danger' : 'border-ink/20 hover:border-ink/40'
                      }`}
                    />
                  </div>

                  <div className="flex items-center gap-1 pb-5 text-coral" aria-hidden="true">
                    <span className="w-4 sm:w-8 border-t border-dashed border-ink/40" />
                    <Plane className="h-5 w-5 fill-current" />
                    <span className="w-4 sm:w-8 border-t border-dashed border-ink/40" />
                  </div>

                  <div className="min-w-0 text-right">
                    <label htmlFor={fieldId(i, 'destination')} className="eyebrow block">
                      To
                    </label>
                    <input
                      id={fieldId(i, 'destination')}
                      value={leg.destination}
                      onChange={(e) => update(i, 'destination', normaliseAirport(e.target.value))}
                      maxLength={3}
                      placeholder="KUL"
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      aria-invalid={legErrors.destination ? true : undefined}
                      aria-describedby={describedBy(i, 'destination', !!legErrors.destination, 'airport-help')}
                      className={`display mt-1 w-full min-w-0 bg-transparent text-right uppercase text-[3.25rem] sm:text-6xl text-ink placeholder:text-ink/20 border-b-2 border-dashed pb-1 rounded-none focus:outline-none focus:border-solid focus:border-ink transition-colors ${
                        legErrors.destination ? 'border-status-danger' : 'border-ink/20 hover:border-ink/40'
                      }`}
                    />
                  </div>
                </div>

                {/* Field row */}
                <div className="mt-5 grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_auto] border-y border-ink/15 divide-x divide-ink/15">
                  <div className="min-w-0 py-3 pr-2 sm:pr-3">
                    <label htmlFor={fieldId(i, 'flight_number')} className="eyebrow block">
                      Flight no.
                    </label>
                    <input
                      id={fieldId(i, 'flight_number')}
                      value={leg.flight_number}
                      onChange={(e) => update(i, 'flight_number', e.target.value.toUpperCase())}
                      maxLength={9}
                      placeholder="UL001"
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      aria-invalid={legErrors.flight_number ? true : undefined}
                      aria-describedby={describedBy(i, 'flight_number', !!legErrors.flight_number)}
                      className={`mt-1.5 h-11 w-full min-w-0 rounded-lg bg-sand-100 border px-2.5 sm:px-3 font-mono text-base uppercase text-ink placeholder:text-ink-muted/60 focus:outline-none focus:border-ink transition-colors ${
                        legErrors.flight_number ? 'border-status-danger' : 'border-ink/15 hover:border-ink/30'
                      }`}
                    />
                  </div>
                  <div className="min-w-0 py-3 px-2 sm:px-3">
                    <label htmlFor={fieldId(i, 'travel_date')} className="eyebrow block">
                      Travel date
                    </label>
                    <input
                      id={fieldId(i, 'travel_date')}
                      type="date"
                      value={leg.travel_date}
                      onChange={(e) => update(i, 'travel_date', e.target.value)}
                      required
                      aria-invalid={legErrors.travel_date ? true : undefined}
                      aria-describedby={describedBy(i, 'travel_date', !!legErrors.travel_date)}
                      className={`mt-1.5 h-11 w-full min-w-0 rounded-lg bg-sand-100 border px-2 sm:px-3 text-base text-ink focus:outline-none focus:border-ink transition-colors ${
                        legErrors.travel_date ? 'border-status-danger' : 'border-ink/15 hover:border-ink/30'
                      }`}
                    />
                  </div>
                  <div className="py-3 pl-2 sm:pl-3 text-right">
                    <p className="eyebrow">Leg</p>
                    <p className="display mt-1.5 flex h-11 items-center justify-end text-3xl text-ink">
                      <span className="sr-only">Leg </span>
                      {pad2(i + 1)}
                    </p>
                  </div>
                </div>

                {errorFields.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {errorFields.map((f) => (
                      <li key={f} id={`${fieldId(i, f)}-error`} className="flex gap-2 text-sm text-status-danger">
                        <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
                        <span>
                          <span className="font-medium">{FIELD_NAMES[f]}:</span> {legErrors[f]}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </fieldset>
            );
          })}

          <p id="airport-help" className="sr-only">
            Three-letter airport code, for example CMB for Colombo.
          </p>

          <button
            ref={addButtonRef}
            type="button"
            onClick={addLeg}
            disabled={legs.length >= MAX_LEGS}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-dashed border-ink/30 text-base text-ink hover:border-ink hover:bg-sand-100 transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add a connecting flight
          </button>
          {legs.length >= MAX_LEGS && (
            <p className="mt-2 text-center text-sm text-ink-muted">You can check up to {MAX_LEGS} flights at a time.</p>
          )}
        </div>

        {/* Perforated stub */}
        <div className="relative md:w-72 md:shrink-0 lg:w-auto bg-coral-deep text-white rounded-b-3xl md:rounded-bl-none md:rounded-r-3xl lg:rounded-tr-none lg:rounded-b-3xl border-t-2 md:border-t-0 md:border-l-2 lg:border-l-0 lg:border-t-2 border-dashed border-white/50 px-5 pt-7 pb-6 sm:px-7">
          <span className="absolute -top-3 -left-3 h-6 w-6 rounded-full bg-sand-200" aria-hidden="true" />
          <span
            className="absolute -top-3 -right-3 md:top-auto md:right-auto md:-bottom-3 md:-left-3 lg:-top-3 lg:-right-3 lg:bottom-auto lg:left-auto h-6 w-6 rounded-full bg-sand-200"
            aria-hidden="true"
          />

          <p className="font-mono text-[11px] uppercase tracking-label text-white">Your route</p>
          <p
            className="display mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-4xl text-white"
            aria-label={`Route: ${codes.join(' to ')}`}
          >
            {codes.map((code, i) => (
              <React.Fragment key={`${code}-${i}`}>
                {i > 0 && <ArrowRight className="h-5 w-5 text-coral-peach" aria-hidden="true" />}
                <span aria-hidden="true">{code}</span>
              </React.Fragment>
            ))}
          </p>

          <dl className="mt-5 border-t border-white/30 pt-4 grid grid-cols-2 gap-y-3 text-sm">
            <dt className="font-mono text-[11px] uppercase tracking-label text-white self-center">Departs</dt>
            <dd className="text-right">{firstDate ?? 'Choose a date'}</dd>
            <dt className="font-mono text-[11px] uppercase tracking-label text-white self-center">Flights</dt>
            <dd className="text-right">{legs.length}</dd>
            <dt className="font-mono text-[11px] uppercase tracking-label text-white self-center">Connections</dt>
            <dd className="text-right">{connections === 0 ? 'Direct' : connections}</dd>
          </dl>

          <Barcode value={codes.join('')} className="mt-5 h-12 w-full text-white" />

          {formError && (
            <p role="alert" className="mt-5 rounded-xl bg-sand-50 px-4 py-3 text-sm text-status-danger">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            aria-busy={loading || undefined}
            className="mt-5 flex h-14 w-full items-center justify-between gap-3 rounded-full bg-sand-50 px-6 text-base font-medium text-coral-deep hover:bg-white transition-colors disabled:opacity-80 disabled:cursor-progress focus-visible:outline-white"
          >
            {loading ? (
              <>
                <span>Checking your journey…</span>
                <span className="h-4 w-4 rounded-full border-2 border-current border-r-transparent animate-spin" aria-hidden="true" />
              </>
            ) : (
              <>
                <span>Check my journey</span>
                <ArrowUpRight className="h-5 w-5" aria-hidden="true" />
              </>
            )}
          </button>
          <p className="mt-3 text-sm text-white">Guidance only. Always confirm changes with your airline.</p>
        </div>
      </div>
    </form>
  );
}
