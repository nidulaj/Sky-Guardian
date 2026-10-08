'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { ArrowRight, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+0-9\s\-()]{7,25}$/;

interface Fields {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  password: string;
  confirm_password: string;
}

type Errors = Partial<Record<keyof Fields, string>>;

const FIELD_ORDER: (keyof Fields)[] = [
  'first_name',
  'last_name',
  'email',
  'phone_number',
  'password',
  'confirm_password',
];

function validate(f: Fields): Errors {
  const errors: Errors = {};
  if (!f.first_name.trim()) errors.first_name = 'Enter your first name.';
  if (!f.last_name.trim()) errors.last_name = 'Enter your last name.';
  if (!f.email.trim()) errors.email = 'Enter your email address.';
  else if (!EMAIL_RE.test(f.email.trim())) errors.email = 'Enter a valid email address like name@example.com.';
  if (!f.phone_number.trim()) errors.phone_number = 'Enter your phone number (e.g. +94 77 123 4567).';
  else if (!PHONE_RE.test(f.phone_number.trim())) errors.phone_number = 'Enter a valid phone number with country code.';
  if (!f.password) errors.password = 'Choose a password.';
  else if (f.password.length < 8) errors.password = `Use at least 8 characters (${8 - f.password.length} more needed).`;
  if (!f.confirm_password) errors.confirm_password = 'Type your password again to confirm it.';
  else if (f.confirm_password !== f.password) errors.confirm_password = "The two passwords don't match.";
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

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [fields, setFields] = useState<Fields>({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    password: '',
    confirm_password: '',
  });
  const [errors, setErrors] = useState<Errors>({});
  const [attempted, setAttempted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const set = (key: keyof Fields) => (value: string) => {
    const next = { ...fields, [key]: value };
    setFields(next);
    if (attempted) setErrors(validate(next));
    if (serverError) setServerError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    setServerError(null);

    const found = validate(fields);
    setErrors(found);
    const firstInvalid = FIELD_ORDER.find((k) => found[k]);
    if (firstInvalid) {
      document.getElementById(`register-${firstInvalid}`)?.focus();
      return;
    }

    setLoading(true);
    try {
      await register({
        first_name: fields.first_name.trim(),
        last_name: fields.last_name.trim(),
        email: fields.email.trim(),
        phone_number: fields.phone_number.trim(),
        password: fields.password,
        confirm_password: fields.confirm_password,
      });

      setSuccess(true);
      setTimeout(() => {
        router.push('/dashboard');
      }, 800);
    } catch (err: any) {
      setServerError(err.message || 'Registration failed. Please verify your details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="surface-raised p-6 sm:p-10 space-y-8">
      <div className="space-y-4">
        <p className="eyebrow">Passenger Registration</p>
        <h1 className="display text-5xl sm:text-6xl text-ink">
          Travel with <span className="accent text-coral">less worry.</span>
        </h1>
        <p className="text-base sm:text-lg text-ink-soft leading-relaxed">
          Create a passenger account to track connection risks, receive disruption advice, and ask policy questions.
        </p>
      </div>

      {serverError && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-status-danger/30 bg-status-danger-bg p-4 text-status-danger">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="text-sm font-medium leading-relaxed">{serverError}</p>
        </div>
      )}

      {success && (
        <div role="status" className="flex items-start gap-3 rounded-2xl border border-status-safe/30 bg-status-safe-bg p-4 text-status-safe">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="text-sm font-medium leading-relaxed">
            Account created successfully! Redirecting you to your dashboard...
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            id="register-first_name"
            label="First name"
            autoComplete="given-name"
            placeholder="e.g. Nidula"
            value={fields.first_name}
            onChange={(e) => set('first_name')(e.target.value)}
            error={errors.first_name}
          />
          <Input
            id="register-last_name"
            label="Last name"
            autoComplete="family-name"
            placeholder="e.g. Perera"
            value={fields.last_name}
            onChange={(e) => set('last_name')(e.target.value)}
            error={errors.last_name}
          />
        </div>

        <Input
          id="register-email"
          label="Email address"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="name@example.com"
          value={fields.email}
          onChange={(e) => set('email')(e.target.value)}
          error={errors.email}
        />

        <Input
          id="register-phone_number"
          label="Phone number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+94 77 123 4567"
          value={fields.phone_number}
          onChange={(e) => set('phone_number')(e.target.value)}
          error={errors.phone_number}
          helperText="Used for flight disruption and transfer alerts."
        />

        <PasswordField
          id="register-password"
          label="Password"
          value={fields.password}
          onChange={set('password')}
          error={errors.password}
          helperText="At least 8 characters."
          autoComplete="new-password"
        />

        <PasswordField
          id="register-confirm_password"
          label="Confirm password"
          value={fields.confirm_password}
          onChange={set('confirm_password')}
          error={errors.confirm_password}
          autoComplete="new-password"
        />

        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={loading || success}>
          {loading ? 'Creating account...' : 'Create passenger account'}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>

        <p className="text-sm text-ink-muted leading-relaxed">
          We only ask for flight and contact details. No passport, ID or payment details required.
        </p>
      </form>

      <div className="space-y-1 border-t border-ink/10 pt-4">
        <p className="text-base text-ink-soft">
          Already have an account?{' '}
          <Link href="/login" className="inline-flex min-h-[44px] items-center font-medium text-ink underline decoration-coral underline-offset-4 hover:decoration-2">
            Sign in
          </Link>
        </p>
        <p className="text-base text-ink-soft">
          Just looking?{' '}
          <Link href="/journeys/new" className="inline-flex min-h-[44px] items-center font-medium text-ink underline decoration-coral underline-offset-4 hover:decoration-2">
            Check a journey without an account
          </Link>
        </p>
      </div>
    </div>
  );
}

