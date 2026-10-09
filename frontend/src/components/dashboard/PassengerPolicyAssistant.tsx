'use client';

import React, { useState } from 'react';
import { Search, Sparkles, BookOpen, AlertCircle, RefreshCw, ChevronRight, CheckCircle2, Globe, ExternalLink } from 'lucide-react';
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

export default function PassengerPolicyAssistant() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AskQuestionResponse | null>(null);

  const handleAsk = async (queryText?: string) => {
    const q = (queryText || question).trim();
    if (!q || loading) return;

    if (queryText) {
      setQuestion(queryText);
    }

    setLoading(true);
    setError(null);

    try {
      const res = await askRagQuestion(q, 3, 0.15, undefined, { enable_web_fallback: true });
      setResponse(res);
    } catch (err: any) {
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
      </div>

      <p className="text-sm text-ink-soft leading-relaxed max-w-2xl">
        Check airline rules for missed flights, cancellations and refunds. Confirm what applies to your booking with your airline.
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
              Checking...
            </>
          ) : (
            <>
              <BookOpen className="h-4 w-4" />
              Ask a question
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
              Your answer
            </span>
          </div>

          {/* Grounded AI Answer */}
          <SafeRichText text={response.answer} className="text-base text-ink leading-relaxed" />

          {/* Document / Web Sources Cited */}
          {response.sources && response.sources.length > 0 && (
            <div className="border-t border-ink/10 pt-4 space-y-2">
              <p className="eyebrow text-ink-muted">Sources</p>
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
                          ? 'border-coral/30 bg-sand-50 text-ink hover:border-coral hover:bg-sand-200'
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
