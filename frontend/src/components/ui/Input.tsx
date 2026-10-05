'use client';

import React, { useId } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export default function Input({ label, error, helperText, className = '', id, ...props }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error ? `${inputId}-error` : helperText ? `${inputId}-help` : undefined;

  return (
    <div className="space-y-2 w-full">
      {label && (
        <label htmlFor={inputId} className="eyebrow block">
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`w-full h-12 px-4 rounded-xl bg-sand-50 border text-base text-ink placeholder:text-ink-faint transition-colors focus:outline-none focus:border-ink ${
          error ? 'border-status-danger' : 'border-ink/15 hover:border-ink/30'
        } ${className}`}
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} className="text-sm text-status-danger">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p id={`${inputId}-help`} className="text-sm text-ink-muted">
          {helperText}
        </p>
      )}
    </div>
  );
}
