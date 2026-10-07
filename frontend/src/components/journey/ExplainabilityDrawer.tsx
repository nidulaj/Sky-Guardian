'use client';

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import Badge, { statusLabel } from '@/components/ui/Badge';
import type { FlightResult } from '@/types/flight';
import type { ConnectionSummary, RiskSummary, SourceRef } from '@/types/journey';
import { formatMinutes } from '@/lib/flightTime';
import { RISK_PARTS } from './RiskRadarMeter';

interface ExplainabilityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  risk?: RiskSummary | null;
  primaryIssue?: string | null;
  flights?: FlightResult[];
  connection?: ConnectionSummary | null;
  connectionAirport?: string | null;
  sources?: SourceRef[];
  traceId?: string | null;
}

function flightSentence(f: FlightResult): string {
  switch (f.status) {
    case 'CANCELLED':
      return 'Reported as cancelled.';
    case 'DIVERTED':
      return 'Reported as diverted.';
    case 'UNKNOWN':
      return 'No reliable status was found, so it counts as uncertain.';
    default:
      return f.delay_minutes > 0 ? `Running ${formatMinutes(f.delay_minutes)} late.` : `${statusLabel(f.status)}, no delay reported.`;
  }
}

const pad2 = (n: number) => String(n).padStart(2, '0');

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-ink/15 pt-6">
      <h3 className="eyebrow">
        {pad2(n)} / {title}
      </h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function ExplainabilityDrawer({
  isOpen,
  onClose,
  risk,
  primaryIssue,
  flights = [],
  connection,
  connectionAirport,
  sources = [],
  traceId,
}: ExplainabilityDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      // Keep keyboard focus inside the dialog.
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const parts = risk
    ? RISK_PARTS.map((p) => {
        const value = p.key === 'flight' ? risk.flight_score : p.key === 'connection' ? risk.connection_score : risk.weather_score;
        // Missing data (score null) is left out; the Risk agent re-weights the rest (effective_weights).
        const weight = value === null ? 0 : risk.effective_weights?.[p.key] ?? risk.weights?.[p.key] ?? 0;
        return { ...p, value, weight, points: (value ?? 0) * weight };
      })
    : [];
  const total = parts.reduce((sum, p) => sum + p.points, 0);
  let n = 0;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-ink/45" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="explain-title"
        className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col bg-sand-100 shadow-[0_0_60px_-10px_rgba(26,23,20,0.45)] animate-fade-up"
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink/10 px-5 py-5 sm:px-8">
          <div>
            <p className="eyebrow">Explainability</p>
            <h2 id="explain-title" className="display mt-2 text-3xl sm:text-4xl text-ink">
              Why this <span className="accent text-coral">advice?</span>
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close explanation"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-ink/20 text-ink hover:bg-ink/5"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-8 overflow-y-auto px-5 py-6 sm:px-8">
          <p className="text-base text-ink-soft leading-relaxed">
            Everything below comes from this check’s results. It shows what the agents found and how the score was put together.
            {primaryIssue && (
              <>
                {' '}Main finding: <strong className="font-semibold text-ink">{primaryIssue}</strong>
              </>
            )}
          </p>

          {risk && (
            <Section n={++n} title="How the score was built">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-ink-muted">
                    <th scope="col" className="pb-2 font-normal">Part</th>
                    <th scope="col" className="pb-2 font-normal text-right">Score</th>
                    <th scope="col" className="pb-2 font-normal text-right">Weight</th>
                    <th scope="col" className="pb-2 font-normal text-right">Adds</th>
                  </tr>
                </thead>
                <tbody className="text-base text-ink tabular-nums">
                  {parts.map((p) => (
                    <tr key={p.key} className="border-t border-ink/10">
                      <th scope="row" className="py-2.5 font-normal">{p.label}</th>
                      <td className="py-2.5 text-right">{p.value === null ? 'Unavailable' : Math.round(p.value)}</td>
                      <td className="py-2.5 text-right">{Math.round(p.weight * 100)}%</td>
                      <td className="py-2.5 text-right">{p.value === null ? '—' : p.points.toFixed(1)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-ink/30 font-semibold">
                    <th scope="row" className="py-2.5">Total</th>
                    <td colSpan={3} className="py-2.5 text-right">
                      {risk.score === null ? 'Not scored' : total.toFixed(1)}
                      {risk.score !== null && Math.abs(total - risk.score) > 0.05 && (
                        <span className="font-normal text-ink-muted">
                          {' '}(shown as {risk.score}{risk.applied_overrides?.length ? ', minimum applied' : ''})
                        </span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
                Result: <Badge status={risk.level} label={`${statusLabel(risk.level)} risk`} /> This is a weighted estimate, not a probability.
              </p>
            </Section>
          )}

          {flights.length > 0 && (
            <Section n={++n} title="Your flights">
              <ul className="space-y-3">
                {flights.map((f, i) => (
                  <li key={`${f.flight_number}-${i}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="text-base text-ink">
                      <span className="font-mono font-medium">{f.flight_number || 'Unknown flight'}</span>{' '}
                      <span className="text-ink-soft">
                        {f.origin || '—'} → {f.destination || '—'}
                      </span>
                    </span>
                    <span className="text-sm text-ink-soft">{flightSentence(f)}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {connection && (
            <Section n={++n} title="Your connection">
              <p className="text-base text-ink-soft leading-relaxed">
                {connectionAirport ? `At ${connectionAirport}` : 'At the transfer airport'} you have{' '}
                <strong className="font-semibold text-ink">{formatMinutes(connection.available_minutes)}</strong> between flights. The
                minimum needed is <strong className="font-semibold text-ink">{formatMinutes(connection.minimum_required_minutes)}</strong>
                {connection.buffer_minutes < 0 ? (
                  <>
                    , so you are short by <strong className="font-semibold text-status-danger">{formatMinutes(-connection.buffer_minutes)}</strong>.
                  </>
                ) : (
                  <>
                    , leaving <strong className="font-semibold text-ink">{formatMinutes(connection.buffer_minutes)}</strong> spare.
                  </>
                )}
              </p>
              <p className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
                Connection status: <Badge status={connection.status} />
              </p>
            </Section>
          )}

          <Section n={++n} title="Sources used">
            {sources.length > 0 ? (
              <ul className="space-y-2">
                {sources.map((s, i) => (
                  <li key={`${s.name}-${i}`} className="flex flex-wrap justify-between gap-x-4 text-base text-ink">
                    <span>{s.name}</span>
                    {s.type && <span className="text-sm text-ink-muted">{s.type}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-base text-ink-soft">No sources were listed for this check.</p>
            )}
          </Section>

          <section className="rounded-2xl bg-sand-200 px-4 py-4 text-sm text-ink-soft">
            <p>SkyGuardian gives guidance, not decisions. Confirm any rebooking or compensation with your airline.</p>
            {traceId && (
              <p className="mt-2">
                Trace ID <span className="font-mono text-ink break-all">{traceId}</span>. Quote it if you report a problem.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
