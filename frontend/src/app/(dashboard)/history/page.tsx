'use client';

import React from 'react';
import Link from 'next/link';
import FloatingNavbar from '@/components/ui/FloatingNavbar';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { History, Plane, ArrowRight, Shield, Clock } from 'lucide-react';

export default function HistoryPage() {
  const pastJourneys = [
    {
      id: 'jrn-demo-001',
      date: '2026-09-15',
      route: 'CMB → KUL → NRT (Tokyo)',
      status: 'HIGH_RISK',
      riskScore: 79,
      issue: 'Connection time window deficit (-30m MCT at KLIA)',
      recommendation: 'Complimentary SriLankan Airlines connection protection rebooking via MH088',
    },
    {
      id: 'jrn-demo-002',
      date: '2026-08-10',
      route: 'CMB → SIN → SYD (Sydney)',
      status: 'SAFE',
      riskScore: 18,
      issue: 'No critical disruption identified',
      recommendation: 'Standard transfer window sufficient at Changi (SIN)',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased">
      <FloatingNavbar />

      <main className="max-w-7xl mx-auto px-6 pt-32 pb-20 space-y-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-6">
          <div>
            <div className="flex items-center space-x-2 text-xs font-mono font-bold text-sky-400 uppercase">
              <History className="w-4 h-4" />
              <span>Historical Disruption Audits</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight mt-1">
              Journey History
            </h1>
          </div>

          <Link href="/journeys/new">
            <Button variant="primary" size="sm">
              <Plane className="w-3.5 h-3.5 mr-2" />
              <span>Analyze New Journey</span>
            </Button>
          </Link>
        </div>

        {/* History Table / Cards */}
        <div className="space-y-4">
          {pastJourneys.map((j) => (
            <Card key={j.id} variant={j.status === 'HIGH_RISK' ? 'warning' : 'default'} className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-mono text-slate-500 font-bold">{j.date}</span>
                  <h3 className="text-lg font-bold text-white font-mono">{j.route}</h3>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-mono text-slate-400">Risk Score: <strong className="text-amber-400 font-bold">{j.riskScore}/100</strong></span>
                  <Badge status={j.status} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                <div>
                  <span className="text-slate-500 block">PRIMARY TELEMETRY ISSUE</span>
                  <span className="text-slate-300 font-semibold">{j.issue}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">GROUNDED RECOVERY RECOMMENDATION</span>
                  <span className="text-sky-300 font-semibold">{j.recommendation}</span>
                </div>
              </div>

              <div className="pt-2 flex justify-between items-center text-xs font-mono text-slate-500 border-t border-slate-800/50">
                <span>Trace ID: {j.id}</span>
                <Link href="/journeys/new" className="text-sky-400 hover:underline flex items-center space-x-1 font-bold">
                  <span>Re-analyze Route</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
