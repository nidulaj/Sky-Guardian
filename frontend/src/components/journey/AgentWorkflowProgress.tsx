'use client';

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

export const CHECKS = [
  { id: 'flight_agent', name: 'Flight status' },
  { id: 'connection_agent', name: 'Connection time' },
  { id: 'weather_agent', name: 'Airport weather' },
  { id: 'risk_agent', name: 'Journey risk' },
  { id: 'policy_agent', name: 'Airline rules' },
  { id: 'alternative_agent', name: 'Backup flights' },
  { id: 'recovery_agent', name: 'Travel advice' },
];

const pad2 = (n: number) => String(n).padStart(2, '0');

export default function AgentWorkflowProgress() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = window.setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section aria-labelledby="progress-title" className="border-y border-ink/15 py-6">
      <div className="flex items-start gap-3">
        <Loader2 className="mt-1 h-5 w-5 shrink-0 animate-spin text-coral" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 id="progress-title" className="text-xl font-semibold text-ink">Checking your journey...</h2>
          <p role="status" className="mt-2 text-base text-ink-soft">Checking flight times, connections and weather.</p>
        </div>
        <span className="font-mono text-sm tabular-nums text-ink-muted" aria-hidden="true">
          {pad2(Math.floor(seconds / 60))}:{pad2(seconds % 60)}
        </span>
      </div>
    </section>
  );
}
