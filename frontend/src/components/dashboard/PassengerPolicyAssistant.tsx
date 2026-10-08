'use client';

import React, { useState } from 'react';
import { Search, Sparkles, BookOpen, AlertCircle, RefreshCw, ChevronRight, CheckCircle2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { askRagQuestion } from '@/lib/api/client';
import type { AskQuestionResponse } from '@/types/rag';

const SUGGESTED_QUESTIONS = [
  'What compensation do I get if my flight is delayed over 3 hours?',
  'What are my rights if I miss a connecting flight?',
  'Will the airline provide hotel accommodation for overnight delays?',
  'What is the policy for cancellation refunds?',
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
      const res = await askRagQuestion(q, 3, 0.15);
      setResponse(res);
    } catch (err: any) {
      setError(err.message || 'Unable to retrieve answer from policy store.');
    } finally {
      setLoading(false);
    }
  };

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
        <span className="rounded-full bg-sand-200 px-3 py-1 text-xs font-mono text-ink-soft">
          Powered by Supabase RAG
        </span>
      </div>

      <p className="text-sm text-ink-soft leading-relaxed max-w-2xl">
        Get direct answers grounded in airline conditions of carriage, regulatory compensation frameworks (such as EU261 & Montreal Convention), and airport minimum connection policies.
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
            placeholder="e.g. Can I get a meal voucher if delayed at Kuala Lumpur for 4 hours?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="h-12 w-full rounded-xl border border-ink/15 bg-sand-100/60 pl-10 pr-4 text-base text-ink placeholder:text-ink-muted focus:border-ink focus:bg-sand-50 focus:outline-none"
          />
        </div>
        <Button type="submit" variant="primary" size="lg" disabled={loading || !question.trim()}>
          {loading ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Searching policies...
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
        <div className="space-y-4 rounded-2xl border border-ink/10 bg-sand-100 p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <span className="eyebrow flex items-center gap-1.5 text-ink-soft">
              <CheckCircle2 className="h-4 w-4 text-status-safe" />
              Policy Finding
            </span>
            <span className="font-mono text-xs text-ink-muted">Retrieved in {response.latency_ms}ms</span>
          </div>

          <p className="text-base text-ink leading-relaxed whitespace-pre-wrap">{response.answer}</p>

          {/* Document Sources Cited */}
          {response.sources && response.sources.length > 0 && (
            <div className="border-t border-ink/10 pt-4 space-y-2">
              <p className="eyebrow text-ink-muted">Verified Policy Sources Cited</p>
              <div className="flex flex-wrap gap-2">
                {response.sources.map((s, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-sand-50 px-3 py-1 text-xs text-ink font-mono"
                  >
                    <BookOpen className="h-3 w-3 text-coral" />
                    <span>{s.name || 'Carrier Policy'}</span>
                    {s.relevance_score != null && (
                      <span className="text-coral-deep font-semibold">({(s.relevance_score * 100).toFixed(0)}% match)</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
