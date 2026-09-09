'use client';

import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export default function Input({
  label,
  error,
  helperText,
  className = '',
  ...props
}: InputProps) {
  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <label className="block text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
          {label}
        </label>
      )}
      <input
        className={`w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border text-sm font-mono text-white placeholder:text-slate-600 transition-all focus:outline-none focus:ring-2 focus:ring-sky-500/50 ${
          error
            ? 'border-red-500/80 focus:border-red-500'
            : 'border-slate-800 focus:border-sky-500/80'
        } ${className}`}
        {...props}
      />
      {error && <p className="text-[11px] font-mono text-red-400">{error}</p>}
      {helperText && !error && <p className="text-[11px] font-mono text-slate-500">{helperText}</p>}
    </div>
  );
}
