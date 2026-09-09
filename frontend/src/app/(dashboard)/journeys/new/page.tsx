'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { analyzeJourney } from '@/lib/api/client';
import { JourneyAnalysisResponse, FlightLegInput } from '@/types/journey';
import FloatingNavbar from '@/components/ui/FloatingNavbar';
import JourneyScene from '@/components/three/JourneyScene';
import RiskRadarMeter from '@/components/journey/RiskRadarMeter';
import AgentWorkflowProgress from '@/components/journey/AgentWorkflowProgress';
import ExplainabilityDrawer from '@/components/journey/ExplainabilityDrawer';
import {
  Shield,
  Plane,
  AlertCircle,
  Clock,
  CheckCircle2,
  ExternalLink,
  Plus,
  Trash2,
  HelpCircle,
  AlertTriangle,
  ArrowRight,
  Info
} from 'lucide-react';

export default function NewJourneyPage() {
  const [legs, setLegs] = useState<FlightLegInput[]>([
    { flight_number: 'UL001', travel_date: '2026-09-15', origin: 'CMB', destination: 'KUL' },
    { flight_number: 'XX123', travel_date: '2026-09-15', origin: 'KUL', destination: 'NRT' },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<JourneyAnalysisResponse | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await analyzeJourney(legs);
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during journey analysis.');
    } finally {
      setLoading(false);
    }
  };

  const addLeg = () => {
    const lastDest = legs.length > 0 ? legs[legs.length - 1].destination : '';
    setLegs([
      ...legs,
      { flight_number: '', travel_date: '2026-09-15', origin: lastDest, destination: '' }
    ]);
  };

  const removeLeg = (index: number) => {
    if (legs.length > 1) {
      setLegs(legs.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased overflow-x-hidden">
      <FloatingNavbar />

      <main className="max-w-7xl mx-auto px-6 pt-36 pb-20 space-y-10">
        {/* Header Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-6">
          <div>
            <div className="flex items-center space-x-2 text-xs font-mono font-bold text-sky-400 uppercase">
              <Plane className="w-4 h-4" />
              <span>Multi-Leg Disruption Telemetry</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight mt-1">
              Journey Risk & Recovery Analysis
            </h1>
          </div>
          <span className="self-start md:self-auto text-xs font-mono px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400">
            DEMO MODE (Primary Scenario: CMB → KUL → Tokyo)
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Visual Journey Builder */}
          <div className="lg:col-span-5 space-y-6">
            <div className="p-6 rounded-2xl hud-card border border-slate-800 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-sky-400" />
                  <span>Where are you flying?</span>
                </h2>
                <span className="text-xs font-mono text-slate-500 font-bold">{legs.length} LEGS</span>
              </div>

              <form onSubmit={handleAnalyze} className="space-y-4">
                {legs.map((leg, index) => (
                  <div key={index} className="relative">
                    {/* Connecting Line Between Legs */}
                    {index > 0 && (
                      <div className="absolute -top-4 left-6 w-0.5 h-4 bg-sky-500/40 z-10" />
                    )}

                    <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3 relative">
                      <div className="flex justify-between items-center text-xs font-mono font-bold text-sky-400">
                        <span>LEG 0{index + 1}</span>
                        {legs.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLeg(index)}
                            className="text-slate-500 hover:text-red-400 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-mono text-slate-400 mb-1">Flight Number</label>
                        <input
                          type="text"
                          value={leg.flight_number}
                          onChange={(e) => {
                            const newLegs = [...legs];
                            newLegs[index].flight_number = e.target.value;
                            setLegs(newLegs);
                          }}
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm font-mono text-white focus:border-sky-500 focus:outline-none"
                          placeholder="e.g. UL001"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-mono text-slate-400 mb-1">Origin Code</label>
                          <input
                            type="text"
                            value={leg.origin}
                            onChange={(e) => {
                              const newLegs = [...legs];
                              newLegs[index].origin = e.target.value.toUpperCase();
                              setLegs(newLegs);
                            }}
                            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm font-mono text-white uppercase"
                            placeholder="CMB"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-mono text-slate-400 mb-1">Destination Code</label>
                          <input
                            type="text"
                            value={leg.destination}
                            onChange={(e) => {
                              const newLegs = [...legs];
                              newLegs[index].destination = e.target.value.toUpperCase();
                              setLegs(newLegs);
                            }}
                            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm font-mono text-white uppercase"
                            placeholder="KUL"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addLeg}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-xs font-mono text-slate-300 transition flex items-center justify-center space-x-2"
                >
                  <Plus className="w-4 h-4 text-sky-400" />
                  <span>+ Add Connecting Flight Leg</span>
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl shadow-xl shadow-sky-600/25 transition disabled:opacity-50 flex items-center justify-center space-x-2 text-sm border border-sky-400/30"
                >
                  {loading ? (
                    <span>Executing 7 Multi-Agent Graph...</span>
                  ) : (
                    <>
                      <Shield className="w-4 h-4" />
                      <span>Run Disruption Telemetry</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Dynamic Analysis Output */}
          <div className="lg:col-span-7 space-y-6">
            {error && (
              <div className="p-4 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-sm flex items-center space-x-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Execution Loading Animation */}
            {loading && <AgentWorkflowProgress currentStep={7} />}

            {/* Empty State before analysis */}
            {!result && !loading && (
              <div className="p-12 rounded-2xl hud-card border border-dashed border-slate-800 text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 mx-auto animate-pulse">
                  <Plane className="w-8 h-8" />
                </div>
                <div className="space-y-1 max-w-md mx-auto">
                  <h3 className="text-base font-bold text-slate-200">Ready to Analyze Multi-Leg Journey</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Click &quot;Run Disruption Telemetry&quot; to execute the 7 specialized agents (Flight, Connection, Weather, Risk, Policy, Alternative, Recovery) on your travel itinerary.
                  </p>
                </div>
              </div>
            )}

            {/* Analysis Results Display */}
            {result && !loading && (
              <div className="space-y-6">
                {/* 3D Telemetry Canvas */}
                <div className="h-[360px]">
                  <JourneyScene disruptionState="risk" />
                </div>

                {/* Segmented Risk Gauge */}
                <RiskRadarMeter
                  score={result.risk.score}
                  level={result.risk.level}
                  flightScore={result.risk.flight_score}
                  connScore={result.risk.connection_score}
                  weatherScore={result.risk.weather_score}
                />

                {/* Connection Transfer Card */}
                {result.connection && (
                  <div className="p-6 rounded-2xl hud-card border border-red-500/30 space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2 text-xs font-mono font-bold text-slate-400">
                        <Clock className="w-4 h-4 text-red-400" />
                        <span>KUALA LUMPUR (KLIA) TRANSFER FEASIBILITY</span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-red-500/20 text-red-400 border border-red-500/40">
                        {result.connection.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-center font-mono">
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                        <span className="block text-[10px] text-slate-500">AVAILABLE</span>
                        <span className="text-lg font-bold text-red-400">{result.connection.available_minutes} mins</span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                        <span className="block text-[10px] text-slate-500">REQUIRED MCT</span>
                        <span className="text-lg font-bold text-slate-200">{result.connection.minimum_required_minutes} mins</span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                        <span className="block text-[10px] text-slate-500">BUFFER DEFICIT</span>
                        <span className="text-lg font-bold text-red-400">{result.connection.buffer_minutes} mins</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Recovery Recommendation */}
                <div className="p-6 rounded-2xl hud-card border border-sky-500/40 space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                    <h3 className="text-base font-bold text-sky-400 flex items-center space-x-2">
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Grounded Recovery Recommendation</span>
                    </h3>

                    <button
                      onClick={() => setDrawerOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20 text-xs font-mono font-bold flex items-center space-x-1.5 transition"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Why this option?</span>
                    </button>
                  </div>

                  <div className="prose prose-invert max-w-none text-xs sm:text-sm text-slate-300 whitespace-pre-line leading-relaxed">
                    {result.recommendation}
                  </div>
                </div>

                {/* Ranked Alternatives */}
                {result.alternatives.length > 0 && (
                  <div className="p-6 rounded-2xl hud-card border border-slate-800 space-y-4">
                    <h3 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider">
                      Ranked Alternative Recovery Itineraries
                    </h3>

                    <div className="space-y-3">
                      {result.alternatives.map((alt, idx) => (
                        <div
                          key={idx}
                          className={`p-4 rounded-xl border space-y-2 transition ${
                            alt.rank === 1
                              ? 'bg-slate-900/90 border-sky-500/40'
                              : 'bg-slate-950/60 border-slate-800'
                          }`}
                        >
                          <div className="flex justify-between items-center text-xs">
                            <div className="flex items-center space-x-2 font-mono font-bold">
                              {alt.rank === 1 && (
                                <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
                                  RECOMMENDED #1
                                </span>
                              )}
                              <span className="text-slate-200">{alt.route_summary}</span>
                            </div>
                            <span className="text-emerald-400 font-mono font-bold">{alt.policy_eligibility}</span>
                          </div>

                          <div className="text-[11px] text-slate-400 flex justify-between font-mono pt-1">
                            <span>Departure: {alt.departure}</span>
                            <span>Risk Score: {alt.risk_score}/100 ({alt.risk_level})</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Grounded Policy Evidence */}
                {result.policy_evidence.length > 0 && (
                  <div className="p-6 rounded-2xl hud-card border border-slate-800 space-y-4">
                    <h3 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider">
                      Grounded Airline Policy Evidence (RAG)
                    </h3>

                    <div className="space-y-3">
                      {result.policy_evidence.map((pol, idx) => (
                        <div key={idx} className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-200">{pol.airline} — {pol.title}</span>
                            <a
                              href={pol.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sky-400 hover:underline flex items-center space-x-1 font-mono text-[11px]"
                            >
                              <span>Official Policy Source</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                          <p className="text-slate-400 bg-slate-900/80 p-2.5 rounded-lg italic border border-slate-800/80">
                            &quot;{pol.snippet}&quot;
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Explainability Side Drawer */}
      <ExplainabilityDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sources={result?.sources || []}
        traceId={result?.trace_id}
      />
    </div>
  );
}
