import React from 'react';

export type StatusType =
  | 'ON_TIME'
  | 'SCHEDULED'
  | 'DEPARTED'
  | 'LANDED'
  | 'DELAYED'
  | 'CANCELLED'
  | 'DIVERTED'
  | 'UNKNOWN'
  | 'SAFE'
  | 'LOW_RISK'
  | 'MODERATE_RISK'
  | 'HIGH_RISK'
  | 'VERY_HIGH_RISK'
  | 'LIKELY_MISSED'
  | 'MISSED'
  | 'VERIFIED'
  | 'DEMO_DATA';

type Tone = 'safe' | 'caution' | 'high' | 'danger' | 'unknown' | 'info';

const TONE_BY_STATUS: Record<string, Tone> = {
  ON_TIME: 'safe',
  LANDED: 'safe',
  SAFE: 'safe',
  LOW: 'safe',
  LOW_RISK: 'safe',
  VERIFIED: 'safe',
  VERIFIED_ELIGIBLE: 'safe',
  SCHEDULED: 'info',
  DEPARTED: 'info',
  DEMO_DATA: 'info',
  DELAYED: 'caution',
  MODERATE: 'caution',
  MODERATE_RISK: 'caution',
  REQUIRES_AIRLINE_APPROVAL: 'caution',
  HIGH: 'high',
  HIGH_RISK: 'high',
  VERY_HIGH: 'danger',
  VERY_HIGH_RISK: 'danger',
  LIKELY_MISSED: 'danger',
  MISSED: 'danger',
  CANCELLED: 'danger',
  DIVERTED: 'danger',
};

const TONES: Record<Tone, string> = {
  safe: 'bg-status-safe-bg text-status-safe',
  caution: 'bg-status-caution-bg text-status-caution',
  high: 'bg-status-high-bg text-status-high',
  danger: 'bg-status-danger-bg text-status-danger',
  unknown: 'bg-status-unknown-bg text-status-unknown',
  info: 'bg-mist-soft text-mist-deep',
};

/** Human-readable label for an API enum, e.g. LIKELY_MISSED -> "Likely missed". */
export function statusLabel(status: string): string {
  const text = status.replace(/_/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function statusTone(status: string): Tone {
  return TONE_BY_STATUS[status.toUpperCase().replace(/\s+/g, '_')] ?? 'unknown';
}

interface BadgeProps {
  status: StatusType | string;
  label?: string;
  className?: string;
}

export default function Badge({ status, label, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-xs font-medium uppercase tracking-[0.08em] whitespace-nowrap ${TONES[statusTone(status)]} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
      {label || statusLabel(status)}
    </span>
  );
}
