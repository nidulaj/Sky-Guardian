'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { Airport, getAirport, searchAirports } from '@/lib/api/airports';

interface AirportAutocompleteProps {
  id: string;
  /** Selected IATA code ('' when nothing is chosen). */
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  align?: 'left' | 'right';
  invalid?: boolean;
  describedBy?: string;
}

const isCode = (text: string) => /^[A-Za-z]{3}$/.test(text.trim());

/**
 * Airport field that accepts a city, airport name or code. Typing "colombo" suggests CMB (Colombo);
 * picking a suggestion stores the 3-letter IATA code. Follows the WAI-ARIA combobox pattern.
 */
export default function AirportAutocomplete({
  id, value, onChange, placeholder, align = 'left', invalid, describedBy,
}: AirportAutocompleteProps) {
  const listId = useId();
  const [query, setQuery] = useState(value);
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Airport[]>([]);
  const [resultsFor, setResultsFor] = useState(''); // the text the current suggestions answer
  const [active, setActive] = useState(-1);
  const [selected, setSelected] = useState<Airport | null>(null);
  const [searching, setSearching] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout>>();
  const emitted = useRef(value); // last code this field reported, to tell outside changes apart

  // Keep the text in sync when the code changes from outside (demo journeys, add/remove leg)
  useEffect(() => {
    if (value !== emitted.current) {
      emitted.current = value;
      setQuery(value);
    }
  }, [value]);

  const emit = (code: string) => {
    emitted.current = code;
    onChange(code);
  };

  // Resolve the selected code to a city/name for the caption under the field
  useEffect(() => {
    if (!value) {
      setSelected(null);
      return;
    }
    if (selected?.iata === value) return;
    const controller = new AbortController();
    getAirport(value, controller.signal).then(setSelected).catch(() => undefined);
    return () => controller.abort();
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search while typing
  useEffect(() => {
    if (!focused) return;
    const q = query.trim();
    if (q.length < 2 || (selected && q.toUpperCase() === selected.iata)) {
      setResults([]);
      setOpen(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const found = await searchAirports(q, controller.signal);
        setResults(found);
        setResultsFor(q);
        setActive(found.length ? 0 : -1);
        setOpen(true);
      } catch {
        /* aborted or offline: keep previous suggestions */
      } finally {
        setSearching(false);
      }
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, focused]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (airport: Airport) => {
    setSelected(airport);
    setQuery(airport.iata);
    setOpen(false);
    setResults([]);
    setResultsFor('');
    emit(airport.iata);
  };

  const onInput = (text: string) => {
    setQuery(text);
    // A typed 3-letter code is accepted directly; any other text waits for a pick from the list.
    emit(isCode(text) ? text.trim().toUpperCase() : '');
  };

  // The highlighted suggestion, only if the list answers what is in the field now (not a stale search)
  const current = open && resultsFor === query.trim() && active >= 0 ? results[active] : undefined;

  // Enter, Tab or click-away: take the highlighted suggestion if the list is up to date ('col' -> CMB);
  // otherwise a typed 3-letter code stays as typed (the list hasn't caught up, e.g. 'DEL' typed quickly)
  const commit = () => {
    if (current) {
      choose(current);
      return true;
    }
    if (isCode(query)) {
      const typed = query.trim().toUpperCase();
      const match = results.find((a) => a.iata === typed);
      if (match) choose(match);
      else setQuery(typed);
      return true;
    }
    return false;
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open && results.length) setOpen(true);
      setActive((i) => (results.length ? (i + 1) % results.length : -1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (results.length ? (i - 1 + results.length) % results.length : -1));
    } else if (e.key === 'Enter' && open) {
      if (commit()) e.preventDefault();
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      setOpen(false);
    }
  };

  const showing = focused || !value ? query : value;
  const long = showing.trim().length > 3;
  const right = align === 'right';
  const listOpen = open && results.length > 0;
  const activeId = listOpen && active >= 0 ? `${listId}-opt-${active}` : undefined;

  return (
    <div className="relative">
      <input
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={listOpen}
        aria-controls={listOpen ? listId : undefined}
        aria-activedescendant={activeId}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        value={showing}
        onChange={(e) => onInput(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => {
          clearTimeout(blurTimer.current);
          setFocused(true);
          if (results.length) setOpen(true);
        }}
        onBlur={() => {
          blurTimer.current = setTimeout(() => {
            commit();
            setFocused(false);
            setOpen(false);
          }, 120);
        }}
        maxLength={64}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className={`display mt-1 w-full min-w-0 bg-transparent text-ink placeholder:text-ink/20 border-b-2 border-dashed pb-1 rounded-none focus:outline-none focus:border-solid focus:border-ink transition-[font-size,border-color] ${
          right ? 'text-right' : ''
        } ${long ? 'text-2xl sm:text-3xl py-3' : 'uppercase text-[3.25rem] sm:text-6xl'} ${
          invalid ? 'border-status-danger' : 'border-ink/20 hover:border-ink/40'
        }`}
      />

      <p className={`mt-1.5 min-h-[1.25rem] truncate text-sm text-ink-muted ${right ? 'text-right' : ''}`}>
        {selected ? [selected.city || selected.name, selected.country].filter(Boolean).join(', ') : focused ? 'City, airport or code' : ' '}
      </p>

      <p className="sr-only" aria-live="polite">
        {open && !searching ? (results.length ? `${results.length} airports found` : 'No airports found') : ''}
      </p>

      {open && !searching && results.length === 0 && (
        <div
          className={`absolute z-30 mt-1 w-[min(22rem,calc(100vw-3rem))] rounded-2xl border border-ink/15 bg-sand-50 px-4 py-3 text-sm text-ink-muted shadow-[0_18px_40px_-20px_rgba(26,23,20,0.45)] ${
            right ? 'right-0' : 'left-0'
          }`}
        >
          No airport matches “{query.trim()}”. Try the city name.
        </div>
      )}

      {listOpen && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Airport suggestions"
          className={`absolute z-30 mt-1 max-h-80 w-[min(22rem,calc(100vw-3rem))] overflow-auto rounded-2xl border border-ink/15 bg-sand-50 p-1.5 shadow-[0_18px_40px_-20px_rgba(26,23,20,0.45)] ${
            right ? 'right-0' : 'left-0'
          }`}
        >
          {results.map((airport, index) => (
            <li
              key={airport.iata}
              id={`${listId}-opt-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(airport)}
              onMouseEnter={() => setActive(index)}
              className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left ${
                index === active ? 'bg-ink text-sand-50' : 'text-ink hover:bg-ink/5'
              }`}
            >
              <span className="w-12 shrink-0 font-sans text-lg font-semibold tracking-tight">{airport.iata}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {airport.city || airport.name}
                  {airport.country && (
                    <span className={index === active ? 'text-sand-50/70' : 'text-ink-muted'}> · {airport.country}</span>
                  )}
                </span>
                <span className={`block truncate text-xs ${index === active ? 'text-sand-50/75' : 'text-ink-muted'}`}>
                  {airport.name}
                </span>
              </span>
              {airport.major && <MapPin className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
