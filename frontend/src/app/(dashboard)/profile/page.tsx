'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User,
  ShieldCheck,
  Phone,
  Mail,
  Check,
  Copy,
  LogOut,
  Sliders,
  Sparkles,
  Lock,
  Globe,
  Loader2,
  AlertCircle,
  ExternalLink,
  Radar,
  Radio
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth/AuthContext';

const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'si', label: 'Sinhala', native: 'සිංහල' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
];

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAdmin, logout, updateProfile } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [language, setLanguage] = useState('en');

  const [isSaving, setIsSaving] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name || '');
      setLastName(user.last_name || '');
      setPhone(user.phone_number || '');
      setLanguage(user.preferred_language || 'en');
    }
  }, [user]);

  const handleCopyId = () => {
    if (!user?.user_id) return;
    navigator.clipboard.writeText(user.user_id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateProfile) return;

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      await updateProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone_number: phone.trim(),
        preferred_language: language,
      });
      setSaveSuccess(true);
      setDirty(false);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not save profile details.';
      setSaveError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (user) {
      setFirstName(user.first_name || '');
      setLastName(user.last_name || '');
      setPhone(user.phone_number || '');
      setLanguage(user.preferred_language || 'en');
      setDirty(false);
      setSaveError(null);
    }
  };

  const handleSignOut = () => {
    logout();
    router.push('/login');
  };

  if (!user) return null;

  const initials = `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || user.email[0]?.toUpperCase() || 'U';
  const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email.split('@')[0];

  return (
    <div className="space-y-10 animate-fade-up">
      {/* Editorial Header */}
      <PageHeader
        eyebrow="04 / Passenger Identity"
        title="Your"
        accent="profile."
        description="Manage your traveler identity, contact details for flight disruption alerts, and active safeguards."
        actions={
          <div className="flex items-center gap-3">
            <Link
              href="/settings"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-ink/15 bg-sand-50 px-5 text-sm font-medium text-ink transition-colors hover:bg-sand-100"
            >
              <Sliders className="h-4 w-4 text-ink-muted" />
              <span>App Settings</span>
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-status-danger/30 bg-status-danger-bg/40 px-5 text-sm font-medium text-status-danger transition-colors hover:bg-status-danger-bg"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </button>
          </div>
        }
      />

      {/* Luxury Identity Hero Card */}
      <div className="relative overflow-hidden rounded-3xl border border-ink/10 bg-gradient-to-br from-sand-50 via-sand-100/90 to-sand-200/50 p-6 sm:p-8 shadow-sm">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-coral/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-mist/20 blur-3xl" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-5">
            {/* Monogram Avatar */}
            <div className="relative shrink-0">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-coral via-coral-deep to-ink text-white font-sans text-2xl font-bold tracking-tight shadow-lg ring-4 ring-coral-soft/60">
                {initials}
              </div>
              <div className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-sand-50 shadow-md">
                {isAdmin ? (
                  <ShieldCheck className="h-4 w-4 text-coral" title="Administrator" />
                ) : (
                  <Sparkles className="h-4 w-4 text-status-safe" title="Verified Passenger" />
                )}
              </div>
            </div>

            {/* Traveler Overview */}
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-2xl sm:text-3xl font-semibold text-ink tracking-tight truncate">
                  {fullName}
                </h2>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 font-mono text-[11px] uppercase font-bold tracking-wider ${
                    isAdmin
                      ? 'bg-coral text-white'
                      : 'bg-sand-200 text-ink-soft border border-ink/10'
                  }`}
                >
                  {user.role}
                </span>
              </div>

              <p className="text-sm text-ink-soft flex items-center gap-2">
                <Mail className="h-4 w-4 text-ink-muted shrink-0" />
                <span>{user.email}</span>
                <span className="hidden sm:inline-block text-ink-muted">·</span>
                <span className="hidden sm:inline-flex items-center gap-1 text-xs text-status-safe font-medium">
                  <Check className="h-3 w-3" />
                  Verified Identity
                </span>
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-ink/10 bg-sand-50 px-2.5 py-1 text-xs font-mono text-ink-soft hover:text-ink hover:border-ink/30 transition-colors shadow-xs"
                  title="Click to copy Passenger ID"
                >
                  {copiedId ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-status-safe" />
                      <span className="text-status-safe font-sans font-medium">Copied ID</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-ink-muted" />
                      <span>ID: {user.user_id ? `${user.user_id.slice(0, 14)}...` : 'Passenger'}</span>
                    </>
                  )}
                </button>

                <div className="inline-flex items-center gap-1.5 rounded-lg border border-status-safe/20 bg-status-safe-bg/60 px-2.5 py-1 text-xs text-status-safe font-medium">
                  <span className="h-2 w-2 rounded-full bg-status-safe animate-pulse" />
                  <span>Session Live & Encrypted</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Metrics / Tier info */}
          <div className="flex md:flex-col items-center md:items-end justify-between border-t md:border-t-0 md:border-l border-ink/10 pt-4 md:pt-0 md:pl-8 gap-2 shrink-0">
            <div className="text-left md:text-right">
              <p className="font-mono text-[10px] uppercase font-bold tracking-widest text-ink-muted">Account Clearance</p>
              <p className="text-base font-semibold text-ink mt-0.5">
                {isAdmin ? 'System Administrator' : 'SkyGuardian Passenger'}
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[10px] uppercase font-bold tracking-widest text-ink-muted">SMS Disruption</p>
              <p className="text-xs font-semibold text-status-safe mt-0.5 flex items-center gap-1 justify-end">
                <Radio className="h-3 w-3" />
                {user.phone_number ? 'Alerts Enabled' : 'Phone Required'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Success & Error alerts */}
      {saveSuccess && (
        <div className="flex items-center gap-3 rounded-2xl border border-status-safe/30 bg-status-safe-bg/70 p-4 text-sm text-status-safe animate-fade-up">
          <Check className="h-5 w-5 shrink-0" />
          <span className="font-medium">Profile details updated and synchronized with SkyGuardian session!</span>
        </div>
      )}

      {saveError && (
        <div className="flex items-center gap-3 rounded-2xl border border-status-danger/30 bg-status-danger-bg/70 p-4 text-sm text-status-danger animate-fade-up">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Main 2-Column Grid */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* Left Column: Editable Traveler Profile Form */}
        <section aria-labelledby="traveler-details-title" className="rounded-3xl border border-ink/10 bg-sand-50 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="border-b border-ink/10 pb-5">
            <h3 id="traveler-details-title" className="text-xl font-semibold text-ink">
              Traveler Information
            </h3>
            <p className="text-sm text-ink-soft mt-1 leading-relaxed">
              Your name and phone number are used by the AI agent team to personalize alerts and deliver instant delay notifications.
            </p>
          </div>

          <form onSubmit={handleSave} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                id="profile-first-name"
                label="First name"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  setDirty(true);
                }}
                placeholder="e.g. Nidula"
                required
              />
              <Input
                id="profile-last-name"
                label="Last name"
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  setDirty(true);
                }}
                placeholder="e.g. Perera"
                required
              />
            </div>

            <Input
              id="profile-email"
              label="Registered Email"
              type="email"
              value={user.email}
              readOnly
              helperText="Managed via your Supabase security account."
            />

            <Input
              id="profile-phone"
              label="SMS Notification Number"
              type="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setDirty(true);
              }}
              placeholder="+94771234567"
              helperText="Used exclusively for automated delay and missed connection SMS notifications."
            />

            <div className="space-y-1.5">
              <label htmlFor="profile-lang" className="block text-sm font-medium text-ink">
                Preferred Assistance Language
              </label>
              <select
                id="profile-lang"
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value);
                  setDirty(true);
                }}
                className="h-12 w-full rounded-xl border border-ink/15 bg-sand-50 px-4 text-base text-ink focus:border-ink focus:outline-none transition-colors"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.native} ({l.label})
                  </option>
                ))}
              </select>
              <p className="text-xs text-ink-soft">
                Journey explanations and compensation guidance will be phrased in this language.
              </p>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-ink/10">
              <p className="text-xs text-ink-muted">
                {dirty ? 'You have unsaved changes.' : 'All changes saved.'}
              </p>

              <div className="flex items-center gap-3">
                {dirty && (
                  <Button type="button" variant="ghost" size="sm" onClick={handleReset} disabled={isSaving}>
                    Cancel
                  </Button>
                )}
                <Button type="submit" variant="primary" disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                      Saving...
                    </>
                  ) : (
                    'Save changes'
                  )}
                </Button>
              </div>
            </div>
          </form>
        </section>

        {/* Right Column: Safeguards, Security & Quick Links */}
        <div className="space-y-6">
          {/* Safeguards Card */}
          <section aria-labelledby="safeguards-title" className="rounded-3xl border border-ink/10 bg-sand-50 p-6 sm:p-7 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Radar className="h-5 w-5 text-coral" />
              <h3 id="safeguards-title" className="text-lg font-semibold text-ink">
                Active Safeguards
              </h3>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-ink/5 bg-sand-100/70 p-3.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-ink">Journey Risk Radar</span>
                  <span className="rounded-full bg-status-safe-bg px-2 py-0.5 font-mono text-[9px] font-bold text-status-safe">
                    ACTIVE
                  </span>
                </div>
                <p className="text-xs text-ink-soft leading-relaxed">
                  Real-time multi-agent evaluation of weather, ATC congestion, and connection safety.
                </p>
              </div>

              <div className="rounded-2xl border border-ink/5 bg-sand-100/70 p-3.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-ink">RAG Policy Explainer</span>
                  <span className="rounded-full bg-status-safe-bg px-2 py-0.5 font-mono text-[9px] font-bold text-status-safe">
                    ACTIVE
                  </span>
                </div>
                <p className="text-xs text-ink-soft leading-relaxed">
                  Grounded passenger compensation advice based on airline contract of carriage.
                </p>
              </div>

              <div className="rounded-2xl border border-ink/5 bg-sand-100/70 p-3.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-ink">Disruption SMS Dispatch</span>
                  <span className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-bold ${
                    user.phone_number
                      ? 'bg-status-safe-bg text-status-safe'
                      : 'bg-sand-300 text-ink-muted'
                  }`}>
                    {user.phone_number ? 'READY' : 'ADD PHONE'}
                  </span>
                </div>
                <p className="text-xs text-ink-soft leading-relaxed">
                  Immediate alerts delivered to your phone when connection risks exceed threshold.
                </p>
              </div>
            </div>
          </section>

          {/* Security & Credentials */}
          <section aria-labelledby="security-title" className="rounded-3xl border border-ink/10 bg-sand-50 p-6 sm:p-7 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-ink" />
              <h3 id="security-title" className="text-lg font-semibold text-ink">
                Security & Clearance
              </h3>
            </div>

            <div className="space-y-3 text-xs text-ink-soft">
              <div className="flex items-center justify-between border-b border-ink/5 pb-2">
                <span>Password Hashing</span>
                <span className="font-mono text-ink font-medium">Argon2id (Quantum-resistant)</span>
              </div>
              <div className="flex items-center justify-between border-b border-ink/5 pb-2">
                <span>Session Clearance</span>
                <span className="font-mono text-ink font-medium">JWT Bearer (HS256)</span>
              </div>
              <div className="flex items-center justify-between border-b border-ink/5 pb-2">
                <span>Database Sync</span>
                <span className="font-mono text-ink font-medium">Supabase PostgreSQL RLS</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Identity Authority</span>
                <span className="font-mono text-ink font-medium">SkyGuardian Auth Gateway</span>
              </div>
            </div>
          </section>

          {/* Quick Shortcuts */}
          <div className="space-y-2.5">
            <Link
              href="/settings"
              className="flex items-center justify-between rounded-2xl border border-ink/10 bg-sand-50 px-5 py-3.5 text-sm text-ink hover:bg-sand-200 transition-colors shadow-xs"
            >
              <span className="flex items-center gap-2.5 font-medium">
                <Sliders className="h-4 w-4 text-ink-muted" />
                Notification & Privacy Settings
              </span>
              <ExternalLink className="h-4 w-4 text-ink-muted" />
            </Link>

            {isAdmin && (
              <Link
                href="/admin"
                className="flex items-center justify-between rounded-2xl border border-coral/20 bg-coral-soft/30 px-5 py-3.5 text-sm text-coral-deep hover:bg-coral-soft/50 transition-colors shadow-xs font-medium"
              >
                <span className="flex items-center gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-coral" />
                  Admin Knowledge Management
                </span>
                <ExternalLink className="h-4 w-4 text-coral" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
