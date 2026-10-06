'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import FloatingNavbar from '@/components/ui/FloatingNavbar';
import JourneyScene from '@/components/three/JourneyScene';
import RiskRadarMeter from '@/components/journey/RiskRadarMeter';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import WeatherAgentCard from '@/components/weather/WeatherAgentCard';
import {
  Shield,
  Plane,
  AlertTriangle,
  Clock,
  CheckCircle2,
  CloudRain,
  FileText,
  Route,
  ArrowRight,
  Sparkles,
  ExternalLink,
  Mic,
  Globe2
} from 'lucide-react';

export default function LandingPage() {
  const [selectedLang, setSelectedLang] = useState<'en' | 'si' | 'ta'>('en');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased overflow-x-hidden selection:bg-sky-500 selection:text-white">
      {/* Floating Navbar */}
      <FloatingNavbar />

      {/* ============================================================ */}
      {/* SECTION 1: HERO */}
      {/* ============================================================ */}
      <section id="overview" className="relative min-h-screen pt-32 pb-20 px-6 flex flex-col justify-center max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Hero Text */}
          <div className="lg:col-span-7 space-y-8 animate-fade-in">
            <div className="inline-flex items-center space-x-2.5 px-3.5 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-mono font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Multi-Agent Proactive Disruption Platform</span>
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.08] text-white">
              Predict the disruption.{' '}
              <span className="bg-gradient-to-r from-sky-400 via-sky-300 to-emerald-400 bg-clip-text text-transparent">
                Protect the journey.
              </span>
            </h1>

            <p className="text-lg text-slate-400 max-w-2xl leading-relaxed">
              SkyGuardian AI continuously evaluates multi-leg flights, calculates deterministic transfer feasibility, retrieves grounded airline policies via RAG, and delivers explainable recovery guidance before you get stranded.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-4 sm:space-y-0 sm:space-x-4 pt-2">
              <Link href="/journeys/new">
                <Button variant="primary" size="lg" className="w-full sm:w-auto">
                  <Plane className="w-5 h-5 mr-2" />
                  <span>Analyze My Journey</span>
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                  See How It Works
                </Button>
              </a>
            </div>

            {/* Quick Stats Bar */}
            <div className="pt-8 grid grid-cols-3 gap-6 border-t border-slate-800/80 text-xs font-mono">
              <div>
                <span className="block text-slate-500">ARCHITECTURE</span>
                <span className="text-sm font-bold text-slate-200">7 Worker Agents</span>
              </div>
              <div>
                <span className="block text-slate-500">REASONING</span>
                <span className="text-sm font-bold text-slate-200">Deterministic + RAG</span>
              </div>
              <div>
                <span className="block text-slate-500">DEMO SCENARIO</span>
                <span className="text-sm font-bold text-sky-400">CMB → KUL → Tokyo</span>
              </div>
            </div>
          </div>

          {/* Right 3D Globe Telemetry Card */}
          <div className="lg:col-span-5 h-[480px] relative">
            <JourneyScene disruptionState="risk" />
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 2: THE PROBLEM */}
      {/* ============================================================ */}
      <section id="how-it-works" className="py-24 px-6 border-t border-slate-900 bg-slate-950/60">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="text-xs font-mono font-bold text-sky-400 uppercase tracking-widest">
              THE MULTI-LEG DISRUPTION TRAP
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              One delayed flight can affect your entire journey.
            </h2>
            <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
              Standard airline apps display basic flight updates: &quot;Flight delayed 90 minutes.&quot; But they leave passengers guessing what happens to their tight connecting flights.
            </p>
          </div>

          {/* Scenario Graphic Card */}
          <Card variant="warning" className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
            <div className="space-y-2">
              <span className="text-xs font-mono text-slate-500 font-bold">LEG 01 — INBOUND</span>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold text-white font-mono">CMB</span>
                <span className="text-slate-500">→</span>
                <span className="text-xl font-bold text-white font-mono">KUL</span>
              </div>
              <Badge status="DELAYED" label="UL001 Delayed +90 Minutes" />
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-1">
              <span className="text-xs font-mono text-slate-400">TRANSFER AT KLIA</span>
              <div className="text-lg font-bold text-red-400 font-mono">30m Available vs 60m MCT</div>
              <Badge status="LIKELY_MISSED" label="Likely Missed Transfer" />
            </div>

            <div className="space-y-2 text-right">
              <span className="text-xs font-mono text-slate-500 font-bold">LEG 02 — CONNECTING</span>
              <div className="flex items-center justify-end space-x-2">
                <span className="text-xl font-bold text-white font-mono">KUL</span>
                <span className="text-slate-500">→</span>
                <span className="text-xl font-bold text-white font-mono">NRT</span>
              </div>
              <p className="text-xs text-slate-400 font-mono">Scheduled Departure: 17:30 UTC</p>
            </div>
          </Card>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 3: MULTI-AGENT ARCHITECTURE */}
      {/* ============================================================ */}
      <section id="agents" className="py-24 px-6 border-t border-slate-900">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="text-xs font-mono font-bold text-sky-400 uppercase tracking-widest">
              SUPERVISOR-WORKER ARCHITECTURE
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              Seven specialized agents. One explainable recommendation.
            </h2>
            <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
              SkyGuardian AI avoids unmanaged chatbot conversations. Each agent operates with strict schemas, permitted tools, and deterministic guardrails under central supervisor control.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                <Plane className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">1. Flight Agent</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Verifies flight numbers, departure/arrival timestamps, delays, diversions, and gate status via provider abstraction.
              </p>
            </Card>

            <Card className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">2. Connection Agent</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Computes transfer window arithmetic: <code className="font-mono text-[11px] text-amber-300">available = departure - arrival</code> against minimum connection time.
              </p>
            </Card>

            <Card className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                <CloudRain className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">3. Weather Agent</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Retrieves severe weather context, visibility, and thunderstorm risks at transfer hubs without fake causation claims.
              </p>
            </Card>

            <Card className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">4. Risk Agent</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Calculates configurable weighted risk score: <code className="font-mono text-[11px] text-red-300">40% Flight + 35% Connection + 25% Weather</code>.
              </p>
            </Card>

            <Card className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">5. Policy Agent</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Retrieves verified airline Conditions of Carriage policy documents and fresh web data via pgvector RAG + Tavily allowlist.
              </p>
            </Card>

            <Card className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                <Route className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">6. Alternative Agent</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Filters invalid routes and ranks viable alternatives using arrival quality, transfer safety, and policy eligibility algorithms.
              </p>
            </Card>

            <Card variant="active" className="space-y-3 md:col-span-2">
              <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400 flex items-center justify-center text-sky-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">7. Recovery Agent</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Synthesizes outputs into a clear decision-support recovery recommendation with grounded explainability, warnings, and next steps.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 3B: LIVE WEATHER AGENT */}
      {/* ============================================================ */}
      <section id="weather" className="py-24 px-6 border-t border-slate-900">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-mono font-bold text-sky-400 uppercase tracking-widest">
              LIVE WEATHER AGENT
            </span>
            <h2 className="text-3xl font-extrabold text-white">Airport Weather Risk, Scored Hourly</h2>
            <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
              The Weather Agent retrieves the hourly airport forecast and scores visibility, wind, gusts, precipitation and thunderstorms with the same deterministic rules the Risk Agent uses.
            </p>
          </div>

          <WeatherAgentCard defaultAirport="CMB" />
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 4: RISK INTELLIGENCE DEMO */}
      {/* ============================================================ */}
      <section id="risk-engine" className="py-24 px-6 border-t border-slate-900 bg-slate-950/60">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-mono font-bold text-sky-400 uppercase tracking-widest">
              DETERMINISTIC RISK ENGINE
            </span>
            <h2 className="text-3xl font-extrabold text-white">Unhallucinated Journey Risk Telemetry</h2>
          </div>

          <RiskRadarMeter score={79} level="HIGH" flightScore={80} connScore={90} weatherScore={60} />
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 5: MULTILINGUAL VOICE PREVIEW */}
      {/* ============================================================ */}
      <section className="py-24 px-6 border-t border-slate-900">
        <div className="max-w-4xl mx-auto space-y-8 text-center">
          <div className="space-y-3">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-mono text-slate-400">
              <Globe2 className="w-3.5 h-3.5 text-sky-400" />
              <span>Multilingual Travel Assistance</span>
            </div>
            <h2 className="text-3xl font-extrabold text-white">
              Travel assistance in the language you are comfortable with.
            </h2>
          </div>

          <Card className="max-w-xl mx-auto space-y-6">
            <div className="flex justify-center space-x-3">
              <button
                onClick={() => setSelectedLang('en')}
                className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition ${
                  selectedLang === 'en' ? 'bg-sky-600 text-white' : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}
              >
                English
              </button>
              <button
                onClick={() => setSelectedLang('si')}
                className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition ${
                  selectedLang === 'si' ? 'bg-sky-600 text-white' : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}
              >
                සිංහල
              </button>
              <button
                onClick={() => setSelectedLang('ta')}
                className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition ${
                  selectedLang === 'ta' ? 'bg-sky-600 text-white' : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}
              >
                தமிழ்
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300">
              {selectedLang === 'en' && '"Will I miss my connecting flight at Kuala Lumpur?"'}
              {selectedLang === 'si' && '"මගේ කුවාලලම්පූර් සම්බන්ධක ගුවන් ගමන මගහැරෙයිද?"'}
              {selectedLang === 'ta' && '"கோலாலம்பூரில் எனது இணைப்பு விமானத்தை நான் தவறவிடுவேனா?"'}
            </div>

            <div className="flex items-center justify-center space-x-2 text-xs text-slate-500 font-mono">
              <Mic className="w-4 h-4 text-sky-400" />
              <span>Voice Agent (Future Phase — Coming Soon)</span>
            </div>
          </Card>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 6: CLOSING CTA */}
      {/* ============================================================ */}
      <section className="py-24 px-6 border-t border-slate-900 bg-gradient-to-b from-slate-950 to-navy-950 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 mx-auto glow-cyan">
            <Shield className="w-8 h-8" />
          </div>

          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
            Travel disruption is complex.{' '}
            <span className="text-sky-400">Your next move shouldn&apos;t be.</span>
          </h2>

          <p className="text-slate-400 max-w-xl mx-auto text-sm sm:text-base">
            Analyze your multi-leg journey in seconds and receive an unhallucinated, explainable recovery recommendation.
          </p>

          <div>
            <Link href="/journeys/new">
              <Button variant="primary" size="lg">
                <Plane className="w-6 h-6 mr-2" />
                <span>Analyze My Journey Now</span>
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-8 text-center text-xs text-slate-500 font-mono space-y-2">
        <p>SkyGuardian AI — Team Novax Multi-Agent Aviation Risk Platform</p>
        <p className="text-[11px] text-slate-600">
          Decision-support platform. Flight updates and policies are retrieved from available sources. Confirm critical travel actions with your carrier.
        </p>
      </footer>
    </div>
  );
}
