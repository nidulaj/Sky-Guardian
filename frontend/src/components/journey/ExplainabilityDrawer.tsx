'use client';

import React from 'react';
import { X, ShieldCheck, FileText, Clock, CloudRain, ExternalLink } from 'lucide-react';

interface ExplainabilityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sources?: any[];
  traceId?: string;
}

export default function ExplainabilityDrawer({ isOpen, onClose, sources = [], traceId = 'trace-demo-123' }: ExplainabilityDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl hud-card border border-sky-500/40 p-6 space-y-6 text-slate-100 shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Why did SkyGuardian recommend this?</h3>
              <p className="text-xs text-slate-400 font-mono">Explainable Audit Trace: {traceId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Explainability Breakdown Sections */}
        <div className="space-y-4 text-xs">
          {/* Factor 1 */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between font-bold text-slate-200">
              <span className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>01. Inbound Flight Delay (+90 Minutes)</span>
              </span>
              <span className="font-mono text-amber-400">STATUS: DELAYED</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              UL001 scheduled arrival was 15:30 UTC, but actual estimated arrival shifted to 17:00 UTC due to departure ground delay at CMB.
            </p>
          </div>

          {/* Factor 2 */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between font-bold text-slate-200">
              <span className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-red-400" />
                <span>02. Transfer Buffer Deficit (-30 Minutes)</span>
              </span>
              <span className="font-mono text-red-400">STATUS: LIKELY MISSED</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Next leg (XX123 to NRT) departs at 17:30 UTC. Available connection window is 30 minutes vs Kuala Lumpur International Airport (KLIA) minimum connection time (MCT) requirement of 60 minutes.
            </p>
          </div>

          {/* Factor 3 */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between font-bold text-slate-200">
              <span className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-sky-400" />
                <span>03. Airline Policy Protection (SriLankan Airlines & Malaysia Airlines)</span>
              </span>
              <span className="font-mono text-emerald-400 font-bold">VERIFIED PROTECTED</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Under conditions of carriage for single-ticket interline itineraries, passengers missing connections due to carrier delay are entitled to zero-fee rebooking on the next available connecting flight and meal/accommodation vouchers if layovers exceed 4 hours.
            </p>
          </div>
        </div>

        {/* Verified Data Sources */}
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
            Verified Information Sources
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {sources.map((s, i) => (
              <div key={i} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-300 font-medium truncate">{s.name}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  {s.type}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
