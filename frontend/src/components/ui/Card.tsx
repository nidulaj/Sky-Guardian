import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'active' | 'warning' | 'danger';
  children: React.ReactNode;
}

const VARIANTS = {
  default: 'bg-sand-100 border border-ink/10',
  elevated: 'bg-sand-50 border border-ink/10 shadow-[0_1px_0_rgba(26,23,20,0.04),0_18px_40px_-24px_rgba(26,23,20,0.35)]',
  active: 'bg-sand-50 border border-coral/60',
  warning: 'bg-status-caution-bg/60 border border-status-caution/25',
  danger: 'bg-status-danger-bg/60 border border-status-danger/25',
};

export default function Card({ variant = 'default', children, className = '', ...props }: CardProps) {
  return (
    <div className={`rounded-3xl p-6 ${VARIANTS[variant]} ${className}`} {...props}>
      {children}
    </div>
  );
}
