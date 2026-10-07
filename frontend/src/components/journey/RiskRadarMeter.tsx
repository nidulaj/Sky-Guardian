import React from 'react';
import { AlertTriangle, ArrowLeftRight, CloudSun, Info, Plane, ShieldAlert } from 'lucide-react';
import type { RiskComponent, RiskComponentName, RiskSummary } from '@/types/journey';

interface RiskRadarMeterProps {
  /** Risk agent output, as returned by /api/journeys/analyze. */
  risk: RiskSummary;
}

/** The three Risk agent inputs. Weights are not listed here: they come from the backend (config/risk.yaml). */
export const RISK_PARTS = [
  { key: 'flight', label: 'Flight risk', help: 'Delays, cancellations or diversions reported by the Flight agent.', Icon: Plane },
  { key: 'connection', label: 'Connection risk', help: 'Transfer time against the minimum, from the Connection agent.', Icon: ArrowLeftRight },
  { key: 'weather', label: 'Weather risk', help: 'Worst airport weather on your route, from the Weather agent.', Icon: CloudSun },
] as const;

const EARTH_IMAGE = '/images/risk/earth-orbit.jpg';

// Dark-surface tones per level (the panel sits on a night-side Earth image).
const TONES: Record<string, { text: string; bar: string; pill: string; stroke: string }> = {
  LOW: { text: 'text-emerald-300', bar: 'bg-emerald-400', pill: 'border-emerald-400/40 bg-emerald-400/15 text-emerald-200', stroke: '#34d399' },
  MODERATE: { text: 'text-amber-300', bar: 'bg-amber-400', pill: 'border-amber-400/40 bg-amber-400/15 text-amber-200', stroke: '#fbbf24' },
  HIGH: { text: 'text-orange-300', bar: 'bg-orange-400', pill: 'border-orange-400/40 bg-orange-400/15 text-orange-200', stroke: '#fb923c' },
  VERY_HIGH: { text: 'text-rose-300', bar: 'bg-rose-400', pill: 'border-rose-400/40 bg-rose-400/15 text-rose-200', stroke: '#fb7185' },
  UNKNOWN: { text: 'text-slate-300', bar: 'bg-slate-400', pill: 'border-slate-400/40 bg-slate-400/15 text-slate-200', stroke: '#94a3b8' },
};

// Band widths follow the backend level thresholds when provided (inclusive upper bounds).
function bands(thresholds?: Record<string, number>) {
  const low = (thresholds?.low_max ?? 29) + 1;
  const moderate = (thresholds?.moderate_max ?? 59) + 1;
  const high = (thresholds?.high_max ?? 79) + 1;
  return [
    { level: 'LOW', label: 'Low', from: 0, to: low },
    { level: 'MODERATE', label: 'Moderate', from: low, to: moderate },
    { level: 'HIGH', label: 'High', from: moderate, to: high },
    { level: 'VERY_HIGH', label: 'Very high', from: high, to: 100 },
  ];
}

const clamp = (n: number) => Math.min(Math.max(n, 0), 100);
const levelText = (level: string) => level.replace(/_/g, ' ').toLowerCase();
const tone = (level?: string | null) => TONES[level ?? 'UNKNOWN'] ?? TONES.UNKNOWN;

function glass(extra = '') {
  return `rounded-3xl border border-white/10 bg-slate-950/55 backdrop-blur-md shadow-[0_20px_60px_-30px_rgba(56,189,248,0.45)] ${extra}`;
}

function Ring({ value, label, sub, color, testId }: { value: number; label: string; sub: string; color: string; testId?: string }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-4" data-testid={testId}>
      <svg viewBox="0 0 80 80" className="h-20 w-20 shrink-0 -rotate-90" aria-hidden="true">
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="7" />
        <circle
          cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${(clamp(value) / 100) * c} ${c}`}
        />
      </svg>
      <div className="min-w-0">
        <p className="font-mono text-2xl font-semibold text-white tabular-nums">{Math.round(value)}%</p>
        <p className="text-sm font-medium text-slate-200">{label}</p>
        <p className="text-xs text-slate-400">{sub}</p>
      </div>
    </div>
  );
}

export default function RiskRadarMeter({ risk }: RiskRadarMeterProps) {
  const score = risk.score;
  const level = risk.level;
  const t = tone(level);
  const scale = bands(risk.level_thresholds);
  const scores: Record<RiskComponentName, number | null> = {
    flight: risk.flight_score,
    connection: risk.connection_score,
    weather: risk.weather_score,
  };
  const components = risk.components ?? {};
  const statusOf = (key: RiskComponentName): RiskComponent['status'] =>
    components[key]?.status ?? (scores[key] === null ? 'missing' : 'available');
  const weightOf = (key: RiskComponentName) => risk.effective_weights?.[key] ?? risk.weights?.[key];
  const applicable = RISK_PARTS.filter((p) => statusOf(p.key) !== 'not_applicable');
  const scored = applicable.filter((p) => statusOf(p.key) === 'available' && scores[p.key] !== null);
  const notes = risk.uncertainty ?? [];
  const explanation = (risk.explanation ?? []).slice(1); // first line repeats the headline score

  return (
    <div className="relative overflow-hidden rounded-[2rem] bg-[#050913] text-slate-100" data-testid="risk-panel">
      {/* Earth from orbit backdrop */}
      <div
        className="absolute inset-0 bg-cover bg-bottom opacity-90"
        style={{ backgroundImage: `url('${EARTH_IMAGE}')` }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#050913]/95 via-[#050913]/75 to-[#050913]/35" aria-hidden="true" />

      <div className="relative space-y-5 p-5 sm:p-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.16em] text-sky-300">
            <ShieldAlert className="h-4 w-4" aria-hidden="true" />
            <span>Risk agent · journey risk estimate</span>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs uppercase tracking-wider ${t.pill}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
            {level === 'UNKNOWN' ? 'Risk unknown' : `${levelText(level)} risk`}
          </span>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
          {/* Overall score */}
          <div className={glass('p-5 sm:p-6')}>
            <p className="text-sm text-slate-300">Overall risk</p>
            <p className="mt-2 flex items-baseline gap-2">
              <span className={`font-mono text-7xl font-semibold tabular-nums sm:text-8xl ${t.text}`}>{score === null ? '—' : score}</span>
              <span className="text-2xl text-slate-400">/ 100</span>
            </p>
            {score === null ? (
              <p className="mt-3 text-sm text-slate-300">No flight, connection or weather result could be scored, so no score is given.</p>
            ) : (
              <div className="mt-5" role="img" aria-label={`Score ${score} out of 100, in the ${levelText(level)} band`}>
                <div className="relative">
                  <div className="flex h-2.5 overflow-hidden rounded-full">
                    {scale.map((b) => (
                      <span key={b.level} className={`${tone(b.level).bar} opacity-70`} style={{ width: `${b.to - b.from}%` }} />
                    ))}
                  </div>
                  <span
                    className="absolute -top-1.5 h-[22px] w-1 -translate-x-1/2 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)]"
                    style={{ left: `${clamp(score)}%` }}
                    aria-hidden="true"
                  />
                </div>
                <div className="mt-2 flex text-xs text-slate-400" aria-hidden="true">
                  {scale.map((b) => (
                    <span key={b.level} style={{ width: `${b.to - b.from}%` }} className="truncate pr-1">{b.label}</span>
                  ))}
                </div>
              </div>
            )}
            {risk.applied_overrides && risk.applied_overrides.length > 0 && (
              <p className="mt-4 flex gap-2 text-sm text-rose-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{risk.applied_overrides.join(' ')}</span>
              </p>
            )}
          </div>

          {/* Confidence + coverage rings, component bar chart */}
          <div className="grid gap-5">
            <div className={glass('grid gap-4 p-5 sm:grid-cols-2')}>
              {risk.confidence != null && (
                <Ring
                  value={risk.confidence * 100}
                  label="Confidence"
                  sub={(risk.confidence_label || 'unknown').toUpperCase()}
                  color={risk.confidence >= 0.8 ? '#34d399' : risk.confidence >= 0.5 ? '#fbbf24' : '#fb7185'}
                />
              )}
              <Ring
                value={applicable.length ? (scored.length / applicable.length) * 100 : 0}
                label="Data coverage"
                sub={`${scored.length} of ${applicable.length} parts scored`}
                color="#38bdf8"
              />
            </div>

            <div className={glass('p-5')}>
              <p className="text-sm text-slate-300">Component scores</p>
              <div className="mt-4 flex h-36 items-end justify-around gap-4" aria-hidden="true">
                {RISK_PARTS.map((p) => {
                  const v = scores[p.key];
                  const comp = components[p.key];
                  return (
                    <div key={p.key} className="flex h-full w-14 flex-col items-center justify-end gap-1.5">
                      <span className="font-mono text-xs text-slate-200 tabular-nums">{v === null ? 'N/A' : v}</span>
                      {v === null ? (
                        <div className="h-full w-full rounded-xl border border-dashed border-slate-500/70" />
                      ) : (
                        <div className={`w-full rounded-xl ${tone(comp?.level).bar}`} style={{ height: `${Math.max(clamp(v), 3)}%` }} />
                      )}
                      <span className="text-xs text-slate-400">{p.label.split(' ')[0]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Component tiles */}
        <ul className="grid gap-4 md:grid-cols-3">
          {RISK_PARTS.map(({ key, label, help, Icon }) => {
            const comp = components[key];
            const status = statusOf(key);
            const value = scores[key];
            const weight = weightOf(key);

            if (status === 'not_applicable') {
              return (
                <li key={key} className={glass('p-5')} data-testid={`risk-${key}-component`}>
                  <div className="flex items-center gap-2 text-slate-300">
                    <Icon className="h-4 w-4 text-sky-300" aria-hidden="true" />
                    <span className="font-medium text-white">{label}</span>
                  </div>
                  <p className="mt-3 text-lg font-medium text-slate-300">Not applicable</p>
                  <p className="mt-1 text-sm text-slate-400 leading-snug">{comp?.reason || 'Does not apply to this journey.'}</p>
                </li>
              );
            }

            if (status !== 'available' || value === null) {
              return (
                <li key={key} className={glass('border-dashed border-amber-400/40 p-5')} data-testid={`risk-${key}-component`}>
                  <div className="flex items-center gap-2 text-slate-300">
                    <Icon className="h-4 w-4 text-amber-300" aria-hidden="true" />
                    <span className="font-medium text-white">{label}</span>
                  </div>
                  <p className="mt-3 text-lg font-medium text-amber-300">Unavailable</p>
                  <p className="mt-1 text-sm text-slate-300 leading-snug">{comp?.reason || 'No data for this part of the journey.'}</p>
                  <p className="mt-2 text-xs text-slate-400">Not scored and left out of the total, never counted as 0.</p>
                </li>
              );
            }

            const ct = tone(comp?.level);
            return (
              <li key={key} className={glass('p-5')} data-testid={`risk-${key}-component`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-sky-300" aria-hidden="true" />
                    <span className="font-medium text-white">{label}</span>
                  </div>
                  {weight !== undefined && (
                    <span className="font-mono text-xs text-slate-400" title="Weight in the journey score">{Math.round(weight * 100)}% weight</span>
                  )}
                </div>
                <p className="mt-3 flex items-baseline gap-2">
                  <span className={`font-mono text-3xl font-semibold tabular-nums ${ct.text}`}>{value}/100</span>
                  {comp?.level && <span className={`rounded-full border px-2 py-0.5 font-mono text-[11px] uppercase ${ct.pill}`}>{levelText(comp.level)}</span>}
                </p>
                <div
                  className="mt-3 h-1.5 rounded-full bg-white/10"
                  role="img"
                  aria-label={`${label}: ${value} out of 100${weight !== undefined ? `, weight ${Math.round(weight * 100)} percent` : ''}`}
                >
                  <div className={`h-1.5 rounded-full ${ct.bar}`} style={{ width: `${clamp(value)}%` }} />
                </div>
                {weight !== undefined && (
                  <p className="mt-2 text-xs text-slate-400">
                    Adds <span className="tabular-nums text-slate-200">{(value * weight).toFixed(1)}</span> pts
                  </p>
                )}
                <p className="mt-2 text-sm text-slate-300 leading-snug">{comp?.reason || help}</p>
              </li>
            );
          })}
        </ul>

        {/* Explanation + confidence notes */}
        {(explanation.length > 0 || risk.confidence != null || notes.length > 0) && (
          <div className={glass('space-y-3 p-5 text-sm')} data-testid="risk-confidence">
            {risk.confidence != null && (
              <p className="text-slate-300">
                Confidence:{' '}
                <span className={`font-semibold ${risk.confidence >= 0.8 ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {(risk.confidence_label || '').toUpperCase()} ({Math.round(risk.confidence * 100)}%)
                </span>
              </p>
            )}
            {explanation.length > 0 && (
              <ul className="space-y-1.5 text-slate-200" data-testid="risk-explanation">
                {explanation.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-sky-300" aria-hidden="true" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            )}
            {notes.map((note) => (
              <p key={note} className="flex gap-2 text-slate-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
                <span>{note}</span>
              </p>
            ))}
          </div>
        )}

        <p className="flex gap-2.5 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-300 leading-relaxed backdrop-blur-md">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" aria-hidden="true" />
          <span>
            {score === null
              ? 'Without flight, connection or weather data the risk cannot be estimated. Check your flight with your airline.'
              : `This is a weighted estimate, not a probability: a score of ${score} does not mean a ${score}% chance of disruption. Use it to decide how closely to watch your trip.`}
          </span>
        </p>
      </div>
    </div>
  );
}
