import React from 'react';
import Badge from '@/components/ui/Badge';
import type { PolicyEvidence, RecoveryPlan } from '@/types/journey';
import SafeRichText from './SafeRichText';

interface RecommendationCardProps {
  plan?: RecoveryPlan | null;
  mode?: 'llm' | 'template';
  /** Plain-text recommendation, shown when the response has no structured plan. */
  fallbackText: string;
  policyEvidence?: PolicyEvidence[];
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="eyebrow">{title}</h4>
      <div className="mt-2 text-base text-ink-soft leading-relaxed">{children}</div>
    </div>
  );
}

/** Recovery agent's plan. The badge says whether an AI model wrote it or it is the standard template (blueprint 9.5). */
export default function RecommendationCard({ plan, mode = 'template', fallbackText, policyEvidence = [] }: RecommendationCardProps) {
  const aiAssisted = mode === 'llm';
  const badge = (
    <Badge
      status={aiAssisted ? 'AI_ASSISTED' : 'STANDARD_SUMMARY'}
      label={aiAssisted ? 'AI-assisted explanation' : 'Standard summary'}
    />
  );

  if (!plan) {
    return (
      <div className="space-y-4">
        {badge}
        <SafeRichText text={fallbackText} className="text-base sm:text-lg text-ink-soft leading-relaxed" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {badge}
        <h3 className="display text-2xl sm:text-3xl text-ink leading-tight">{plan.headline}</h3>
        <SafeRichText
          text={`${plan.what_happened} ${plan.impact}`.trim()}
          className="text-base sm:text-lg text-ink-soft leading-relaxed"
        />
      </div>

      <div className="rounded-2xl bg-sand-100 px-4 py-4 sm:px-5">
        <h4 className="eyebrow">Recommended action</h4>
        <SafeRichText text={plan.recommended_action} className="mt-2 text-base sm:text-lg text-ink leading-relaxed" />
        {plan.why_this_option && <p className="mt-2 text-sm text-ink-soft leading-relaxed">{plan.why_this_option}</p>}
      </div>

      {plan.next_steps.length > 0 && (
        <Block title="Next steps">
          <ol className="list-decimal space-y-1.5 pl-5">
            {plan.next_steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </Block>
      )}

      {plan.policy_citations.length > 0 && (
        <Block title="Policy evidence">
          <ul className="space-y-1.5">
            {plan.policy_citations.map((id) => {
              const evidence = policyEvidence[Number(id.slice(1)) - 1];
              return (
                <li key={id}>
                  <a href={`#policy-${id}`} className="font-medium text-ink underline decoration-coral underline-offset-4 hover:decoration-2">
                    [{id}]
                  </a>{' '}
                  {evidence?.title ?? 'Airline policy'}
                  {evidence?.airline && <span className="text-ink-muted"> ({evidence.airline})</span>}
                </li>
              );
            })}
          </ul>
        </Block>
      )}

      {plan.uncertainty.length > 0 && (
        <Block title="Please note">
          <ul className="list-disc space-y-1.5 pl-5">
            {plan.uncertainty.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </Block>
      )}

      {plan.contact && (
        <p className="text-base text-ink">
          <span className="eyebrow mr-2">Contact</span>
          {plan.contact}
        </p>
      )}
    </div>
  );
}
