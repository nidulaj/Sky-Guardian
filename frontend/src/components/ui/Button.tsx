'use client';

import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'accent' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
}

const VARIANTS = {
  primary: 'bg-ink text-sand-50 hover:bg-ink-soft',
  accent: 'bg-coral-deep text-white hover:bg-[#9E2A17]',
  secondary: 'bg-sand-50 text-ink border border-ink/15 hover:border-ink/40',
  outline: 'bg-transparent text-ink border border-ink hover:bg-ink hover:text-sand-50',
  ghost: 'bg-transparent text-ink-soft hover:text-ink hover:bg-ink/5',
  danger: 'bg-red-600 text-white border border-transparent hover:bg-red-700 active:bg-red-800 shadow-sm',
};

const SIZES = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-14 px-7 text-base',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  loadingText = 'Working…',
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors duration-200 disabled:opacity-50 disabled:pointer-events-none ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? (
        <>
          <span className="w-4 h-4 rounded-full border-2 border-current border-r-transparent animate-spin" aria-hidden="true" />
          <span>{loadingText}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
