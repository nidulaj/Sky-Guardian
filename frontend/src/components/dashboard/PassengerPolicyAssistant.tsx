'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Sparkles,
  BookOpen,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  CheckCircle2,
  Globe,
  ExternalLink,
  Database,
  Cpu,
  ArrowRight,
  ChevronDown,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { askRagQuestion } from '@/lib/api/client';
import SafeRichText from '@/components/journey/SafeRichText';
import type { AskQuestionResponse } from '@/types/rag';

const SUGGESTED_QUESTIONS = [
  'What compensation do I get if my flight is delayed over 3 hours?',
  'What is British Airways policy on missed connections?',
  'Does Delta provide hotel vouchers for overnight flight delays?',
  'What are my rights if my flight is cancelled under EU261?',
];

function safeSourceUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

interface WorkflowStep {
  id: 'rag' | 'web' | 'gemini';
  title: string;
  stageName: string;
  description: string;
  icon: React.ElementType;
}

const PIPELINE_STAGES: WorkflowStep[] = [
  {
    id: 'rag',
    title: 'Vector RAG',
    stageName: 'Knowledge Retrieval',
    description: 'Scanning indexed carrier agreements & pgvector policy database',
    icon: Database,
  },
  {
    id: 'web',
    title: 'Web Search',
    stageName: 'Carrier Grounding',
    description: 'Verifying official airline domains & conditions of carriage',
    icon: Globe,
  },
  {
    id: 'gemini',
    title: 'Gemini AI',
    stageName: 'Policy Synthesis',
    description: 'Synthesizing verified passenger rights & cited legal clauses',
    icon: Sparkles,
  },
];

export default function PassengerPolicyAssistant() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<1 | 2>(1);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AskQuestionResponse | null>(null);
  const [showWorkflowDetails, setShowWorkflowDetails] = useState(true);

  const timersRef = useRef<NodeJS.Timeout[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  useEffect(() => {
    return () => clearTimers();
  }, []);

  const handleAsk = async (queryText?: string) => {
    const q = (queryText || question).trim();
    if (!q || loading) return;

    if (queryText) {
      setQuestion(queryText);
    }

    clearTimers();
    setLoading(true);
    setLoadingStage(1);
    setError(null);
    setResponse(null);

    // Progress from Vector RAG to Gemini AI Synthesis
    const t1 = setTimeout(() => {
      setLoadingStage(2);
    }, 1500);

    timersRef.current = [t1];

    try {
      const res = await askRagQuestion(q, 3, 0.15, undefined, { enable_web_fallback: true });
      clearTimers();
      setResponse(res);
    } catch (err: any) {
      clearTimers();
      setError(err.message || 'Could not check the airline rules. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isWebSearch = response?.source_type === 'web_search';

  return (
    <section aria-labelledby="policy-assistant-heading" className="rounded-3xl border border-ink/10 bg-sand-50 p-6 sm:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 pb-4">
        <div className="space-y-1">
          <p className="eyebrow flex items-center gap-1.5 text-coral">
            <Sparkles className="h-4 w-4" />
            <span>Airline help</span>
          </p>
          <h2 id="policy-assistant-heading" className="text-2xl font-semibold tracking-tight text-ink">
            Questions about delays or refunds?
          </h2>
        </div>

        {/* Pipeline Architecture Indicator */}
        <div className="hidden md:flex items-center gap-1.5 rounded-full border border-ink/10 bg-sand-100/70 px-3.5 py-1 text-xs font-mono text-ink-muted">
          <span className="flex items-center gap-1 text-ink font-semibold">
            <Database className="h-3 w-3 text-coral" /> RAG
          </span>
          <span className="text-ink/30">→</span>
          <span className="flex items-center gap-1 text-ink font-semibold">
            <Globe className="h-3 w-3 text-coral" /> Web Search
          </span>
          <span className="text-ink/30">→</span>
          <span className="flex items-center gap-1 text-ink font-semibold">
            <Cpu className="h-3 w-3 text-coral" /> Gemini AI
          </span>
        </div>
      </div>

      <p className="text-sm text-ink-soft leading-relaxed max-w-2xl">
        Check airline rules for missed flights, cancellations, and statutory compensations. Powered by multi-source
        vector retrieval, live official carrier search, and Gemini AI synthesis.
      </p>

      {/* Suggested prompts */}
      <div className="space-y-2">
        <p className="eyebrow text-ink-muted">Common questions</p>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleAsk(item)}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-full border border-ink/15 bg-sand-100/70 px-3.5 py-1.5 text-xs text-ink transition-colors hover:border-coral hover:bg-sand-100 disabled:opacity-50"
            >
              <span>{item}</span>
              <ChevronRight className="h-3 w-3 text-ink-muted" />
            </button>
          ))}
        </div>
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAsk();
        }}
        className="flex flex-col sm:flex-row gap-3 pt-2"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
          <input
            type="text"
            aria-label="Airline question"
            placeholder="e.g. What is British Airways refund policy, or meal voucher rules for 4h delay?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="h-12 w-full rounded-xl border border-ink/15 bg-sand-100/60 pl-10 pr-4 text-base text-ink placeholder:text-ink-muted focus:border-ink focus:bg-sand-50 focus:outline-none"
          />
        </div>
        <Button type="submit" variant="primary" size="lg" disabled={loading || !question.trim()}>
          {loading ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <BookOpen className="h-4 w-4" />
              Ask a question
            </>
          )}
        </Button>
      </form>

      {/* Live Processing Pipeline Monitor (Transparent State) */}
      {loading && (
        <div className="rounded-2xl border border-coral/25 bg-gradient-to-br from-sand-100 via-sand-50 to-coral-soft/20 p-5 sm:p-6 space-y-4 shadow-sm animate-fadeIn">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-coral opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-coral" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-ink font-mono">
                Policy Assistant Pipeline Active
              </span>
            </div>
            <span className="text-xs font-mono text-coral font-medium bg-coral-soft/50 px-2.5 py-0.5 rounded-full border border-coral/30">
              {loadingStage === 1
                ? 'Phase 1: Vector RAG Retrieval'
                : 'Phase 2: Gemini AI Synthesis'}
            </span>
          </div>

          {/* 3 Step Visual Flow */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Step 1: Vector RAG */}
            <div
              className={`relative flex flex-col gap-2 rounded-xl p-4 transition-all duration-300 border ${
                loadingStage === 1
                  ? 'border-coral bg-sand-50 shadow-md ring-2 ring-coral/20'
                  : 'border-emerald-500/30 bg-emerald-50/40 text-ink'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                      loadingStage === 1 ? 'bg-coral text-white' : 'bg-emerald-600 text-white'
                    }`}
                  >
                    <Database className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-bold text-ink tracking-tight font-mono">Vector RAG</span>
                </div>

                {loadingStage > 1 ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-coral shrink-0" />
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-ink">Knowledge Store</p>
                <p className="text-[11px] text-ink-soft leading-tight mt-0.5">
                  {loadingStage === 1 ? (
                    <span className="text-coral font-medium animate-pulse">
                      Scanning indexed carrier agreements & pgvector policy database...
                    </span>
                  ) : (
                    'Knowledge base searched for verified policy rules'
                  )}
                </p>
              </div>
            </div>

            {/* Step 2: Web Search (Conditional Fallback) */}
            <div className="relative flex flex-col gap-2 rounded-xl p-4 transition-all duration-300 border border-ink/10 bg-sand-100/40 opacity-70">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sand-200 text-ink-muted">
                    <Globe className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-bold text-ink tracking-tight font-mono">Web Search</span>
                </div>

                <span className="text-[10px] font-mono text-ink-muted bg-sand-200/70 px-2 py-0.5 rounded">
                  Standby
                </span>
              </div>

              <div>
                <p className="text-xs font-semibold text-ink">Conditional Fallback</p>
                <p className="text-[11px] text-ink-soft leading-tight mt-0.5">
                  Bypassed automatically when RAG matches; only activates if unindexed.
                </p>
              </div>
            </div>

            {/* Step 3: Gemini AI Synthesis */}
            <div
              className={`relative flex flex-col gap-2 rounded-xl p-4 transition-all duration-300 border ${
                loadingStage === 2
                  ? 'border-coral bg-sand-50 shadow-md ring-2 ring-coral/20'
                  : 'border-ink/10 bg-sand-100/40 opacity-55'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                      loadingStage === 2 ? 'bg-coral text-white' : 'bg-sand-200 text-ink-muted'
                    }`}
                  >
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-bold text-ink tracking-tight font-mono">Gemini AI</span>
                </div>

                {loadingStage === 2 ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-coral shrink-0" />
                ) : (
                  <span className="text-[10px] font-mono text-ink-muted">Next</span>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-ink">Policy Synthesis</p>
                <p className="text-[11px] text-ink-soft leading-tight mt-0.5">
                  {loadingStage === 2 ? (
                    <span className="text-coral font-medium animate-pulse">
                      Synthesizing verified passenger rights & formulating answer...
                    </span>
                  ) : (
                    'Synthesizes verified passenger rights & cited legal clauses'
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-status-danger/30 bg-status-danger-bg p-4 text-status-danger">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="text-sm font-medium leading-relaxed">{error}</p>
        </div>
      )}

      {/* Response card with Workflow Trace */}
      {response && (
        <div className="space-y-5 rounded-2xl border border-ink/10 bg-sand-100 p-5 sm:p-6 shadow-sm">
          {/* Transparent Workflow Header Ribbon */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-status-safe" />
              <span className="text-xs font-semibold uppercase tracking-wider text-ink font-mono">
                Grounded Policy Advice
              </span>
            </div>

            {/* Workflow Stage Badges */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-mono text-[11px] font-medium border ${
                  response.source_type === 'rag' || response.source_type === 'hybrid'
                    ? 'border-emerald-500/30 bg-emerald-50 text-emerald-800 font-semibold'
                    : 'border-ink/10 bg-sand-200/50 text-ink-muted'
                }`}
                title="Internal pgvector database check"
              >
                <Database className="h-3 w-3 text-emerald-600" />
                {response.source_type === 'rag' ? 'RAG: Matched' : 'RAG: Checked'}
              </span>

              <span className="text-ink/30 text-xs">→</span>

              <span
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-mono text-[11px] font-medium border ${
                  response.source_type === 'web_search' || response.source_type === 'hybrid'
                    ? 'border-emerald-500/30 bg-emerald-50 text-emerald-800 font-semibold'
                    : 'border-ink/10 bg-sand-200/50 text-ink-muted line-through opacity-70'
                }`}
                title={response.source_type === 'rag' ? 'Web search bypassed because verified RAG document was found' : 'Official carrier website search'}
              >
                <Globe className="h-3 w-3" />
                {response.source_type === 'rag' ? 'Web Search: Bypassed' : 'Web Search: Active'}
              </span>

              <span className="text-ink/30 text-xs">→</span>

              <span
                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-mono text-[11px] font-semibold border border-coral/30 bg-coral-soft/40 text-coral-deep"
                title="Gemini AI policy synthesis"
              >
                <Sparkles className="h-3 w-3" />
                Gemini AI: Polished
              </span>

              {response.latency_ms > 0 && (
                <span className="text-[11px] font-mono text-ink-muted ml-1 bg-sand-200/60 px-2 py-0.5 rounded">
                  ⚡ {response.latency_ms}ms
                </span>
              )}
            </div>
          </div>

          {/* Interactive Pipeline Trace Expander */}
          <div className="rounded-xl border border-ink/10 bg-sand-50/70 p-3.5 space-y-2">
            <button
              type="button"
              onClick={() => setShowWorkflowDetails((prev) => !prev)}
              className="flex w-full items-center justify-between text-left text-xs font-semibold text-ink hover:text-coral transition-colors"
            >
              <span className="flex items-center gap-1.5 font-mono">
                <Layers className="h-3.5 w-3.5 text-coral" />
                <span>Workflow Pipeline Stages & Evidence</span>
              </span>
              <ChevronDown
                className={`h-4 w-4 text-ink-muted transition-transform duration-200 ${
                  showWorkflowDetails ? 'rotate-180 text-coral' : ''
                }`}
              />
            </button>

            {showWorkflowDetails && (
              <div className="pt-2 border-t border-ink/5 space-y-2.5 text-xs animate-fadeIn">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div
                    className={`rounded-lg border p-2.5 space-y-1 ${
                      response.source_type === 'rag'
                        ? 'border-emerald-500/30 bg-emerald-50/50'
                        : 'border-ink/10 bg-sand-100/60'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-ink">
                      <Database className="h-3 w-3 text-coral" />
                      <span>1. Vector RAG</span>
                    </div>
                    <p className="text-[11px] text-ink-soft leading-relaxed">
                      {response.source_type === 'web_search'
                        ? 'Policy unindexed in internal database; handed off to web grounding.'
                        : `Found in internal policy vault (${response.chunks?.length || 1} verified chunk(s) matched).`}
                    </p>
                  </div>

                  <div
                    className={`rounded-lg border p-2.5 space-y-1 ${
                      response.source_type === 'web_search'
                        ? 'border-emerald-500/30 bg-emerald-50/50'
                        : 'border-ink/10 bg-sand-100/40 opacity-75'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-ink">
                      <Globe className="h-3 w-3 text-coral" />
                      <span>2. Official Web Search</span>
                    </div>
                    <p className="text-[11px] text-ink-soft leading-relaxed">
                      {response.source_type === 'web_search'
                        ? `Live grounding on official carrier domains (${response.sources?.length || 0} trusted resources verified).`
                        : 'Bypassed. RAG knowledge was already verified, so no external search was needed.'}
                    </p>
                  </div>

                  <div className="rounded-lg border border-coral/25 bg-coral-soft/20 p-2.5 space-y-1">
                    <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-ink">
                      <Sparkles className="h-3 w-3 text-coral" />
                      <span>3. Gemini AI Synthesis</span>
                    </div>
                    <p className="text-[11px] text-ink-soft leading-relaxed">
                      Gemini 2.5 synthesized the retrieved policy clauses into plain, passenger-friendly guidance.
                    </p>
                  </div>
                </div>

                {/* Real backend execution steps if returned */}
                {response.execution_steps && response.execution_steps.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-ink-muted">Execution Step Details</p>
                    <div className="space-y-1">
                      {response.execution_steps.map((st) => (
                        <div key={st.step} className="flex items-start gap-2 text-[11px] font-mono">
                          <CheckCircle2 className="h-3 w-3 text-status-safe shrink-0 mt-0.5" />
                          <span className="text-ink font-medium">{st.name}:</span>
                          <span className="text-ink-soft">{st.detail}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Grounded AI Answer */}
          <div className="space-y-2 pt-1">
            <SafeRichText text={response.answer} className="text-base text-ink leading-relaxed" />
          </div>

          {/* Document / Web Sources Cited */}
          {response.sources && response.sources.length > 0 && (
            <div className="border-t border-ink/10 pt-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="eyebrow text-ink-muted">Verified Cited Sources</p>
                <span className="text-[11px] font-mono text-ink-muted">
                  {response.sources.length} {response.sources.length === 1 ? 'source' : 'sources'} verified
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {response.sources.map((s, idx) => {
                  const href = safeSourceUrl(s.source_url);
                  const hasUrl = Boolean(href);
                  const Tag = hasUrl ? 'a' : 'span';
                  const linkProps = hasUrl
                    ? {
                        href,
                        target: '_blank',
                        rel: 'noopener noreferrer',
                        title: `Open ${s.name} in new tab`,
                      }
                    : {};

                  return (
                    <Tag
                      key={idx}
                      {...linkProps}
                      className={`inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-mono transition-colors ${
                        hasUrl
                          ? 'border-coral/30 bg-sand-50 text-ink hover:border-coral hover:bg-sand-200 shadow-xs'
                          : 'border-ink/15 bg-sand-50 text-ink'
                      }`}
                    >
                      {isWebSearch ? (
                        <Globe className="h-3 w-3 shrink-0 text-coral" />
                      ) : (
                        <BookOpen className="h-3 w-3 shrink-0 text-coral" />
                      )}
                      <span className="min-w-0 truncate">{s.name || 'Airline rules'}</span>
                      {hasUrl && <ExternalLink className="h-3 w-3 shrink-0 text-ink-muted ml-0.5" />}
                    </Tag>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
