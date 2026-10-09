'use client';

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import Badge, { statusLabel } from '@/components/ui/Badge';
import type { FlightResult } from '@/types/flight';
import type { AgentRun, ConnectionSummary, RecoveryReason, RiskSummary, SourceRef } from '@/types/journey';
import { formatMinutes } from '@/lib/flightTime';
import { RISK_PARTS } from './RiskRadarMeter';
import { CHECKS } from './AgentWorkflowProgress';

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
  workflowTrace?: AgentRun[];
  recoveryReasons?: RecoveryReason[];
}

export const RECOVERY_REASON_TEXT: Record<RecoveryReason, string> = {
  FLIGHT_CANCELLED: 'A flight on this journey is reported as cancelled.',
  CONNECTION_AT_RISK: 'A connection is at risk of being missed.',
  RISK_ABOVE_THRESHOLD: 'The risk estimate reached the level where backup options are checked.',
  PASSENGER_REQUESTED: 'You asked to see alternative flights.',
};

const RUN_STATUS_TEXT: Record<AgentRun['status'], string> = {
  success: 'Done',
  partial: 'Done, some data missing',
  unavailable: 'Data unavailable',
  error: 'Could not run',
  skipped: 'Not needed',
};

function checkName(id: string): string {
  return CHECKS.find((check) => check.id === id)?.name ?? 'Journey check';
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
  workflowTrace = [],
  recoveryReasons = [],
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
            <p className="eyebrow">Check details</p>
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
            The flight updates and sources behind your advice.
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
                Result: <Badge status={risk.level} label={`${statusLabel(risk.level)} risk`} /> This score is a guide, not the chance of a delay.
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

          {recoveryReasons.length > 0 && (
            <Section n={++n} title="Why backup flights were checked">
              <ul className="list-disc space-y-1.5 pl-5 text-base text-ink-soft leading-relaxed">
                {recoveryReasons.map((r) => (
                  <li key={r}>{RECOVERY_REASON_TEXT[r] ?? r}</li>
                ))}
              </ul>
            </Section>
          )}

          {workflowTrace.length > 0 && (
            <Section n={++n} title="Checks completed">
              <ol className="space-y-3">
                {workflowTrace.map((run) => (
                  <li key={run.agent} className="border-t border-ink/10 pt-3 first:border-t-0 first:pt-0">
                    <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <span className="text-base text-ink">{checkName(run.agent)}</span>
                      <span className={`text-sm ${run.status === 'error' ? 'text-status-danger' : 'text-ink-soft'}`}>
                        {RUN_STATUS_TEXT[run.status] ?? run.status}
                        {run.duration_ms != null && run.status !== 'skipped' && (
                          <span className="text-ink-muted tabular-nums"> · {(run.duration_ms / 1000).toFixed(1)} s</span>
                        )}
                      </span>
                    </p>
                    {run.warnings.length > 0 && (
                      <ul className="mt-1 space-y-1 text-sm text-ink-muted">
                        {run.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            </Section>
          )}

          <Section n={++n} title="Sources used">
            {sources.length > 0 ? (
              <ul className="space-y-2">
                {sources.map((s, i) => (
                  <li key={`${s.name}-${i}`} className="flex flex-wrap justify-between gap-x-4 text-base text-ink">
                    <span>{s.name}</span>
                    <span className="text-sm text-ink-muted">
                      {[s.type, s.verified === false ? 'Not verified' : null].filter(Boolean).join(' · ')}
                    </span>
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
                Support reference <span className="font-mono text-ink break-all">{traceId}</span>.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
