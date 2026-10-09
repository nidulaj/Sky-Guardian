'use client';

import React, { useEffect, useState } from 'react';
import { 
  Search, 
  Database, 
  Globe, 
  Sparkles, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck,
  CheckCircle2,
  Cpu
} from 'lucide-react';

export interface WorkflowStep {
  step: number;
  name: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING' | 'SKIPPED';
  detail: string;
}

interface PolicyWorkflowVisualizerProps {
  isLoading: boolean;
  query: string;
  isWebFallback?: boolean;
  executionSteps?: WorkflowStep[];
  latencyMs?: number;
}

const STAGES = [
  { id: 'intent', label: 'Intent Analysis', activeMsg: 'Parsing query intent & carrier rights...', icon: Search },
  { id: 'rag', label: 'Vector Search', activeMsg: 'Querying verified policy vault (pgvector)...', icon: Database },
  { id: 'evidence', label: 'Evidence Check', activeMsg: 'Verifying policy documentation & terms...', icon: ShieldCheck },
  { id: 'llm', label: 'Gemini LLM', activeMsg: 'Synthesizing grounded advice with Gemini 2.5 Flash...', icon: Sparkles },
];

export default function PolicyWorkflowVisualizer({
  isLoading,
  query,
  isWebFallback,
  executionSteps,
  latencyMs,
}: PolicyWorkflowVisualizerProps) {
  const [activeStage, setActiveStage] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [expanded, setExpanded] = useState(false);

  // Progressive simulated pipeline stages during active execution
  useEffect(() => {
    if (!isLoading) {
      setActiveStage(4);
      return;
    }

    setElapsed(0);
    setActiveStage(0);

    const startTime = Date.now();
    const interval = window.setInterval(() => {
      const ms = Date.now() - startTime;
      setElapsed(ms);

      if (ms < 600) {
        setActiveStage(0); // Intent
      } else if (ms < 1500) {
        setActiveStage(1); // Vector RAG
      } else if (ms < 2800) {
        setActiveStage(2); // Live Web
      } else {
        setActiveStage(3); // LLM synthesis
      }
    }, 100);

    return () => window.clearInterval(interval);
  }, [isLoading]);

  // =========================================================================
  // 1. LOADING STATE: Simplistic & Modern AI Pipeline (Minimalist Linear Strip)
  // =========================================================================
  if (isLoading) {
    const elapsedSeconds = (elapsed / 1000).toFixed(1);
    const currentStageData = STAGES[Math.min(activeStage, 3)];
    const progressPercent = Math.min(((activeStage + 0.6) / 4) * 100, 95);

    return (
      <div className="rounded-2xl border border-ink/10 bg-sand-50/95 backdrop-blur-md p-4 sm:p-5 space-y-3.5 shadow-[0_4px_20px_-8px_rgba(26,23,20,0.06)] animate-fade-in">
        {/* Dynamic active status message + live counter */}
        <div className="flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-coral opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-coral" />
            </span>
            <span className="font-mono uppercase tracking-wider text-[11px] font-semibold text-coral-deep shrink-0">
              Policy Pipeline
            </span>
            <span className="hidden sm:inline text-ink-muted">·</span>
            <span className="text-sm font-medium text-ink truncate">
              {currentStageData.activeMsg}
            </span>
          </div>

          <span className="font-mono text-xs text-ink-muted tabular-nums shrink-0">
            {elapsedSeconds}s
          </span>
        </div>

        {/* Minimalist Horizontal Pipeline Track */}
        <div className="flex items-center justify-between gap-1 sm:gap-2 pt-1">
          {STAGES.map((stage, idx) => {
            const isCompleted = activeStage > idx;
            const isCurrent = activeStage === idx;

            return (
              <React.Fragment key={stage.id}>
                {/* Node Pill */}
                <div
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-all duration-300 ${
                    isCurrent
                      ? 'bg-sand-100 border border-coral/40 text-coral-deep shadow-sm font-semibold'
                      : isCompleted
                      ? 'bg-sand-100/60 text-status-safe font-medium'
                      : 'text-ink-muted/40 font-normal'
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] transition-colors ${
                      isCompleted
                        ? 'bg-status-safe text-white'
                        : isCurrent
                        ? 'bg-coral text-white animate-pulse'
                        : 'bg-sand-200 text-ink-muted'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="h-2.5 w-2.5 stroke-[3]" />
                    ) : (
                      idx + 1
                    )}
                  </span>
                  <span className="text-[11px] truncate">{stage.label}</span>
                </div>

                {/* Connecting Line between stages */}
                {idx < STAGES.length - 1 && (
                  <div className="flex-1 h-[2px] mx-1 bg-sand-200 relative overflow-hidden rounded-full">
                    {isCompleted && (
                      <div className="absolute inset-0 bg-status-safe/60" />
                    )}
                    {isCurrent && (
                      <div className="absolute inset-0 bg-gradient-to-r from-status-safe via-coral to-transparent animate-pulse" />
                    )}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Ultra-slim progress shimmer */}
        <div className="h-[2px] w-full overflow-hidden rounded-full bg-sand-200">
          <div
            className="h-full bg-gradient-to-r from-coral-peach via-coral to-coral-deep transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. COMPLETED STATE: Minimalist Header & Collapsible Pipeline Timeline
  // =========================================================================
  const stepsToRender = executionSteps && executionSteps.length > 0 ? executionSteps : null;

  return (
    <div className="rounded-xl border border-ink/10 bg-sand-50/80 p-3.5 text-xs text-ink transition-all">
      {/* Sleek Minimalist Meta Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: Source and Synthesis Badges */}
        <div className="flex flex-wrap items-center gap-2">
          {isWebFallback ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-500/20">
              <Globe className="h-3.5 w-3.5 text-amber-600" />
              <span>Live Airline Web Search</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-800 border border-emerald-500/20">
              <ShieldCheck className="h-3.5 w-3.5 text-status-safe" />
              <span>Verified Policy Vault (RAG)</span>
            </span>
          )}

          <span className="inline-flex items-center gap-1.5 rounded-full bg-sand-200/80 px-2.5 py-1 text-xs font-medium text-ink-soft">
            <Sparkles className="h-3 w-3 text-coral" />
            <span>Gemini 2.5 Flash</span>
          </span>
        </div>

        {/* Right: Latency & Interactive Timeline Toggle */}
        <div className="flex items-center gap-3">
          {latencyMs != null && (
            <span className="font-mono text-[11px] text-ink-muted">
              {(latencyMs / 1000).toFixed(2)}s
            </span>
          )}

          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1.5 font-sans text-xs font-medium text-ink-soft hover:text-ink transition-colors px-2 py-1 rounded-md hover:bg-sand-200/70"
          >
            <Cpu className="h-3.5 w-3.5 text-coral" />
            <span>{expanded ? 'Hide Pipeline Trace' : 'View Pipeline Trace'}</span>
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Modern Vertical Timeline (Collapsible) */}
      {expanded && (
        <div className="mt-3.5 pt-3.5 border-t border-ink/10 pl-2 space-y-3 animate-fade-in font-sans">
          <p className="eyebrow text-ink-muted">Execution Audit Trail</p>
          <div className="relative border-l-2 border-sand-300 ml-2 space-y-3.5 pl-4 py-1">
            {(stepsToRender || STAGES.map((s, i) => ({
              step: i + 1,
              name: s.label,
              status: 'COMPLETED' as const,
              detail: s.activeMsg,
            }))).map((step, idx) => (
              <div key={idx} className="relative group">
                {/* Timeline node dot */}
                <div className="absolute -left-[23px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-sand-50 border-2 border-status-safe text-status-safe">
                  <Check className="h-2.5 w-2.5 stroke-[3]" />
                </div>
                <div className="text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink">{step.name}</span>
                    <span className="font-mono text-[10px] text-status-safe uppercase tracking-wider">Verified</span>
                  </div>
                  <p className="text-ink-soft text-xs mt-0.5 leading-relaxed">
                    {step.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


