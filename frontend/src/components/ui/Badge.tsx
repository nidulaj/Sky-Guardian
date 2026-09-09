'use client';

import React from 'react';

export type StatusType =
  | 'ON_TIME'
  | 'DELAYED'
  | 'HIGH_RISK'
  | 'VERY_HIGH_RISK'
  | 'MODERATE_RISK'
  | 'LOW_RISK'
  | 'LIKELY_MISSED'
  | 'MISSED'
  | 'SAFE'
  | 'VERIFIED'
  | 'DEMO_DATA';

interface BadgeProps {
  status: StatusType | string;
  label?: string;
  className?: string;
}

export default function Badge({ status, label, className = '' }: BadgeProps) {
  const normalized = status.toUpperCase().replace(/\s+/g, '_');

  const getStyle = () => {
    switch (normalized) {
      case 'VERY_HIGH_RISK':
      case 'HIGH_RISK':
      case 'LIKELY_MISSED':
      case 'MISSED':
        return 'bg-red-500/20 text-red-400 border-red-500/40 glow-red';
      case 'DELAYED':
      case 'MODERATE_RISK':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40 glow-amber';
      case 'ON_TIME':
      case 'SAFE':
      case 'VERIFIED':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      case 'DEMO_DATA':
        return 'bg-sky-500/20 text-sky-300 border-sky-500/40 font-mono';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider border ${getStyle()} ${className}`}
    >
      {label || status.replace(/_/g, ' ')}
    </span>
  );
}
