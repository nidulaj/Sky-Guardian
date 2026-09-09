'use client';

import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'active' | 'warning' | 'danger';
  children: React.ReactNode;
}

export default function Card({
  variant = 'default',
  children,
  className = '',
  ...props
}: CardProps) {
  const baseStyle = 'rounded-2xl transition-all duration-300 p-6 relative overflow-hidden';

  const variantStyles = {
    default: 'hud-card border border-slate-800',
    elevated: 'bg-slate-900/90 backdrop-blur-md border border-slate-800 shadow-2xl shadow-slate-950/80',
    active: 'bg-slate-900/95 border border-sky-500/40 shadow-xl shadow-sky-500/10 glow-cyan',
    warning: 'bg-slate-950/90 border border-amber-500/40 shadow-xl shadow-amber-500/10 glow-amber',
    danger: 'bg-slate-950/90 border border-red-500/40 shadow-xl shadow-red-500/10 glow-red',
  };

  return (
    <div className={`${baseStyle} ${variantStyles[variant]} ${className}`} {...props}>
      {children}
    </div>
  );
}
