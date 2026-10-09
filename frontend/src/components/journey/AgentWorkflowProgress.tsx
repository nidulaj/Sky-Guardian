'use client';

import React, { useEffect, useState } from 'react';

// What each agent does. Deliberately generic: this list never shows results, only the order of work.
export const AGENTS = [
  { name: 'Journey risk agent', title: 'Builds the risk score', desc: 'Checks each flight, the transfer time and the airport weather, then scores the trip 0–100.' },
  { name: 'Policy agent', title: 'Finds airline rules', desc: 'Rebooking and care policies that may apply to your trip.' },
  { name: 'Alternative agent', title: 'Ranks other routes', desc: 'Backup routes if the original plan looks shaky.' },
  { name: 'Recovery agent', title: 'Writes your advice', desc: 'A plain-language summary of what to do next.' },
];

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Honest progress indicator: the analysis is one request, so we show the agent order and elapsed time, not fake per-step results. */
export default function AgentWorkflowProgress() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = window.setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section aria-labelledby="progress-title" className="rounded-4xl bg-mist px-5 py-7 sm:px-8 sm:py-9">
      <p role="status" className="sr-only">
        Checking your journey. This usually takes a few seconds.
      </p>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink/20 pb-5">
        <div>
          <p className="font-mono text-xs uppercase tracking-label text-ink">In progress / 4 agents</p>
          <h2 id="progress-title" className="display mt-3 text-3xl sm:text-4xl text-ink">
            Checking your <span className="accent">journey…</span>
          </h2>
          <p className="mt-3 max-w-md text-base text-ink leading-relaxed">
            Four agents work through your trip in this order. It usually takes a few seconds.
          </p>
        </div>
        <p className="text-right" aria-hidden="true">
          <span className="block font-mono text-xs uppercase tracking-label text-ink">Elapsed</span>
          <span className="display mt-1 block text-4xl sm:text-5xl font-light text-ink tabular-nums">
            {pad2(Math.floor(seconds / 60))}:{pad2(seconds % 60)}
          </span>
        </p>
      </div>

      <ol className="mt-2">
        {AGENTS.map((agent, i) => (
          <li key={agent.name} className="grid grid-cols-[3rem_1.25rem_minmax(0,1fr)] sm:grid-cols-[4.5rem_1.5rem_minmax(0,1fr)] gap-x-3 sm:gap-x-4">
            <span className="display pt-4 text-3xl sm:text-4xl font-light text-ink tabular-nums" aria-hidden="true">
              {pad2(i + 1)}
            </span>
            <span className="relative flex justify-center" aria-hidden="true">
              <span className={`absolute w-px bg-ink/40 ${i === 0 ? 'top-6' : 'top-0'} ${i === AGENTS.length - 1 ? 'h-6' : 'bottom-0'}`} />
              <span
                className="relative mt-[1.15rem] h-2.5 w-2.5 rounded-full bg-coral-deep animate-pulse-dot"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            </span>
            <div className={`min-w-0 py-4 ${i > 0 ? 'border-t border-ink/15' : ''}`}>
              <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-mono text-xs uppercase tracking-label text-ink">{agent.name}</span>
                <span className="text-lg font-semibold text-ink">{agent.title}</span>
              </p>
              <p className="mt-1 text-base text-ink-soft leading-relaxed">{agent.desc}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
