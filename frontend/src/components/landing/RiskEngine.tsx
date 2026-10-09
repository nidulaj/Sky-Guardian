import React from 'react';
import { Info } from 'lucide-react';
import Badge from '@/components/ui/Badge';

const LEVELS = [
  { status: 'LOW', label: 'Low', meaning: 'Your journey looks on track.' },
  { status: 'MODERATE', label: 'Moderate', meaning: 'Keep an eye on flight updates and your connection.' },
  { status: 'HIGH', label: 'High', meaning: 'Check backup flights and contact your airline.' },
  { status: 'VERY_HIGH', label: 'Very high', meaning: 'Your journey may be disrupted. Ask your airline for help.' },
];

export default function RiskEngine() {
  return (
    <section id="risk-engine" aria-labelledby="risk-title" className="scroll-mt-4">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
        <p className="eyebrow text-ink-soft">Risk levels</p>
        <h2 id="risk-title" className="display mt-4 text-4xl text-ink sm:text-5xl">
          What your <span className="accent text-coral">risk means.</span>
        </h2>
        <p className="mt-4 max-w-xl text-base text-ink-soft">
          Based on flight status, connection time and airport weather.
        </p>
        <ul className="mt-8 divide-y divide-ink/15 border-y border-ink/15">
          {LEVELS.map((level) => (
            <li key={level.status} className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:gap-6">
              <Badge status={level.status} label={level.label} className="w-fit min-w-24 justify-center" />
              <p className="text-base text-ink-soft">{level.meaning}</p>
            </li>
          ))}
        </ul>
        <p className="mt-6 flex max-w-xl gap-2 text-sm text-ink-muted">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          The score is a guide, not the chance of a delay. Confirm flight changes with your airline.
        </p>
      </div>
    </section>
  );
}
