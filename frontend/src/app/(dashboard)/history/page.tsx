'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import Badge from '@/components/ui/Badge';
import { ArrowRight, Inbox, Trash2, RotateCcw, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  getJourneyHistory,
  deleteJourneyHistoryItem,
  clearJourneyHistory,
  HistoryRecord,
} from '@/lib/api/client';

type Outcome = 'attention' | 'clear';

const FILTERS: { key: 'all' | Outcome; label: string }[] = [
  { key: 'all', label: 'All checks' },
  { key: 'attention', label: 'Needs attention' },
  { key: 'clear', label: 'All clear' },
];

const primaryLink =
  'inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ink px-6 text-base font-medium text-sand-50 transition-colors hover:bg-ink-soft';

function formatDateLabel(isoString?: string, travelDate?: string): string {
  if (isoString) {
    try {
      const d = new Date(isoString);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
      }
    } catch {
      // fallback
    }
  }
  if (travelDate) {
    try {
      const d = new Date(travelDate);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
      }
    } catch {
      // fallback
    }
    return travelDate;
  }
  return 'Recent check';
}

function RouteDisplay({ check, large = false }: { check: HistoryRecord; large?: boolean }) {
  const size = large ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl';
  return (
    <span className="block">
      <span className="sr-only">{check.places}</span>
      <span aria-hidden="true" className={`display ${size} text-ink inline-flex items-center gap-2 whitespace-nowrap`}>
        <span>{check.from_airport}</span>
        {check.via_airport && (
          <>
            <span className="h-px w-3 sm:w-4 border-t border-dashed border-coral" />
            <span className="text-ink-muted">{check.via_airport}</span>
          </>
        )}
        <span className="h-px w-3 sm:w-4 border-t border-dashed border-coral" />
        <span>{check.to_airport}</span>
      </span>
    </span>
  );
}

export default function HistoryPage() {
  const router = useRouter();
  const { user, token, isAuthenticated, isLoading: authLoading } = useAuth();

  const [checks, setChecks] = useState<HistoryRecord[]>([]);
  const [filter, setFilter] = useState<'all' | Outcome>('all');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  // Storage key for user local cache
  const storageKey = user?.user_id ? `skyguardian_journey_history_${user.user_id}` : null;

  // 1. Initial Load: LocalStorage Cache first for instant render, then fetch API
  const loadHistory = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Load local storage cache immediately
    if (storageKey) {
      try {
        const cached = localStorage.getItem(storageKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            setChecks(parsed);
          }
        }
      } catch {
        // ignore cache read error
      }
    }

    // Fetch from backend API if token is ready
    if (token) {
      try {
        const remote = await getJourneyHistory(token);
        if (Array.isArray(remote)) {
          if (remote.length > 0) {
            setChecks(remote);
            if (storageKey) {
              localStorage.setItem(storageKey, JSON.stringify(remote));
            }
          } else if (storageKey) {
            // If remote is empty, preserve local items if any
            const cached = localStorage.getItem(storageKey);
            if (cached) {
              const parsed = JSON.parse(cached);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setChecks(parsed);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Could not fetch journey history from backend:', err);
      }
    }

    setLoading(false);
  }, [user, token, storageKey]);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.replace('/login?redirect=/history');
      } else {
        loadHistory();
      }
    }
  }, [authLoading, isAuthenticated, loadHistory, router]);

  // Handle recheck: save legs to sessionStorage and push to dashboard
  const handleRecheck = (check: HistoryRecord) => {
    try {
      let legsToUse = check.legs;
      if (!legsToUse || legsToUse.length === 0) {
        // Fallback reconstructed leg from record
        legsToUse = [
          {
            flight_number: check.flights.split('·')[0]?.trim() || '',
            origin: check.from_airport,
            destination: check.to_airport,
            travel_date: check.travel_date || new Date().toISOString().split('T')[0],
          },
        ];
      }
      sessionStorage.setItem('skyguardian_recheck_legs', JSON.stringify(legsToUse));
      router.push('/dashboard');
    } catch {
      router.push('/dashboard');
    }
  };

  // Handle delete item
  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      if (token) {
        await deleteJourneyHistoryItem(id, token).catch(() => {});
      }
      setChecks((prev) => {
        const updated = prev.filter((c) => c.id !== id);
        if (storageKey) {
          localStorage.setItem(storageKey, JSON.stringify(updated));
        }
        return updated;
      });
      setBannerNotice('Journey check removed from your history.');
      setTimeout(() => setBannerNotice(null), 3500);
    } catch {
      // handled
    } finally {
      setDeletingId(null);
    }
  };

  // Handle clear all history
  const handleClearAll = async () => {
    setIsClearing(true);
    try {
      if (token) {
        await clearJourneyHistory(token).catch(() => {});
      }
      setChecks([]);
      if (storageKey) {
        localStorage.removeItem(storageKey);
      }
      setConfirmClearOpen(false);
      setBannerNotice('All journey history records have been cleared.');
      setTimeout(() => setBannerNotice(null), 3500);
    } catch {
      // handled
    } finally {
      setIsClearing(false);
    }
  };

  const rows = checks.filter((c) => filter === 'all' || c.outcome === filter);

  return (
    <div className="space-y-10 sm:space-y-12">
      <PageHeader
        eyebrow="02 / History"
        title="Every journey,"
        accent="remembered."
        description="Your past checked routes, live agent risk assessments, and safeguarding guidance. Saved securely to your SkyGuardian account."
        actions={
          <div className="flex items-center gap-3">
            {checks.length > 0 && (
              <button
                type="button"
                onClick={() => setConfirmClearOpen(true)}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-ink/20 bg-sand-50 px-5 text-sm font-medium text-ink-muted transition-colors hover:border-coral/40 hover:text-coral"
              >
                <Trash2 className="h-4 w-4" />
                Clear all
              </button>
            )}
            <Link href="/dashboard" className={primaryLink}>
              Check new flight
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        }
      />

      {/* Temporary action confirmation notice */}
      {bannerNotice && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-50 px-5 py-3.5 text-sm text-emerald-900 animate-fadeIn"
        >
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
          <p className="font-medium">{bannerNotice}</p>
        </div>
      )}

      {/* Clear Confirmation Modal */}
      {confirmClearOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4">
          <div className="surface max-w-md w-full p-6 sm:p-8 space-y-5 rounded-3xl shadow-xl border border-ink/10">
            <div className="flex items-center gap-3 text-coral">
              <AlertCircle className="h-6 w-6" />
              <h3 className="font-display text-xl text-ink font-semibold">Clear entire history?</h3>
            </div>
            <p className="text-sm text-ink-soft leading-relaxed">
              This will permanently remove all {checks.length} stored journey checks from your SkyGuardian account and local
              session cache. This action cannot be reversed.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isClearing}
                onClick={() => setConfirmClearOpen(false)}
                className="h-11 px-5 rounded-full border border-ink/20 text-sm font-medium text-ink hover:bg-sand-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isClearing}
                onClick={handleClearAll}
                className="h-11 px-6 rounded-full bg-coral text-sand-50 text-sm font-medium hover:bg-coral-deep transition-colors inline-flex items-center gap-2"
              >
                {isClearing && <Loader2 className="h-4 w-4 animate-spin" />}
                {isClearing ? 'Clearing...' : 'Yes, clear history'}
              </button>
            </div>
          </div>
        </div>
      )}


      <section aria-labelledby="checks-heading" className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h2 id="checks-heading" className="eyebrow">
              {rows.length} {rows.length === 1 ? 'journey' : 'journeys'} recorded
            </h2>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-ink-muted" />}
          </div>

          <div role="group" aria-label="Filter checks" className="flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(f.key)}
                  className={`h-11 rounded-full px-4 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-ink text-sand-50'
                      : 'border border-ink/15 bg-sand-50 text-ink-soft hover:border-ink/40 hover:text-ink'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState filter={filter} hasTotalChecks={checks.length > 0} />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block surface overflow-hidden">
              <table className="w-full text-left">
                <caption className="sr-only">Recorded journey checks</caption>
                <thead>
                  <tr className="border-b border-ink/10 bg-sand-100/50">
                    <th scope="col" className="eyebrow px-6 py-4 font-normal">
                      Date
                    </th>
                    <th scope="col" className="eyebrow px-6 py-4 font-normal">
                      Route & Flights
                    </th>
                    <th scope="col" className="eyebrow px-6 py-4 font-normal">
                      Status & Risk
                    </th>
                    <th scope="col" className="eyebrow px-6 py-4 font-normal">
                      Analysis Finding & Next Step
                    </th>
                    <th scope="col" className="eyebrow px-6 py-4 font-normal text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/10">
                  {rows.map((c) => (
                    <tr key={c.id} className="align-top transition-colors hover:bg-sand-50/80">
                      <td className="px-6 py-6 text-sm text-ink whitespace-nowrap">
                        <time dateTime={c.travel_date || c.created_at}>
                          {formatDateLabel(c.created_at, c.travel_date)}
                        </time>
                        {c.travel_date && c.travel_date !== formatDateLabel(c.created_at) && (
                          <div className="text-xs text-ink-muted mt-1">Travel: {c.travel_date}</div>
                        )}
                      </td>
                      <td className="px-6 py-6 min-w-[200px]">
                        <RouteDisplay check={c} />
                        <p className="mt-1.5 text-sm font-medium text-ink-muted tracking-wide">{c.flights}</p>
                      </td>
                      <td className="px-6 py-6 whitespace-nowrap space-y-2">
                        <Badge status={c.status} label={c.status_label} />
                        {typeof c.risk_score === 'number' && (
                          <div className="text-xs text-ink-muted flex items-center gap-1.5 font-medium">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                c.risk_level === 'HIGH' || c.risk_level === 'VERY_HIGH'
                                  ? 'bg-coral'
                                  : c.risk_level === 'MODERATE'
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                            />
                            Risk score: {c.risk_score}/100
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-6 max-w-md">
                        <p className="text-sm font-medium text-ink leading-relaxed">{c.finding}</p>
                        <p className="mt-1.5 text-xs text-ink-soft leading-relaxed">
                          <span className="font-semibold text-ink">Action:</span> {c.next_step}
                        </p>
                      </td>
                      <td className="px-6 py-6 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleRecheck(c)}
                            title="Re-run real-time check for this route on Dashboard"
                            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-ink/15 bg-sand-50 px-4 text-xs font-medium text-ink transition-colors hover:border-ink/40 hover:bg-sand-100"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Check again
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(c.id)}
                            disabled={deletingId === c.id}
                            title="Delete this record"
                            aria-label={`Delete journey check ${c.from_airport} to ${c.to_airport}`}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-ink/15 text-ink-muted transition-colors hover:border-coral/50 hover:text-coral hover:bg-sand-100"
                          >
                            {deletingId === c.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile & Tablet cards */}
            <ul className="grid gap-4 md:grid-cols-2 lg:hidden">
              {rows.map((c) => (
                <li key={c.id} className="surface p-5 sm:p-6 flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-3 border-b border-ink/10 pb-3">
                    <time dateTime={c.travel_date || c.created_at} className="eyebrow">
                      {formatDateLabel(c.created_at, c.travel_date)}
                    </time>
                    <span className="text-xs font-semibold text-ink-muted">{c.flights}</span>
                  </div>

                  <RouteDisplay check={c} large />

                  <div className="flex items-center justify-between gap-2">
                    <Badge status={c.status} label={c.status_label} />
                    {typeof c.risk_score === 'number' && (
                      <span className="text-xs text-ink-muted font-medium">Risk: {c.risk_score}/100</span>
                    )}
                  </div>

                  <div className="border-t border-ink/10 pt-3 space-y-2">
                    <p className="text-sm font-medium text-ink leading-relaxed">{c.finding}</p>
                    <p className="text-xs text-ink-soft leading-relaxed">
                      <span className="font-semibold text-ink">Action:</span> {c.next_step}
                    </p>
                  </div>

                  <div className="mt-auto pt-3 border-t border-ink/10 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => handleRecheck(c)}
                      className="flex-1 inline-flex h-11 items-center justify-center gap-2 rounded-full border border-ink/15 bg-sand-50 px-4 text-xs font-semibold text-ink transition-colors hover:border-ink/40"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Check again on Dashboard
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      disabled={deletingId === c.id}
                      aria-label="Delete check"
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink/15 text-ink-muted hover:border-coral/50 hover:text-coral transition-colors"
                    >
                      {deletingId === c.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <p className="text-sm text-ink-muted leading-relaxed max-w-2xl">
        Results reflect real-time aviation and meteorological data available at the time of each assessment. Risk levels
        are decision-support estimates. Always confirm travel documentation and gate changes with your operating carrier.
      </p>
    </div>
  );
}

function EmptyState({ filter, hasTotalChecks }: { filter: 'all' | Outcome; hasTotalChecks: boolean }) {
  if (hasTotalChecks && filter !== 'all') {
    return (
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-ink/25 px-6 py-14 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-sand-100 text-ink-soft">
          <Inbox className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="space-y-2">
          <p className="text-xl font-semibold tracking-tight text-ink">No matching checks found</p>
          <p className="text-base text-ink-soft max-w-md">
            No journey checks in your history match the selected filter. Switch filters to view other journeys.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-ink/25 px-6 py-16 text-center bg-sand-50/50">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-sand-100 text-ink-soft">
        <Inbox className="h-8 w-8" aria-hidden="true" />
      </span>
      <div className="space-y-2">
        <p className="font-display text-2xl font-semibold tracking-tight text-ink">No journey history yet</p>
        <p className="text-base text-ink-soft max-w-md leading-relaxed">
          When you enter and assess a flight on your Dashboard, SkyGuardian records the route, risk findings, and
          recommendations here so you can revisit them anytime.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="mt-2 inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-sm font-medium text-sand-50 transition-colors hover:bg-ink-soft"
      >
        Check your first journey
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
}
