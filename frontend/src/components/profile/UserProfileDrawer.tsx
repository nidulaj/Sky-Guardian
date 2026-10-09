'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  X,
  User,
  ShieldCheck,
  Phone,
  Mail,
  Check,
  Copy,
  LogOut,
  Sliders,
  Sparkles,
  ExternalLink,
  Lock,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

interface UserProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserProfileDrawer({ isOpen, onClose }: UserProfileDrawerProps) {
  const router = useRouter();
  const { user, isAdmin, logout, updateProfile } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Sync user values whenever user or drawer state changes
  useEffect(() => {
    if (user) {
      setFirstName(user.first_name || '');
      setLastName(user.last_name || '');
      setPhone(user.phone_number || '');
    }
    setIsEditing(false);
    setSaveSuccess(false);
    setSaveError(null);
  }, [user, isOpen]);

  // Trap focus and handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    closeBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen || !user) return null;

  const handleCopyId = () => {
    if (!user.user_id) return;
    navigator.clipboard.writeText(user.user_id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
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
      });
      setSaveSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not save profile changes.';
      setSaveError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = () => {
    onClose();
    logout();
    router.push('/login');
  };

  const initials = `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || user.email[0]?.toUpperCase() || 'U';
  const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email.split('@')[0];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="profile-drawer-title">
      {/* Dimmed backdrop with smooth glassmorphism */}
      <div
        className="absolute inset-0 bg-ink/55 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div
          ref={panelRef}
          className="relative w-screen max-w-lg bg-sand-100 shadow-2xl flex flex-col border-l border-ink/10 animate-fade-up"
        >
          {/* Top Bar / Header */}
          <div className="flex items-center justify-between border-b border-ink/10 px-6 py-5 sm:px-8 bg-sand-50/80 backdrop-blur-md">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-status-safe animate-pulse" />
                <p className="font-mono text-[10px] uppercase font-bold tracking-widest text-ink-muted">
                  SkyGuardian Identity
                </p>
              </div>
              <h2 id="profile-drawer-title" className="font-serif text-2xl sm:text-3xl font-normal text-ink mt-0.5">
                Your <span className="italic text-coral font-serif">Profile.</span>
              </h2>
            </div>
            <button
              ref={closeBtnRef}
              type="button"
              onClick={onClose}
              aria-label="Close profile"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-ink/15 text-ink hover:bg-sand-200 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8 space-y-6">
            {/* VIP / Executive Identity Card */}
            <div className="relative overflow-hidden rounded-3xl border border-ink/10 bg-gradient-to-b from-sand-50 to-sand-100/90 p-6 shadow-sm">
              <div className="flex items-start gap-4">
                {/* Monogram Avatar with luxury ring */}
                <div className="relative flex-shrink-0">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-coral via-coral-deep to-ink text-white font-sans text-xl font-bold tracking-tight shadow-md ring-4 ring-coral-soft/50">
                    {initials}
                  </div>
                  <div
                    className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-sand-50 shadow"
                    title={isAdmin ? 'Administrator' : 'Verified Passenger'}
                  >
                    {isAdmin ? (
                      <ShieldCheck className="h-4 w-4 text-coral" aria-label="Administrator" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5 text-status-safe" aria-label="Verified Passenger" />
                    )}
                  </div>
                </div>

                {/* Identity Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-semibold text-ink truncate">{fullName}</h3>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase font-bold tracking-wider ${
                        isAdmin
                          ? 'bg-coral text-white'
                          : 'bg-sand-200 text-ink-soft border border-ink/10'
                      }`}
                    >
                      {user.role}
                    </span>
                  </div>

                  <p className="text-sm text-ink-soft truncate mt-0.5 flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-ink-muted shrink-0" />
                    {user.email}
                  </p>

                  {/* Copyable User ID */}
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyId}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-ink/10 bg-sand-50 px-2.5 py-1 text-xs font-mono text-ink-soft hover:text-ink hover:border-ink/30 transition-colors"
                      title="Click to copy Passenger ID"
                    >
                      {copiedId ? (
                        <>
                          <Check className="h-3 w-3 text-status-safe" />
                          <span className="text-status-safe font-sans font-medium">Copied ID</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 text-ink-muted" />
                          <span>ID: {user.user_id ? `${user.user_id.slice(0, 10)}...` : 'Passenger'}</span>
                        </>
                      )}
                    </button>

                    <span className="inline-flex items-center gap-1 text-[11px] text-status-safe font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-status-safe" />
                      Session Active
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notification & Status Messages */}
            {saveSuccess && (
              <div className="flex items-center gap-2.5 rounded-2xl border border-status-safe/30 bg-status-safe-bg/60 p-4 text-sm text-status-safe animate-fade-up">
                <Check className="h-4 w-4 shrink-0" />
                <span>Profile details updated and saved successfully!</span>
              </div>
            )}

            {saveError && (
              <div className="flex items-center gap-2.5 rounded-2xl border border-status-danger/30 bg-status-danger-bg/60 p-4 text-sm text-status-danger animate-fade-up">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{saveError}</span>
              </div>
            )}

            {/* Profile Information / Edit Form */}
            <div className="rounded-3xl border border-ink/10 bg-sand-50 p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-base font-semibold text-ink">Personal Details</h4>
                  <p className="text-xs text-ink-soft">Your traveler identity and alert contact.</p>
                </div>
                {!isEditing && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-coral hover:text-coral-deep transition-colors"
                  >
                    Edit details
                  </button>
                )}
              </div>

              {isEditing ? (
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      id="profile-first-name"
                      label="First name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="e.g. Nidula"
                      required
                    />
                    <Input
                      id="profile-last-name"
                      label="Last name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="e.g. Perera"
                      required
                    />
                  </div>

                  <Input
                    id="profile-phone"
                    label="Mobile Number (SMS alerts)"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+94771234567"
                    helperText="Used for automated high-risk flight disruption notifications."
                  />

                  <div className="flex items-center justify-end gap-2.5 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsEditing(false);
                        setFirstName(user.first_name || '');
                        setLastName(user.last_name || '');
                        setPhone(user.phone_number || '');
                      }}
                      disabled={isSaving}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" variant="primary" size="sm" disabled={isSaving}>
                      {isSaving ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                          Saving...
                        </>
                      ) : (
                        'Save changes'
                      )}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="grid gap-3.5 text-sm">
                  <div className="flex items-center justify-between border-b border-ink/5 pb-2.5">
                    <span className="text-ink-muted">First name</span>
                    <span className="font-medium text-ink">{user.first_name || '—'}</span>
                  </div>

                  <div className="flex items-center justify-between border-b border-ink/5 pb-2.5">
                    <span className="text-ink-muted">Last name</span>
                    <span className="font-medium text-ink">{user.last_name || '—'}</span>
                  </div>

                  <div className="flex items-center justify-between border-b border-ink/5 pb-2.5">
                    <span className="text-ink-muted flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" />
                      Email
                    </span>
                    <span className="font-mono text-xs text-ink">{user.email}</span>
                  </div>

                  <div className="flex items-center justify-between border-b border-ink/5 pb-2.5">
                    <span className="text-ink-muted flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" />
                      Alert SMS Phone
                    </span>
                    <span className="font-mono text-xs text-ink">
                      {user.phone_number ? user.phone_number : <span className="text-ink-muted italic">Not configured</span>}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Active Flight Radar Safeguards */}
            <div className="rounded-3xl border border-ink/10 bg-sand-50 p-6 shadow-sm space-y-4">
              <h4 className="text-base font-semibold text-ink flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-coral" />
                Active SkyGuardian Safeguards
              </h4>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between rounded-xl bg-sand-100 p-3">
                  <div className="space-y-0.5">
                    <p className="font-medium text-ink">Journey Risk Radar</p>
                    <p className="text-ink-soft">Real-time weather, connection, and cancellation scoring.</p>
                  </div>
                  <span className="rounded-full bg-status-safe-bg px-2.5 py-1 font-mono text-[10px] font-bold text-status-safe">
                    ACTIVE
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-sand-100 p-3">
                  <div className="space-y-0.5">
                    <p className="font-medium text-ink">AI Policy Explainer (RAG)</p>
                    <p className="text-ink-soft">Grounded legal advice & compensation rights for your airline.</p>
                  </div>
                  <span className="rounded-full bg-status-safe-bg px-2.5 py-1 font-mono text-[10px] font-bold text-status-safe">
                    ACTIVE
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-sand-100 p-3">
                  <div className="space-y-0.5">
                    <p className="font-medium text-ink">Disruption SMS Dispatch</p>
                    <p className="text-ink-soft">Direct notifications sent when missed connections are predicted.</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 font-mono text-[10px] font-bold ${
                    user.phone_number
                      ? 'bg-status-safe-bg text-status-safe'
                      : 'bg-sand-300 text-ink-muted'
                  }`}>
                    {user.phone_number ? 'READY' : 'ADD PHONE'}
                  </span>
                </div>
              </div>
            </div>

            {/* Account Security Info */}
            <div className="rounded-2xl border border-ink/10 bg-sand-200/60 p-4 text-xs text-ink-soft flex items-start gap-3">
              <Lock className="h-4 w-4 text-ink-muted mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-ink">Security & Credential Encryption</p>
                <p className="mt-0.5 leading-relaxed">
                  Protected with Argon2id password hashing and signed Bearer token authorization.
                </p>
              </div>
            </div>

            {/* Quick Links */}
            <div className="space-y-2 pt-2">
              <Link
                href="/profile"
                onClick={onClose}
                className="flex items-center justify-between rounded-2xl border border-ink/10 bg-sand-50 px-4 py-3 text-sm text-ink hover:bg-sand-200 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <User className="h-4 w-4 text-coral" />
                  Open Full Profile Page
                </span>
                <ExternalLink className="h-3.5 w-3.5 text-ink-muted" />
              </Link>

              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={onClose}
                  className="flex items-center justify-between rounded-2xl border border-coral/20 bg-coral-soft/30 px-4 py-3 text-sm text-coral-deep hover:bg-coral-soft/50 transition-colors font-medium"
                >
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-coral" />
                    Admin Knowledge Portal
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 text-coral" />
                </Link>
              )}
            </div>
          </div>

          {/* Footer with Sign Out */}
          <div className="border-t border-ink/10 p-5 sm:px-8 bg-sand-50 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-status-danger/30 bg-status-danger-bg/40 px-4 text-xs font-semibold text-status-danger hover:bg-status-danger-bg transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out of SkyGuardian
            </button>

            <Button type="button" variant="ghost" onClick={onClose} className="rounded-full">
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
