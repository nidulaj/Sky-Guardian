'use client';

import React, { useState } from 'react';
import { Search, Sparkles, BookOpen, AlertCircle, RefreshCw, ChevronRight, CheckCircle2, Globe, ExternalLink, ShieldCheck } from 'lucide-react';
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

export default function PassengerPolicyAssistant() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AskQuestionResponse | null>(null);

  const handleAsk = async (queryText?: string) => {
    const q = (queryText || question).trim();
    if (!q) return;

    if (queryText) {
      setQuestion(queryText);
    }

    setLoading(true);
    setError(null);

    try {
      const res = await askRagQuestion(q, 3, 0.15, undefined, { enable_web_fallback: true });
      setResponse(res);
    } catch (err: any) {
      setError(err.message || 'Unable to retrieve answer from policy store or live airline resources.');
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
            <span>Passenger Rights & Policy Assistant</span>
          </p>
          <h2 id="policy-assistant-heading" className="text-2xl font-semibold tracking-tight text-ink">
            Ask any question about your travel rights.
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-sand-200 px-3 py-1 text-xs font-mono text-ink-soft">
            <ShieldCheck className="h-3 w-3 text-status-safe" />
            <span>Supabase RAG</span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-sand-200 px-3 py-1 text-xs font-mono text-ink-soft">
            <Globe className="h-3 w-3 text-coral" />
            <span>Live Airline Web Search</span>
          </span>
        </div>
      </div>

      <p className="text-sm text-ink-soft leading-relaxed max-w-2xl">
        Get direct answers grounded in airline conditions of carriage and regulatory compensation frameworks (such as EU261 & Montreal Convention). If the policy isn&apos;t in our internal database, SkyGuardian searches official airline websites and conditions of carriage in real time.
      </p>

      {/* Suggested prompts */}
      <div className="space-y-2">
        <p className="eyebrow text-ink-muted">Suggested inquiries</p>
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
              Searching official policies...
            </>
          ) : (
            <>
              <BookOpen className="h-4 w-4" />
              Ask Policy Assistant
            </>
          )}
        </Button>
      </form>

      {/* Error state */}
      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-status-danger/30 bg-status-danger-bg p-4 text-status-danger">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="text-sm font-medium leading-relaxed">{error}</p>
        </div>
      )}

      {/* Response card */}
      {response && (
        <div className="space-y-4 rounded-2xl border border-ink/10 bg-sand-100 p-5 sm:p-6 transition-all animate-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="eyebrow flex items-center gap-1.5 text-ink-soft">
              {isWebSearch ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 font-sans text-xs font-semibold text-amber-800 border border-amber-500/20">
                  <Globe className="h-3.5 w-3.5 text-amber-600" />
                  Live Airline Web Search (Official Resources)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 font-sans text-xs font-semibold text-emerald-800 border border-emerald-500/20">
                  <CheckCircle2 className="h-3.5 w-3.5 text-status-safe" />
                  Verified Internal Policy Vault (RAG)
                </span>
              )}
            </span>
            <span className="font-mono text-xs text-ink-muted">Retrieved in {response.latency_ms}ms</span>
          </div>

          <SafeRichText text={response.answer} className="text-base text-ink leading-relaxed" />

          {/* Document / Web Sources Cited */}
          {response.sources && response.sources.length > 0 && (
            <div className="border-t border-ink/10 pt-4 space-y-2">
              <p className="eyebrow text-ink-muted flex items-center gap-1.5">
                <span>{isWebSearch ? 'Official Airline & Regulatory Links Cited' : 'Verified Policy Documents Cited'}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {response.sources.map((s, idx) => {
                  const hasUrl = Boolean(s.source_url && s.source_url.startsWith('http'));
                  const Tag = hasUrl ? 'a' : 'span';
                  const linkProps = hasUrl
                    ? {
                        href: s.source_url,
                        target: '_blank',
                        rel: 'noopener noreferrer',
                        title: `Open ${s.name} in new tab`,
                      }
                    : {};

                  return (
                    <Tag
                      key={idx}
                      {...linkProps}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-mono transition-colors ${
                        hasUrl
                          ? 'border-coral/30 bg-sand-50 text-ink hover:border-coral hover:bg-sand-200'
                          : 'border-ink/15 bg-sand-50 text-ink'
                      }`}
                    >
                      {isWebSearch ? (
                        <Globe className="h-3 w-3 text-coral" />
                      ) : (
                        <BookOpen className="h-3 w-3 text-coral" />
                      )}
                      <span className="max-w-[260px] truncate">{s.name || 'Official Policy'}</span>
                      {hasUrl && <ExternalLink className="h-3 w-3 text-ink-muted ml-0.5" />}
                      {s.relevance_score != null && (
                        <span className="text-coral-deep font-semibold">({(s.relevance_score * 100).toFixed(0)}%)</span>
                      )}
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
