'use client';

import React from 'react';
import { ShieldAlert, AlertTriangle, Info } from 'lucide-react';

interface RiskRadarMeterProps {
  score: number;
  level: 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH';
  flightScore?: number;
  connScore?: number;
  /** null = weather data missing: shown as "Unavailable", never as a score. */
  weatherScore?: number | null;
  weatherUnavailableReason?: string | null;
  /** 0-1 overall confidence from the Risk Agent, with its high/medium/low label. */
  confidence?: number | null;
  confidenceLabel?: string | null;
  /** Risk Agent uncertainty notes (missing data, possible score range). */
  notes?: string[];
}

export default function RiskRadarMeter({
  score = 79,
  level = 'HIGH',
  flightScore = 80,
  connScore = 90,
  weatherScore = 60,
  weatherUnavailableReason = null,
  confidence = null,
  confidenceLabel = null,
  notes = [],
}: RiskRadarMeterProps) {
  const weatherMissing = weatherScore === null;

  const getLevelBadge = () => {
    switch (level) {
      case 'VERY_HIGH':
      case 'HIGH':
        return 'bg-red-500/20 text-red-400 border-red-500/40 glow-red';
      case 'MODERATE':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40 glow-amber';
      default:
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
    }
  };

  return (
    <div className="p-6 rounded-2xl hud-card border border-slate-800 space-y-6 relative overflow-hidden">
      {/* Background Radar Sweeper */}
      <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full border border-sky-500/10 pointer-events-none opacity-40 animate-pulse-slow" />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-xs font-mono text-slate-400 font-bold uppercase">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span>Estimated Journey Disruption Risk</span>
          </div>
          <div className="flex items-baseline space-x-3">
            <span className="text-4xl md:text-5xl font-extrabold font-mono tracking-tight text-amber-400">
              {score}
              <span className="text-xl text-slate-500 font-normal"> / 100</span>
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-bold font-mono border ${getLevelBadge()}`}>
              {level} RISK
            </span>
          </div>
        </div>

        <div className="text-xs text-slate-400 bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-1">
          <div className="flex items-center space-x-1.5 text-slate-300 font-semibold">
            <Info className="w-3.5 h-3.5 text-sky-400" />
            <span>Decision-Support Score</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-snug">
            Deterministic weighted analysis. Not a statistical probability.
          </p>
        </div>
      </div>

      {/* Segmented Risk Breakdown Bars */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-800/80">
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-slate-400">Flight Status (40%)</span>
            <span className="text-amber-400 font-bold">{flightScore}/100</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
            <div className="h-full bg-amber-400 rounded-full" style={{ width: `${flightScore}%` }} />
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-slate-400">Connection (35%)</span>
            <span className="text-red-400 font-bold">{connScore}/100</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
            <div className="h-full bg-red-400 rounded-full" style={{ width: `${connScore}%` }} />
          </div>
        </div>

        <div
          className={`p-3 rounded-xl bg-slate-950/60 border space-y-2 ${weatherMissing ? 'border-amber-500/40' : 'border-slate-800/80'}`}
          data-testid="risk-weather-component"
        >
          <div className="flex justify-between text-xs font-mono">
            <span className="text-slate-400">Weather (25%)</span>
            {weatherMissing ? (
              <span className="text-amber-300 font-bold">Unavailable</span>
            ) : (
              <span className="text-sky-400 font-bold">{weatherScore}/100</span>
            )}
          </div>
          {weatherMissing ? (
            <p className="text-[11px] text-slate-500 leading-snug">
              {weatherUnavailableReason || 'No weather data for this journey.'}
            </p>
          ) : (
            <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
              <div className="h-full bg-sky-400 rounded-full" style={{ width: `${weatherScore}%` }} />
            </div>
          )}
        </div>
      </div>

      {(confidence !== null || notes.length > 0) && (
        <div className="space-y-1.5 text-[11px] font-mono" data-testid="risk-confidence">
          {confidence !== null && (
            <div className="text-slate-400">
              Confidence:{' '}
              <span className={`font-bold ${confidence >= 0.8 ? 'text-emerald-400' : 'text-amber-300'}`}>
                {(confidenceLabel || '').toUpperCase()} ({Math.round(confidence * 100)}%)
              </span>
            </div>
          )}
          {notes.map((note) => (
            <div key={note} className="flex items-start space-x-1.5 text-amber-300/90">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{note}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
