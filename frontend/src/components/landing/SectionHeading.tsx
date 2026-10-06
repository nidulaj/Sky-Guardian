import React from 'react';

interface SectionHeadingProps {
  /** Mono label, e.g. "03 / How it works". */
  eyebrow: string;
  title: string;
  /** Italic serif accent appended to the title. */
  accent?: string;
  /** Tailwind colour class for the accent. Use coral on sand-50..200, coral-deep on sand-400 / mist. */
  accentClass?: string;
  /** Tailwind colour class for the eyebrow (ink-soft on sand-400 / mist). */
  eyebrowClass?: string;
  description?: React.ReactNode;
  /** Small mono caption shown on the right on wide screens. */
  aside?: React.ReactNode;
  id?: string;
}

export default function SectionHeading({
  eyebrow,
  title,
  accent,
  accentClass = 'text-coral',
  eyebrowClass = '',
  description,
  aside,
  id,
}: SectionHeadingProps) {
  return (
    <div className="border-t border-ink/15 pt-5">
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-2">
        <p className={`eyebrow ${eyebrowClass}`}>{eyebrow}</p>
        {aside && <p className={`eyebrow hidden max-w-xs text-right sm:block ${eyebrowClass}`}>{aside}</p>}
      </div>
      <div className="mt-10 grid gap-6 lg:grid-cols-12 lg:items-end">
        <h2 id={id} className="display text-4xl sm:text-5xl lg:text-6xl text-ink lg:col-span-7">
          {title}
          {accent && (
            <>
              {' '}
              <span className={`accent ${accentClass}`}>{accent}</span>
            </>
          )}
        </h2>
        {description && (
          <p className="text-base sm:text-lg leading-relaxed text-ink-soft lg:col-span-5 lg:pb-1">{description}</p>
        )}
      </div>
    </div>
  );
}
