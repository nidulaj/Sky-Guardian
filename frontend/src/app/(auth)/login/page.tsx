'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { ArrowRight, Eye, EyeOff, Info } from 'lucide-react';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Errors {
  email?: string;
  password?: string;
}

function validate(email: string, password: string): Errors {
  const errors: Errors = {};
  if (!email.trim()) errors.email = 'Enter your email address.';
  else if (!EMAIL_RE.test(email.trim())) errors.email = 'Enter an email address like name@example.com.';
  if (!password) errors.password = 'Enter your password.';
  else if (password.length < 8) errors.password = 'Passwords have at least 8 characters. Check what you typed.';
  return errors;
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  helperText,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  helperText?: string;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);
  const describedBy = error ? `${id}-error` : helperText ? `${id}-help` : undefined;
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="eyebrow block">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`h-12 w-full rounded-xl border bg-sand-50 pl-4 pr-14 text-base text-ink transition-colors focus:border-ink focus:outline-none ${
            error ? 'border-status-danger' : 'border-ink/15 hover:border-ink/30'
          }`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-controls={id}
          aria-pressed={visible}
          className="absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-ink-soft hover:text-ink"
        >
          {visible ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} className="text-sm text-status-danger">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p id={`${id}-help`} className="text-sm text-ink-muted">
          {helperText}
        </p>
      )}
    </div>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [attempted, setAttempted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const noticeRef = useRef<HTMLDivElement>(null);

  const revalidate = (nextEmail: string, nextPassword: string) => {
    if (attempted) setErrors(validate(nextEmail, nextPassword));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    const found = validate(email, password);
    setErrors(found);
    if (found.email || found.password) {
      setSubmitted(false);
      document.getElementById(found.email ? 'login-email' : 'login-password')?.focus();
      return;
    }
    // The backend has no real authentication yet: do not pretend the sign-in worked.
    setSubmitted(true);
    requestAnimationFrame(() => noticeRef.current?.focus());
  };

  return (
    <div className="surface-raised p-6 sm:p-10 space-y-8">
      <div className="space-y-4">
        <p className="eyebrow">Sign in</p>
        <h1 className="display text-5xl sm:text-6xl text-ink">
          Welcome <span className="accent text-coral">back.</span>
        </h1>
        <p className="text-base sm:text-lg text-ink-soft leading-relaxed">
          Sign in to see your saved journeys and alerts.
        </p>
      </div>

      {submitted && (
        <div
          ref={noticeRef}
          tabIndex={-1}
          role="status"
          className="space-y-4 rounded-2xl border border-mist-deep/20 bg-mist-soft p-5 focus:outline-none"
        >
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-mist-deep" aria-hidden="true" />
            <div className="space-y-1">
              <p className="text-base font-semibold text-ink">Sign-in isn&apos;t connected in this demo</p>
              <p className="text-sm text-ink-soft leading-relaxed">
                Your details look fine, but accounts aren&apos;t switched on yet, so nothing was sent or saved. You can
                still check a journey without an account.
              </p>
            </div>
          </div>
          <Link
            href="/journeys/new"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-coral-deep px-5 text-sm font-medium text-white transition-colors hover:bg-[#9E2A17]"
          >
            Continue to the demo
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <Input
          id="login-email"
          label="Email address"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            revalidate(e.target.value, password);
          }}
          error={errors.email}
        />
        <PasswordField
          id="login-password"
          label="Password"
          value={password}
          onChange={(v) => {
            setPassword(v);
            revalidate(email, v);
          }}
          error={errors.password}
          autoComplete="current-password"
        />
        <Button type="submit" variant="primary" size="lg" className="w-full">
          Sign in
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </form>

      <div className="space-y-1 border-t border-ink/10 pt-4">
        <p className="text-base text-ink-soft">
          New to SkyGuardian?{' '}
          <Link href="/register" className="inline-flex min-h-[44px] items-center font-medium text-ink underline decoration-coral underline-offset-4 hover:decoration-2">
            Create an account
          </Link>
        </p>
        <p className="text-base text-ink-soft">
          Just looking?{' '}
          <Link href="/journeys/new" className="inline-flex min-h-[44px] items-center font-medium text-ink underline decoration-coral underline-offset-4 hover:decoration-2">
            Check a journey without signing in
          </Link>
        </p>
      </div>
    </div>
  );
}
