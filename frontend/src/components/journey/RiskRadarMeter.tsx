import React from 'react';
import { AlertTriangle, ArrowLeftRight, CloudSun, Info, Plane, ShieldAlert } from 'lucide-react';
import Badge, { statusLabel } from '@/components/ui/Badge';
import type { RiskComponent, RiskComponentName, RiskSummary } from '@/types/journey';

interface RiskRadarMeterProps {
  /** Risk agent output, as returned by /api/journeys/analyze. */
  risk: RiskSummary;
}

/** The three Risk agent inputs. Weights are not listed here: they come from the backend (config/risk.yaml). */
export const RISK_PARTS = [
  { key: 'flight', label: 'Flight risk', short: 'Flight', help: 'Reported delays, cancellations or diversions.', Icon: Plane },
  { key: 'connection', label: 'Connection risk', short: 'Connection', help: 'Time available to catch your next flight.', Icon: ArrowLeftRight },
  { key: 'weather', label: 'Weather risk', short: 'Weather', help: 'Weather conditions that could affect your flights.', Icon: CloudSun },
] as const;

const RUNWAY_IMAGE = '/images/risk/runway-sunset.jpg';

// Bar / scale fills on the dark panel, from the site palette (tailwind.config.ts):
// low -> status-safe-bg, moderate -> status-caution-bg, high -> coral-peach, very high -> coral.
const FILL: Record<string, string> = {
  LOW: 'bg-status-safe-bg',
  MODERATE: 'bg-status-caution-bg',
  HIGH: 'bg-coral-peach',
  VERY_HIGH: 'bg-coral',
  UNKNOWN: 'bg-sand-500',
};
const fill = (level?: string | null) => FILL[level ?? 'UNKNOWN'] ?? FILL.UNKNOWN;

// Ring strokes use the same tokens as hex values (SVG strokes cannot take Tailwind classes).
const RING = { good: '#DCE8DF', fair: '#F3E3C2', poor: '#F0B39C', coverage: '#ECE6DB' };

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

// Same treatment as the photo cards in JourneyWeatherPanel: cabin-dark glass, sand hairlines.
const card = (extra = '') => `rounded-3xl border border-sand-50/10 bg-cabin-dark/75 backdrop-blur-md ${extra}`;

function Ring({ value, label, sub, color }: { value: number; label: string; sub: string; color: string }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex min-w-0 items-center gap-4">
      <div className="relative h-20 w-20 shrink-0">
        <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90" aria-hidden="true">
          <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(250,248,244,0.12)" strokeWidth="6" />
          <circle
            cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={`${(clamp(value) / 100) * c} ${c}`}
          />
        </svg>
        <span className="display absolute inset-0 flex items-center justify-center text-lg text-white tabular-nums">
          {Math.round(value)}%
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-base font-medium text-white">{label}</p>
        <p className="font-mono text-xs uppercase tracking-label text-sand-300">{sub}</p>
      </div>
    </div>
  );
}

export default function RiskRadarMeter({ risk }: RiskRadarMeterProps) {
  const score = risk.score;
  const level = risk.level;
  const scale = bands(risk.level_thresholds);
  const scores: Record<RiskComponentName, number | null> = {
    flight: risk.flight_score,
    connection: risk.connection_score,
    weather: risk.weather_score,
  };
  const components = risk.components ?? {};
  const statusOf = (key: RiskComponentName): RiskComponent['status'] =>
    components[key]?.status ?? (scores[key] === null ? 'missing' : 'available');
  const applicable = RISK_PARTS.filter((p) => statusOf(p.key) !== 'not_applicable');
  const scored = applicable.filter((p) => statusOf(p.key) === 'available' && scores[p.key] !== null);
  const notes = risk.uncertainty ?? [];
  const explanation = (risk.explanation ?? []).slice(1); // first line repeats the headline score
  const confidenceColor = (c: number) => (c >= 0.8 ? RING.good : c >= 0.5 ? RING.fair : RING.poor);

  return (
    <div className="relative isolate overflow-hidden rounded-4xl bg-cabin-dark text-sand-50" data-testid="risk-panel">
      {/* Runway at sunset backdrop */}
      <div
        className="absolute inset-0 -z-10 bg-cover bg-top"
        style={{ backgroundImage: `url('${RUNWAY_IMAGE}')` }}
        aria-hidden="true"
      />
      {/* Sunset and aircraft stay visible behind the header; the runway darkens behind the cards */}
      <div
        className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(43,36,31,0.55)_0%,rgba(43,36,31,0.15)_18%,rgba(43,36,31,0.6)_34%,rgba(43,36,31,0.9)_55%,rgba(43,36,31,0.96)_100%)]"
        aria-hidden="true"
      />

      <div className="space-y-5 p-5 sm:p-8 lg:p-10">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 pb-28 sm:pb-36 lg:pb-44 [text-shadow:0_2px_12px_rgba(0,0,0,0.45)]">
          <div>
            <p className="eyebrow flex items-center gap-2 text-sand-100">
              <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              Journey risk
            </p>
            <h3 className="display mt-3 text-4xl text-white sm:text-5xl">
              Your journey <span className="accent text-coral-peach">risk</span>
            </h3>
            <p className="mt-3 max-w-md text-base text-sand-100">
              Based on flight status, connection time and weather.
            </p>
          </div>
          <Badge
            status={level}
            label={level === 'UNKNOWN' ? 'Risk unknown' : `${statusLabel(level)} risk`}
            className="px-3 py-1.5 text-xs [text-shadow:none]"
          />
        </div>

        {/* Row 1: overall score | confidence + coverage | component chart */}
        <div className="grid gap-5 lg:grid-cols-12">
          <div className={card('p-6 lg:col-span-5')}>
            <p className="eyebrow text-sand-300">Overall risk</p>
            <p className="mt-4 flex items-baseline gap-2">
              <span className="display text-8xl text-white tabular-nums">{score === null ? '—' : score}</span>
              <span className="text-2xl text-sand-300">/ 100</span>
            </p>
            {score === null ? (
              <p className="mt-4 text-base text-sand-100">No flight, connection or weather result could be scored, so no score is given.</p>
            ) : (
              <div className="mt-6" role="img" aria-label={`Score ${score} out of 100, in the ${statusLabel(level).toLowerCase()} band`}>
                <div className="relative">
                  <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
                    {scale.map((b) => (
                      <span key={b.level} className={fill(b.level)} style={{ width: `${b.to - b.from}%` }} />
                    ))}
                  </div>
                  <span
                    className="absolute -top-1.5 h-[22px] w-1 -translate-x-1/2 rounded-full bg-white ring-2 ring-cabin-dark"
                    style={{ left: `${clamp(score)}%` }}
                    aria-hidden="true"
                  />
                </div>
                <div className="mt-2 flex text-sm text-sand-300" aria-hidden="true">
                  {scale.map((b) => (
                    <span key={b.level} style={{ width: `${b.to - b.from}%` }} className="truncate pr-1">{b.label}</span>
                  ))}
                </div>
              </div>
            )}
            {risk.applied_overrides && risk.applied_overrides.length > 0 && (
              <p className="mt-5 flex gap-2 text-sm text-coral-peach">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{risk.applied_overrides.join(' ')}</span>
              </p>
            )}
          </div>

          <div className={card('flex flex-col justify-center gap-6 p-6 sm:flex-row sm:justify-around lg:col-span-3 lg:flex-col')}>
            {risk.confidence != null && (
              <Ring
                value={risk.confidence * 100}
                label="Confidence"
                sub={risk.confidence_label || 'unknown'}
                color={confidenceColor(risk.confidence)}
              />
            )}
            <Ring
              value={applicable.length ? (scored.length / applicable.length) * 100 : 0}
              label="Data available"
              sub={`${scored.length} of ${applicable.length} checks available`}
              color={RING.coverage}
            />
          </div>

          <div className={card('flex flex-col p-6 lg:col-span-4')}>
            <p className="eyebrow text-sand-300">Risk breakdown</p>
            <div className="mt-4 flex min-h-40 flex-1 items-end justify-around gap-4" aria-hidden="true">
              {RISK_PARTS.map((p) => {
                const v = scores[p.key];
                return (
                  <div key={p.key} className="flex h-full w-16 flex-col items-center justify-end gap-2">
                    <span className="display text-xl text-white tabular-nums">{v === null ? 'N/A' : v}</span>
                    {v === null ? (
                      <div className="h-full min-h-24 w-full rounded-xl border border-dashed border-sand-300/50" />
                    ) : (
                      <div className={`w-full rounded-xl ${fill(components[p.key]?.level)}`} style={{ height: `${Math.max(clamp(v), 3)}%` }} />
                    )}
                    <span className="text-sm text-sand-300">{p.short}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Row 2: component cards */}
        <ul className="grid gap-5 md:grid-cols-3">
          {RISK_PARTS.map(({ key, label, help, Icon }) => {
            const comp = components[key];
            const status = statusOf(key);
            const value = scores[key];
            const head = (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-sand-50/15">
                    <Icon className="h-4 w-4 text-coral-peach" aria-hidden="true" />
                  </span>
                  <span className="whitespace-nowrap text-lg font-medium text-white">{label}</span>
                </div>
              </div>
            );

            if (status === 'not_applicable') {
              return (
                <li key={key} className={card('p-6')} data-testid={`risk-${key}-component`}>
                  {head}
                  <p className="display mt-5 text-3xl text-sand-100">Not needed</p>
                  <p className="mt-2 text-base text-sand-300 leading-relaxed">{comp?.reason || 'Does not apply to this journey.'}</p>
                </li>
              );
            }

            if (status !== 'available' || value === null) {
              return (
                <li key={key} className={card('border-dashed border-status-caution-bg/40 p-6')} data-testid={`risk-${key}-component`}>
                  {head}
                  <p className="display mt-5 text-3xl text-status-caution-bg">Unavailable</p>
                  <p className="mt-2 text-base text-sand-100 leading-relaxed">{comp?.reason || 'No data for this part of the journey.'}</p>
                  <p className="mt-3 text-sm text-sand-300">Missing information is not treated as safe.</p>
                </li>
              );
            }

            return (
              <li key={key} className={card('p-6')} data-testid={`risk-${key}-component`}>
                {head}
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <p className="display text-5xl text-white tabular-nums">
                    {value}<span className="text-2xl text-sand-300">/100</span>
                  </p>
                  {comp?.level && <Badge status={comp.level} />}
                </div>
                <div
                  className="mt-4 h-1.5 rounded-full bg-sand-50/10"
                  role="img"
                  aria-label={`${label}: ${value} out of 100`}
                >
                  <div className={`h-1.5 rounded-full ${fill(comp?.level)}`} style={{ width: `${clamp(value)}%` }} />
                </div>
                <p className="mt-4 border-t border-sand-50/10 pt-4 text-base text-sand-100 leading-relaxed">{comp?.reason || help}</p>
              </li>
            );
          })}
        </ul>

        {/* Row 3: explanation | confidence, caveats and disclaimer */}
        <div className="grid gap-5 lg:grid-cols-12" data-testid="risk-confidence">
          {explanation.length > 0 && (
            <div className={card('p-6 lg:col-span-7')}>
              <p className="eyebrow text-sand-300">Why this score</p>
              <ul className="mt-4 space-y-3 text-base text-sand-100 leading-relaxed" data-testid="risk-explanation">
                {explanation.map((line) => (
                  <li key={line} className="flex gap-3">
                    <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-coral" aria-hidden="true" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className={`space-y-5 ${explanation.length > 0 ? 'lg:col-span-5' : 'lg:col-span-12'}`}>
            {(risk.confidence != null || notes.length > 0) && (
              <div className={card('space-y-3 p-6')}>
                <p className="eyebrow text-sand-300">What to keep in mind</p>
                {risk.confidence != null && (
                  <p className="text-base text-sand-100">
                    Confidence:{' '}
                    <span className="font-semibold text-white">
                      {(risk.confidence_label || '').toUpperCase()} ({Math.round(risk.confidence * 100)}%)
                    </span>
                  </p>
                )}
                {notes.map((note) => (
                  <p key={note} className="flex gap-2 text-sm text-sand-100 leading-relaxed">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-caution-bg" aria-hidden="true" />
                    <span>{note}</span>
                  </p>
                ))}
              </div>
            )}

            <p className={card('flex gap-2.5 p-5 text-sm text-sand-100 leading-relaxed')}>
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-sand-300" aria-hidden="true" />
              <span>
                {score === null
                  ? 'Without flight, connection or weather data the risk cannot be estimated. Check your flight with your airline.'
                  : `A score of ${score} is a guide, not a ${score}% chance of a delay. Confirm changes with your airline.`}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
