'use client';

import React from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Shield, Plane, AlertTriangle, ArrowRight, Clock, Plus } from 'lucide-react';

export default function DashboardPage() {
  return (
    <main className="max-w-7xl mx-auto px-6 pt-36 pb-20 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-6">
        <div>
          <span className="text-xs font-mono font-bold text-sky-400 uppercase">Aviation Flight Operations</span>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mt-1">
            Passenger Disruption Radar
          </h1>
        </div>
        <Link href="/journeys/new">
          <Button variant="primary" size="sm">
            <Plus className="w-4 h-4 mr-1.5" />
            <span>Analyze New Journey</span>
          </Button>
        </Link>
      </div>

      {/* Primary Active Journey Card */}
      <Card variant="warning" className="space-y-6">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <span className="text-xs font-mono text-slate-400 font-bold uppercase">ACTIVE DEMO ITINERARY</span>
            <h3 className="text-2xl font-extrabold text-white font-mono">CMB → KUL → NRT (Tokyo)</h3>
          </div>
          <Badge status="HIGH_RISK" label="HIGH DISRUPTION RISK (79/100)" />
        </div>

        {/* Leg Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400">LEG 1: UL001 (CMB → KUL)</span>
              <Badge status="DELAYED" label="+90m DELAY" />
            </div>
            <p className="text-xs text-slate-300 font-mono">Scheduled: 15:30 UTC | Estimated: 17:00 UTC</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400">LEG 2: XX123 (KUL → NRT)</span>
              <Badge status="LIKELY_MISSED" label="TRANSFER LIKELY MISSED" />
            </div>
            <p className="text-xs text-slate-300 font-mono">30m window available vs 60m required MCT</p>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <Link href="/journeys/new">
            <Button variant="primary" size="sm">
              <span>View Full Disruption Telemetry</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </Card>
    </main>
  );
}
