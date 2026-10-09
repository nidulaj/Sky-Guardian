import React from 'react';
import SectionHeading from './SectionHeading';

const STEPS = [
  {
    label: 'Your trip',
    title: 'Tell us your flights.',
    body: 'Add each flight number and travel date.',
  },
  {
    label: 'Tools',
    title: 'We gather the facts.',
    body: 'Live flight status, the transfer time at each hub and the weather at every airport on your route.',
  },
  {
    label: 'Journey risk agent',
    title: 'We score the risk.',
    body: 'Flight, connection and weather combine into one 0–100 score you can check, and the agent decides if recovery is needed.',
  },
  {
    label: 'Policy agent',
    title: 'We check the rules.',
    body: 'If things look tight, it finds the airline rules that apply, with links to where each rule comes from.',
  },
  {
    label: 'Alternative agent',
    title: 'We find other routes.',
    body: 'Backup routes, ranked by arrival time, transfer safety and how well they fit the airline rules.',
  },
  {
    label: 'Recovery agent',
    title: 'We explain your options.',
    body: 'One clear recommendation and next steps, in plain language. You decide what to do.',
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-4 px-2 pt-2 sm:px-3 sm:pt-3">
      <div className="rounded-4xl bg-mist">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
          <SectionHeading
            id="how-title"
            eyebrow="How it works"
            eyebrowClass="text-ink-soft"
            title="Six steps,"
            accent="one clear answer."
            accentClass="text-coral-deep"
            description="A supervisor passes your trip through four agents in a fixed order. Each one does a single job and hands its result to the next."
          />

          <ol className="mt-16 sm:mt-20">
            {STEPS.map((step, i) => {
              const first = i === 0;
              const last = i === STEPS.length - 1;
              const n = String(i + 1).padStart(2, '0');
              return (
                <li
                  key={step.label}
                  className="grid grid-cols-[24px_1fr] gap-x-4 sm:grid-cols-[32px_1fr] lg:grid-cols-[minmax(0,260px)_56px_1fr] lg:gap-x-0"
                >
                  {/* Step numeral (large screens) */}
                  <div className="hidden pt-7 lg:block">
                    <p className="font-mono text-xs uppercase tracking-label text-ink-soft">Step</p>
                    <p className="display mt-1 text-7xl font-light text-ink xl:text-8xl" aria-hidden="true">
                      {n}
                    </p>
                  </div>

                  {/* Rail */}
                  <div className="relative" aria-hidden="true">
                    <span
                      className={`absolute left-1/2 w-px -translate-x-1/2 bg-ink/40 ${first ? 'top-9' : 'top-0'} ${
                        last ? 'h-9' : 'bottom-0'
                      }`}
                    />
                    <span className="absolute left-1/2 top-9 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-coral ring-4 ring-mist" />
                  </div>

                  {/* Content */}
                  <div className="grid gap-3 border-t border-ink/20 pb-10 pt-6 sm:pb-12 md:grid-cols-[180px_1fr] md:gap-8 lg:grid-cols-[170px_minmax(0,1fr)_minmax(0,0.9fr)] lg:pb-16">
                    <p className="font-mono text-xs uppercase tracking-label text-ink-soft md:pt-3">
                      <span className="lg:hidden">Step {n} · </span>
                      {step.label}
                    </p>
                    <h3 className="display text-3xl text-ink sm:text-4xl">{step.title}</h3>
                    <p className="text-base leading-relaxed text-ink-soft md:col-start-2 lg:col-start-auto lg:pt-2">
                      {step.body}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>

          <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-soft">
            The Policy and Alternative agents only run when the score reaches 60 or the connection is at risk.
            Either way, the Recovery agent finishes with a plain-language summary.
          </p>
        </div>
      </div>
    </section>
  );
}
