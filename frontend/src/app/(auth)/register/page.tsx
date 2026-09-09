'use client';

import React from 'react';
import Link from 'next/link';
import FloatingNavbar from '@/components/ui/FloatingNavbar';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { Shield, ArrowRight } from 'lucide-react';

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased flex flex-col justify-center items-center px-6 py-20 relative">
      <FloatingNavbar />

      <Card variant="elevated" className="w-full max-w-md space-y-6 shadow-2xl relative mt-16 border-sky-500/30">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 mx-auto">
            <Shield className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Create Passenger Account</h2>
          <p className="text-xs text-slate-400 font-mono">Join SkyGuardian for proactive multi-leg disruption risk alerts.</p>
        </div>

        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <Input label="Email Address" type="email" placeholder="passenger@skyguardian.ai" />
          <Input label="Password" type="password" placeholder="••••••••" />

          <Button type="submit" variant="primary" className="w-full">
            <span>Create Account</span>
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </form>

        <p className="text-xs text-center text-slate-500 font-mono">
          Already have an account?{' '}
          <Link href="/login" className="text-sky-400 hover:underline font-bold">
            Sign In
          </Link>
        </p>
      </Card>
    </div>
  );
}
