'use client';

import React from 'react';
import { Plane, Clock, CloudRain, ShieldAlert, FileText, Route, CheckCircle2 } from 'lucide-react';

const AGENTS = [
  { id: 'flight_agent', name: 'Flight Agent', icon: Plane, desc: 'Verifying schedule estimates & delays (+90m detected)' },
  { id: 'connection_agent', name: 'Connection Agent', icon: Clock, desc: 'Calculating transfer window buffer (30m vs 60m MCT)' },
  { id: 'weather_agent', name: 'Weather Agent', icon: CloudRain, desc: 'Evaluating airport weather context (KUL thunderstorms)' },
  { id: 'risk_agent', name: 'Risk Agent', icon: ShieldAlert, desc: 'Computing unhallucinated weighted risk score (79/100)' },
  { id: 'policy_agent', name: 'Policy Agent', icon: FileText, desc: 'Retrieving grounded airline Conditions of Carriage' },
  { id: 'alternative_agent', name: 'Alternative Agent', icon: Route, desc: 'Searching & ranking viable recovery itineraries' },
  { id: 'recovery_agent', name: 'Recovery Agent', icon: CheckCircle2, desc: 'Synthesizing explainable passenger recommendation' },
];

interface AgentWorkflowProgressProps {
  currentStep?: number;
}

export default function AgentWorkflowProgress({ currentStep = 7 }: AgentWorkflowProgressProps) {
  return (
    <div className="p-8 rounded-2xl hud-card border border-sky-500/30 space-y-6 relative overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping" />
            <span>Supervisor Orchestrator Active</span>
          </h3>
          <p className="text-xs text-slate-400">Sequential multi-agent execution pipeline running on shared journey state.</p>
        </div>
        <span className="text-xs font-mono px-3 py-1 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/30 font-bold">
          7 AGENTS RUNNING
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {AGENTS.map((agent, index) => {
          const Icon = agent.icon;
          const isActive = index < currentStep;

          return (
            <div
              key={agent.id}
              className={`p-4 rounded-xl border transition-all flex items-start space-x-3 duration-300 ${
                isActive
                  ? 'bg-slate-900/90 border-sky-500/40 shadow-lg shadow-sky-500/10'
                  : 'bg-slate-950/40 border-slate-800 opacity-50'
              }`}
            >
              <div
                className={`p-2.5 rounded-xl border flex-shrink-0 ${
                  isActive
                    ? 'bg-sky-500/20 border-sky-400 text-sky-400'
                    : 'bg-slate-900 border-slate-800 text-slate-500'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono text-slate-500 font-bold">AGENT 0{index + 1}</span>
                  <h4 className="text-sm font-bold text-slate-200">{agent.name}</h4>
                </div>
                <p className="text-xs text-slate-400 leading-snug">{agent.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
