import React from 'react';

interface PageHeaderProps {
  /** Small mono label above the title, e.g. "02 / History". */
  eyebrow: string;
  /** Plain part of the headline. */
  title: string;
  /** Optional italic serif accent appended to the title. */
  accent?: string;
  description?: React.ReactNode;
  /** Right-aligned slot, e.g. a button. */
  actions?: React.ReactNode;
}

export default function PageHeader({ eyebrow, title, accent, description, actions }: PageHeaderProps) {
  return (
    <div className="border-b border-ink/10 pb-8 sm:pb-10">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-4 max-w-3xl">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="display text-4xl sm:text-5xl md:text-6xl text-ink">
            {title}
            {accent && (
              <>
                {' '}
                <span className="accent text-coral">{accent}</span>
              </>
            )}
          </h1>
          {description && <p className="text-base sm:text-lg text-ink-soft leading-relaxed max-w-2xl">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>}
      </div>
    </div>
  );
}
