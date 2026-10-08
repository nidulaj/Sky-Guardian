'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { ArrowRight, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';

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
  else if (password.length < 6) errors.password = 'Password must be at least 6 characters.';
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
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [attempted, setAttempted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const revalidate = (nextEmail: string, nextPassword: string) => {
    if (attempted) setErrors(validate(nextEmail, nextPassword));
    if (serverError) setServerError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    setServerError(null);

    const found = validate(email, password);
    setErrors(found);
    if (found.email || found.password) {
      document.getElementById(found.email ? 'login-email' : 'login-password')?.focus();
      return;
    }

    setLoading(true);
    try {
      const user = await login({
        email: email.trim(),
        password,
      });

      // Role-based redirect
      if (user.role === 'ADMIN') {
        router.push('/admin');
      } else {
        router.push('/journeys/new');
      }
    } catch (err: any) {
      setServerError(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="surface-raised p-6 sm:p-10 space-y-8">
      <div className="space-y-4">
        <p className="eyebrow">Sign in</p>
        <h1 className="display text-5xl sm:text-6xl text-ink">
          Welcome <span className="accent text-coral">back.</span>
        </h1>
        <p className="text-base sm:text-lg text-ink-soft leading-relaxed">
          Sign in as a passenger to check connections and view advice, or as an admin to manage the knowledge base.
        </p>
      </div>

      {serverError && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-status-danger/30 bg-status-danger-bg p-4 text-status-danger">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="text-sm font-medium leading-relaxed">{serverError}</p>
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
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in'}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </form>

      <div className="space-y-1 border-t border-ink/10 pt-4">
        <p className="text-base text-ink-soft">
          New passenger to SkyGuardian?{' '}
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
