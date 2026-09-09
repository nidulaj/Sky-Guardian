'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import FloatingNavbar from '@/components/ui/FloatingNavbar';
import { LayoutDashboard, Plane, History, Settings, Shield } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/journeys/new', label: 'Analyze Journey', icon: Plane },
    { href: '/history', label: 'History', icon: History },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased">
      <FloatingNavbar />

      {/* Sub-Header Operations Navigation */}
      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-6xl">
        <div className="p-1.5 rounded-xl bg-slate-900/90 backdrop-blur border border-slate-800 flex items-center justify-between shadow-xl">
          <div className="flex items-center space-x-1 text-xs font-mono">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center space-x-1.5 ${
                    active
                      ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="hidden sm:flex items-center space-x-2 text-[11px] font-mono text-slate-500 pr-3">
            <Shield className="w-3.5 h-3.5 text-sky-400" />
            <span>Flight Ops Online</span>
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}
