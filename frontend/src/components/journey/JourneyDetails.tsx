import React from 'react';
import { AlertTriangle, ArrowUpRight, Check, CloudSun, Quote } from 'lucide-react';
import Badge, { statusLabel } from '@/components/ui/Badge';
import type { AlternativeOption, PolicyEvidence, SourceRef, WeatherCondition } from '@/types/journey';
import { formatFlightTime, formatMinutes, formatTravelDate } from '@/lib/flightTime';

const pad2 = (n: number) => String(n).padStart(2, '0');

function eligibilityLabel(value: string): string {
  switch (value.toUpperCase()) {
    case 'VERIFIED_ELIGIBLE':
      return 'Eligible (policy found)';
    case 'REQUIRES_AIRLINE_APPROVAL':
      return 'Needs airline approval';
    default:
      return statusLabel(value);
  }
}

function TimeText({ iso }: { iso?: string | null }) {
  const t = formatFlightTime(iso);
  if (!t) return <span className="text-ink-muted">Not given</span>;
  return (
    <>
      <span className="font-semibold text-ink tabular-nums">{t.time}</span>{' '}
      <span className="text-ink-muted">UTC · {t.date}</span>
    </>
  );
}

/* ---------- Weather ---------- */

export function WeatherList({ items }: { items: WeatherCondition[] }) {
  if (items.length === 0) return <p className="text-base text-ink-soft">No weather information was returned for this route.</p>;
  return (
    <ul className="divide-y divide-ink/10 border-y border-ink/10">
      {items.map((w, i) => {
        const severity = (w.severity || 'UNKNOWN').toUpperCase();
        return (
          <li key={`${w.airport}-${i}`} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-4 py-4 sm:grid-cols-[5.5rem_minmax(0,1fr)_auto] sm:items-start">
            <span className="display text-3xl text-ink">{w.airport}</span>
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-base text-ink">
                <CloudSun className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                {w.condition || 'Conditions not reported'}
              </p>
              {(w.warnings ?? []).map((warning, wi) => (
                <p key={wi} className="mt-1.5 flex gap-2 text-sm text-status-caution">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {warning}
                </p>
              ))}
              {w.source && <p className="mt-1 text-sm text-ink-muted">Source: {w.source}</p>}
            </div>
            <div className="col-start-2 mt-2 sm:col-start-auto sm:mt-0">
              <Badge status={severity} label={`${statusLabel(severity)} impact`} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- Alternatives ---------- */

export function AlternativesList({ items }: { items: AlternativeOption[] }) {
  if (items.length === 0) {
    return <p className="text-base text-ink-soft">No alternative routes were needed or found for this journey.</p>;
  }
  const sorted = [...items].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  return (
    <ol className="space-y-4">
      {sorted.map((alt, i) => {
        const top = i === 0;
        return (
          <li
            key={alt.option_id ?? i}
            className={`grid grid-cols-[2.75rem_minmax(0,1fr)] sm:grid-cols-[4rem_minmax(0,1fr)] gap-x-3 sm:gap-x-5 rounded-3xl border p-5 sm:p-6 ${
              top ? 'border-coral/60 bg-sand-50' : 'border-ink/10 bg-sand-100'
            }`}
          >
            <span className="display text-4xl sm:text-5xl font-light text-ink tabular-nums" aria-hidden="true">
              {pad2(alt.rank ?? i + 1)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="sr-only">Option {alt.rank ?? i + 1}.</span>
                {top && <span className="rounded-full bg-ink px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-sand-50">Top ranked</span>}
                {alt.risk_level && <Badge status={alt.risk_level} label={`${statusLabel(alt.risk_level)} risk${alt.risk_score != null ? ` · ${alt.risk_score}/100` : ''}`} />}
                {alt.policy_eligibility && <Badge status={alt.policy_eligibility} label={eligibilityLabel(alt.policy_eligibility)} />}
              </div>
              <h4 className="mt-3 text-lg font-semibold text-ink leading-snug">{alt.route_summary.replace(/\s*->\s*/g, ' → ')}</h4>

              <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                <div>
                  <dt className="eyebrow">Departs</dt>
                  <dd className="mt-1"><TimeText iso={alt.departure} /></dd>
                </div>
                <div>
                  <dt className="eyebrow">Arrives</dt>
                  <dd className="mt-1"><TimeText iso={alt.arrival} /></dd>
                </div>
                <div>
                  <dt className="eyebrow">Duration</dt>
                  <dd className="mt-1 font-semibold text-ink">
                    {alt.duration_minutes != null ? formatMinutes(alt.duration_minutes) : 'Not given'}
                    {alt.connections != null && (
                      <span className="font-normal text-ink-muted">
                        {' · '}
                        {alt.connections === 0 ? 'direct' : `${alt.connections} stop${alt.connections > 1 ? 's' : ''}`}
                      </span>
                    )}
                  </dd>
                </div>
              </dl>

              {(alt.ranking_reasons ?? []).length > 0 && (
                <ul className="mt-4 space-y-1.5">
                  {alt.ranking_reasons!.map((r, ri) => (
                    <li key={ri} className="flex gap-2 text-sm text-ink-soft">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-status-safe" aria-hidden="true" />
                      {r}
                    </li>
                  ))}
                </ul>
              )}
              {(alt.warnings ?? []).length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {alt.warnings!.map((w, wi) => (
                    <li key={wi} className="flex gap-2 text-sm text-status-caution">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      {w}
                    </li>
                  ))}
                </ul>
              )}
              {alt.price && <p className="mt-3 text-sm text-ink-muted">Price: {alt.price}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- Policy evidence ---------- */

function safeHttpUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export function PolicyEvidenceList({ items }: { items: PolicyEvidence[] }) {
  if (items.length === 0) return <p className="text-base text-ink-soft">No airline policy text was found for this journey.</p>;
  return (
    <ul className="grid gap-4">
      {items.map((p, i) => {
        const href = safeHttpUrl(p.source_url);
        const effective = formatTravelDate(p.effective_date);
        return (
          <li key={p.policy_id ?? i} className="rounded-3xl border border-ink/10 bg-sand-50 p-5 sm:p-6">
            <p className="eyebrow">{[p.airline, p.policy_type].filter(Boolean).join(' / ') || 'Airline policy'}</p>
            {p.title && <h4 className="mt-2 text-lg font-semibold text-ink leading-snug">{p.title}</h4>}
            {p.snippet && (
              <blockquote className="mt-4 flex gap-3 border-l-2 border-coral pl-4">
                <Quote className="mt-1 h-4 w-4 shrink-0 text-coral" aria-hidden="true" />
                <p className="font-serif text-xl italic leading-snug text-ink">{p.snippet}</p>
              </blockquote>
            )}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-muted">{effective ? `Effective ${effective}` : 'Effective date not given'}</p>
              {href && (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink underline decoration-coral underline-offset-4 hover:decoration-2"
                >
                  Read the airline’s policy
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- Sources ---------- */

export function SourcesList({ items }: { items: SourceRef[] }) {
  if (items.length === 0) return <p className="text-base text-ink-soft">No sources were listed.</p>;
  return (
    <ul className="divide-y divide-ink/10 border-y border-ink/10">
      {items.map((s, i) => {
        const href = safeHttpUrl(s.url);
        return (
          <li key={`${s.name}-${i}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
            <span className="min-w-0 text-base text-ink">
              {href ? (
                <a href={href} target="_blank" rel="noreferrer" className="underline decoration-ink/30 underline-offset-4 hover:decoration-ink">
                  {s.name}
                </a>
              ) : (
                s.name
              )}
            </span>
            <span className="flex items-center gap-2 text-sm text-ink-muted">
              {s.type}
              {/mock|demo|sample/i.test(s.name) && <Badge status="DEMO_DATA" label="Demo data" />}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
