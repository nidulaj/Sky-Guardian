'use client';

import React, { useEffect, useId, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { Check, Info, ShieldCheck } from 'lucide-react';

const STORAGE_KEY = 'skyguardian.settings.v1';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Prefs {
  name: string;
  email: string;
  language: 'en' | 'si' | 'ta';
  alertAtRisk: boolean;
  alertDayBefore: boolean;
  alertLevel: 'high' | 'moderate';
  minimiseData: boolean;
  rememberChecks: boolean;
}

const DEFAULTS: Prefs = {
  name: '',
  email: '',
  language: 'en',
  alertAtRisk: true,
  alertDayBefore: false,
  alertLevel: 'high',
  minimiseData: true,
  rememberChecks: false,
};

const LANGUAGES: { code: Prefs['language']; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'si', label: 'Sinhala', native: 'සිංහල' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
];

function readStored(): Prefs | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) } : null;
  } catch {
    return null;
  }
}

/** Accessible switch built on a real checkbox, so keyboard and screen readers work natively. */
function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-6 py-5">
      <div className="space-y-1">
        <label htmlFor={id} className="block text-base font-medium text-ink cursor-pointer">
          {label}
        </label>
        <p id={`${id}-desc`} className="text-sm text-ink-soft leading-relaxed">
          {description}
        </p>
      </div>
      <span className="relative inline-flex h-11 w-16 shrink-0 items-center justify-center">
        <input
          id={id}
          type="checkbox"
          role="switch"
          aria-describedby={`${id}-desc`}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        <span
          aria-hidden="true"
          className={`pointer-events-none relative h-7 w-12 rounded-full transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-coral-deep ${
            checked ? 'bg-ink' : 'bg-sand-400'
          }`}
        >
          <span
            className={`absolute top-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-sand-50 transition-transform ${
              checked ? 'translate-x-5' : ''
            }`}
          >
            {checked && <Check className="h-3 w-3 text-ink" />}
          </span>
        </span>
      </span>
    </div>
  );
}

function Section({
  index,
  title,
  description,
  children,
}: {
  index: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="grid gap-6 border-b border-ink/10 py-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] md:gap-12">
      <div className="space-y-3">
        <p className="eyebrow">{index}</p>
        <h2 id={headingId} className="text-2xl font-semibold tracking-tight text-ink">
          {title}
        </h2>
        <p className="text-base text-ink-soft leading-relaxed max-w-sm">{description}</p>
      </div>
      <div className="surface p-5 sm:p-7">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [emailError, setEmailError] = useState<string>();
  const [message, setMessage] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const stored = readStored();
    if (stored) setPrefs(stored);
  }, []);

  const update = <K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    setPrefs((p) => ({ ...p, [key]: value }));
    setDirty(true);
    setMessage('');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const email = prefs.email.trim();
    if (email && !EMAIL_RE.test(email)) {
      setEmailError('Enter an email address like name@example.com, or leave it empty.');
      document.getElementById('settings-email')?.focus();
      return;
    }
    setEmailError(undefined);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prefs, email }));
      setMessage('Saved in this browser only. Nothing was sent to a server.');
    } catch {
      setMessage('Your browser blocked local storage, so these choices will reset when you leave this page.');
    }
    setDirty(false);
  };

  const handleReset = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage unavailable: nothing to clear */
    }
    setPrefs(DEFAULTS);
    setEmailError(undefined);
    setDirty(false);
    setMessage('Settings reset to defaults and cleared from this browser.');
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="03 / Settings"
        title="Your"
        accent="preferences."
        description="Choose how SkyGuardian talks to you and what it keeps. Every option is explained in plain words."
      />

      <div role="note" className="flex items-start gap-3 rounded-2xl border border-ink/10 bg-mist-soft px-5 py-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-mist-deep" aria-hidden="true" />
        <p className="text-base text-ink">
          <strong className="font-semibold">Demo mode.</strong>{' '}
          <span className="text-ink-soft">
            Accounts aren&apos;t connected yet, so settings are saved only in this browser and no alerts are sent.
          </span>
        </p>
      </div>

      <form onSubmit={handleSave} noValidate>
        <Section
          index="01 / Profile"
          title="About you"
          description="Optional. Used to address you and, once accounts are connected, to send alerts."
        >
          <div className="grid gap-5">
            <Input
              id="settings-name"
              label="Your name"
              autoComplete="name"
              value={prefs.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="e.g. Amara Perera"
            />
            <Input
              id="settings-email"
              label="Email for alerts"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={prefs.email}
              onChange={(e) => {
                update('email', e.target.value);
                if (emailError) setEmailError(undefined);
              }}
              error={emailError}
              helperText="We will never share your email."
              placeholder="name@example.com"
            />
          </div>
        </Section>

        <Section
          index="02 / Language"
          title="Preferred language"
          description="Explanations and recommendations are written in this language where supported. Flight numbers and airport codes stay the same."
        >
          <fieldset>
            <legend className="eyebrow mb-4">Choose a language</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {LANGUAGES.map((lang) => {
                const selected = prefs.language === lang.code;
                return (
                  <label
                    key={lang.code}
                    className={`relative flex min-h-[64px] cursor-pointer items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-coral-deep ${
                      selected ? 'border-ink bg-sand-50' : 'border-ink/15 bg-sand-50/60 hover:border-ink/40'
                    }`}
                  >
                    <input
                      type="radio"
                      name="language"
                      value={lang.code}
                      checked={selected}
                      onChange={() => update('language', lang.code)}
                      className="sr-only"
                    />
                    <span>
                      <span className="block text-base font-medium text-ink" lang={lang.code}>
                        {lang.native}
                      </span>
                      {lang.native !== lang.label && <span className="block text-sm text-ink-muted">{lang.label}</span>}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                        selected ? 'border-ink bg-ink' : 'border-ink/30'
                      }`}
                    >
                      {selected && <span className="h-2 w-2 rounded-full bg-sand-50" />}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </Section>

        <Section
          index="03 / Notifications"
          title="Alerts"
          description="Decide when SkyGuardian should get in touch. Alerts start working once accounts are connected."
        >
          <div className="divide-y divide-ink/10 -my-5">
            <Toggle
              label="Tell me when a connection is at risk"
              description="For example, when a delay leaves less time to change planes than the airport needs."
              checked={prefs.alertAtRisk}
              onChange={(v) => update('alertAtRisk', v)}
            />
            <Toggle
              label="Send a check the day before I fly"
              description="A short summary of every flight and connection in your trip, about 24 hours before departure."
              checked={prefs.alertDayBefore}
              onChange={(v) => update('alertDayBefore', v)}
            />
            <div className="py-5 space-y-2">
              <label htmlFor="settings-level" className="block text-base font-medium text-ink">
                Alert me from this risk level
              </label>
              <p id="settings-level-desc" className="text-sm text-ink-soft">
                Risk levels are rule-based estimates, not probabilities.
              </p>
              <select
                id="settings-level"
                aria-describedby="settings-level-desc"
                value={prefs.alertLevel}
                onChange={(e) => update('alertLevel', e.target.value as Prefs['alertLevel'])}
                className="mt-1 h-12 w-full rounded-xl border border-ink/15 bg-sand-50 px-4 text-base text-ink hover:border-ink/30 focus:border-ink focus:outline-none"
              >
                <option value="high">High risk and above (fewer alerts)</option>
                <option value="moderate">Moderate risk and above (more alerts)</option>
              </select>
            </div>
          </div>
        </Section>

        <Section
          index="04 / Data & privacy"
          title="What we keep"
          description="SkyGuardian only needs flight numbers, dates and airports to check a journey."
        >
          <div className="divide-y divide-ink/10 -my-5">
            <Toggle
              label="Keep only flight details"
              description="Store flight numbers, dates and airports, and nothing else about your trip."
              checked={prefs.minimiseData}
              onChange={(v) => update('minimiseData', v)}
            />
            <Toggle
              label="Remember my recent checks"
              description="Show past checks in History. Off by default. In this demo, History shows sample data only."
              checked={prefs.rememberChecks}
              onChange={(v) => update('rememberChecks', v)}
            />
            <div className="flex items-start gap-3 py-5">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-status-safe" aria-hidden="true" />
              <p className="text-sm text-ink-soft leading-relaxed">
                <span className="font-medium text-ink">We never ask for</span> passport or national ID numbers, booking
                passwords or payment details.
              </p>
            </div>
          </div>
        </Section>

        <div className="mt-10 rounded-2xl border border-ink/10 bg-sand-100 px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-ink-soft min-h-[1.25rem]">
              {message ? (
                <>
                  <Check className="h-4 w-4 shrink-0 text-status-safe" aria-hidden="true" />
                  {message}
                </>
              ) : dirty ? (
                'You have unsaved changes.'
              ) : (
                'Saved only in this browser.'
              )}
            </p>
            <div className="flex gap-3">
              <Button type="button" variant="ghost" onClick={handleReset} className="flex-1 sm:flex-none">
                Reset
              </Button>
              <Button type="submit" variant="primary" className="flex-1 sm:flex-none">
                Save preferences
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
