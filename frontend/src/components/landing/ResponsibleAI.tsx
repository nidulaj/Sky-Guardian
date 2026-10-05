import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { BookOpenCheck, Hand, Lightbulb, LockKeyhole, Scale } from 'lucide-react';

const POINTS: { title: string; body: string; Icon: LucideIcon }[] = [
  {
    title: 'Explainable reasons',
    body: 'Every result names the signals behind it: the delay, the transfer minutes, the weather. No unexplained verdicts.',
    Icon: Lightbulb,
  },
  {
    title: 'Cited sources',
    body: 'Policy answers point back to the airline document or trusted page they came from, so you can read it yourself.',
    Icon: BookOpenCheck,
  },
  {
    title: 'You stay in control',
    body: 'SkyGuardian suggests; you decide. Nothing is booked, cancelled or changed on your behalf.',
    Icon: Hand,
  },
  {
    title: 'Data protection',
    body: 'A check needs only flight numbers, dates and airports. No passport or payment details are asked for.',
    Icon: LockKeyhole,
  },
  {
    title: 'Honest uncertainty',
    body: 'When data is missing or out of date we say so. Scores are estimates, never probabilities. Your airline has the final word.',
    Icon: Scale,
  },
];

export default function ResponsibleAI() {
  return (
    <section id="responsible-ai" aria-labelledby="rai-title" className="scroll-mt-4 px-2 pb-2 sm:px-3 sm:pb-3">
      <div className="rounded-4xl bg-mist-soft">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="border-t border-ink/15 pt-5 lg:sticky lg:top-8">
              <p className="eyebrow text-ink-soft">07 / Responsible AI</p>
              <h2 id="rai-title" className="display mt-10 text-4xl text-ink sm:text-5xl lg:text-6xl">
                Advice you can <span className="accent text-coral-deep">trust and check.</span>
              </h2>
              <p className="mt-6 max-w-md text-base leading-relaxed text-ink-soft sm:text-lg">
                SkyGuardian is decision support, not an airline. It shows its working so you can judge it, and it is
                clear about what it does not know.
              </p>
            </div>
          </div>

          <ol className="lg:col-span-7">
            {POINTS.map(({ title, body, Icon }, i) => (
              <li key={title} className="grid grid-cols-[auto_1fr] gap-x-5 border-t border-ink/15 py-7 first:border-t-0 lg:first:border-t">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-sand-50 text-coral-deep">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-mono text-xs text-ink-soft">{String(i + 1).padStart(2, '0')}</p>
                  <h3 className="mt-1 text-xl font-semibold text-ink sm:text-2xl">{title}</h3>
                  <p className="mt-2 text-base leading-relaxed text-ink-soft">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
